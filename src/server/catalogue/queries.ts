import "server-only";
import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db, idolGroups, songs, users, youtubeVideos, type GroupType } from "@/db";
import { GROUP_TYPES } from "@/lib/labels";
import { getViewer, requireAdmin } from "@/server/auth-guards";

// Catalogue of posted covers (FR-CAT-1/2). Filters come from URL params.

export type CatalogueSort = "date" | "views" | "likes" | "comments";

export type CatalogueFilters = {
  q?: string;
  group?: string;
  type?: GroupType;
  year?: number;
  mine?: boolean;
  member?: string;
  sort?: CatalogueSort;
};

export function parseCatalogueParams(p: Record<string, string | string[] | undefined>): CatalogueFilters {
  const one = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : undefined);
  const type = one("type");
  const sort = one("sort");
  const year = Number(one("year"));
  return {
    q: one("q")?.trim() || undefined,
    group: one("group") || undefined,
    type: GROUP_TYPES.includes(type as GroupType) ? (type as GroupType) : undefined,
    year: Number.isInteger(year) && year > 2000 ? year : undefined,
    mine: one("mine") === "1",
    member: one("member") || undefined,
    sort: (["date", "views", "likes", "comments"] as const).includes(sort as CatalogueSort)
      ? (sort as CatalogueSort)
      : "date",
  };
}

const crewHas = (userId: string) =>
  sql`exists (select 1 from song_assignments a where a.song_id = "songs"."id" and a.user_id = ${userId})`;

export async function listCatalogue(f: CatalogueFilters) {
  const viewer = await getViewer();
  const where: (SQL | undefined)[] = [eq(songs.status, "posted")];
  if (f.q) {
    const pattern = `%${f.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where.push(or(ilike(songs.title, pattern), ilike(idolGroups.name, pattern), ilike(youtubeVideos.title, pattern)));
  }
  if (f.group) where.push(eq(idolGroups.id, f.group));
  if (f.type) where.push(eq(idolGroups.groupType, f.type));
  if (f.year) where.push(sql`extract(year from (${youtubeVideos.publishedAt} at time zone 'Asia/Singapore'))::int = ${f.year}`);
  if (f.mine) where.push(crewHas(viewer.id));
  if (f.member) where.push(crewHas(f.member));

  const order = {
    date: desc(youtubeVideos.publishedAt),
    views: desc(youtubeVideos.viewCount),
    likes: desc(youtubeVideos.likeCount),
    comments: desc(youtubeVideos.commentCount),
  }[f.sort ?? "date"];

  const rows = await db
    .select({
      id: songs.id,
      title: songs.title,
      groupName: idolGroups.name,
      groupType: idolGroups.groupType,
      videoId: youtubeVideos.videoId,
      thumbnailUrl: youtubeVideos.thumbnailUrl,
      publishedAt: youtubeVideos.publishedAt,
      views: youtubeVideos.viewCount,
      likes: youtubeVideos.likeCount,
      comments: youtubeVideos.commentCount,
    })
    .from(songs)
    .innerJoin(idolGroups, eq(idolGroups.id, songs.groupId))
    .innerJoin(youtubeVideos, eq(youtubeVideos.id, songs.youtubeVideoId))
    .where(and(...where))
    .orderBy(order, desc(youtubeVideos.publishedAt));

  return { tz: viewer.tz, items: rows };
}

/** Options for the filter controls. */
export async function getCatalogueFilterOptions() {
  await getViewer();
  const [groups, members, years] = await Promise.all([
    db.select({ id: idolGroups.id, name: idolGroups.name }).from(idolGroups).orderBy(asc(idolGroups.name)),
    db
      .select({ id: users.id, name: users.name, stageName: users.stageName })
      .from(users)
      .where(sql`${users.status} in ('active','removed')`)
      .orderBy(asc(users.name)),
    db.execute<{ y: number }>(sql`
      select distinct extract(year from (v.published_at at time zone 'Asia/Singapore'))::int as y
      from songs s join youtube_videos v on v.id = s.youtube_video_id where s.status = 'posted' order by y desc`),
  ]);
  return {
    groups,
    members: members.map((m) => ({ id: m.id, name: m.stageName || m.name || "Member" })),
    years: years.rows.map((r) => r.y),
  };
}

/** Untagged videos for the backfill queue (FR-YT-3). */
export async function getBackfillQueue() {
  await requireAdmin();
  const [untagged, ignored] = await Promise.all([
    db.select().from(youtubeVideos).where(eq(youtubeVideos.backfillState, "untagged")).orderBy(desc(youtubeVideos.publishedAt)),
    db.select().from(youtubeVideos).where(eq(youtubeVideos.backfillState, "ignored")).orderBy(desc(youtubeVideos.publishedAt)),
  ]);
  return { untagged, ignored };
}
