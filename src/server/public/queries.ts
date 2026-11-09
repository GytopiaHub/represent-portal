import "server-only";
import { cacheLife } from "next/cache";
import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  guests,
  idolGroups,
  idolMembers,
  songAssignments,
  songPositions,
  songs,
  users,
  youtubeVideos,
} from "@/db";
import { GROUP_TYPES, displayName } from "@/lib/labels";
import { publicRead } from "@/server/auth-guards";
import { getChannelInfo } from "@/server/youtube-channel";

// Public, read-only data for signed-out visitors (R-ROLE-6, FR-PUB-1..4).
//
// Rules for this module:
// - Only POSTED songs. Everything here is already public on the YouTube
//   channel (titles, stats and the crew credits in each video's caption).
// - Never select emails, profile images, guest contact notes, avails,
//   sessions, invitations or anything about songs that aren't posted.
// - Results are shared by every visitor, so they're cached ("use cache") for
//   an hour. Video stats only change when the daily YouTube sync runs.

const POPULAR_LIMIT = 6;

// ---------------------------------------------------------------------------
// Overview (FR-PUB-1, FR-PUB-2)
// ---------------------------------------------------------------------------

export type PublicCover = {
  id: string;
  title: string;
  groupName: string;
  videoId: string;
  thumbnailUrl: string | null;
  publishedAt: Date;
  views: number;
  likes: number;
  comments: number;
};

const coverColumns = {
  id: songs.id,
  title: songs.title,
  groupName: idolGroups.name,
  videoId: youtubeVideos.videoId,
  thumbnailUrl: youtubeVideos.thumbnailUrl,
  publishedAt: youtubeVideos.publishedAt,
  views: youtubeVideos.viewCount,
  likes: youtubeVideos.likeCount,
  comments: youtubeVideos.commentCount,
};

async function cachedOverview() {
  "use cache";
  cacheLife("hours");

  const [channel, totals, topGroups, popular] = await Promise.all([
    getChannelInfo(),
    db
      .select({
        covers: sql<number>`count(*)::int`,
        views: sql<number>`coalesce(sum(${youtubeVideos.viewCount}), 0)::bigint`,
        likes: sql<number>`coalesce(sum(${youtubeVideos.likeCount}), 0)::bigint`,
      })
      .from(songs)
      .innerJoin(youtubeVideos, eq(youtubeVideos.id, songs.youtubeVideoId))
      .where(eq(songs.status, "posted")),
    db
      .select({ name: idolGroups.name, count: sql<number>`count(*)::int` })
      .from(songs)
      .innerJoin(idolGroups, eq(idolGroups.id, songs.groupId))
      .where(eq(songs.status, "posted"))
      .groupBy(idolGroups.name)
      .orderBy(desc(sql`count(*)`), asc(idolGroups.name))
      .limit(5),
    db
      .select(coverColumns)
      .from(songs)
      .innerJoin(idolGroups, eq(idolGroups.id, songs.groupId))
      .innerJoin(youtubeVideos, eq(youtubeVideos.id, songs.youtubeVideoId))
      .where(eq(songs.status, "posted"))
      .orderBy(desc(youtubeVideos.viewCount), desc(youtubeVideos.publishedAt))
      .limit(POPULAR_LIMIT),
  ]);

  return {
    channel,
    totals: {
      covers: Number(totals[0]?.covers ?? 0),
      views: Number(totals[0]?.views ?? 0),
      likes: Number(totals[0]?.likes ?? 0),
    },
    topGroups: topGroups.map((g) => ({ name: g.name, count: Number(g.count) })),
    popular: popular as PublicCover[],
  };
}

/** Channel profile, crew totals, top groups and most-viewed covers. */
export async function getPublicOverview() {
  publicRead();
  return cachedOverview();
}

// ---------------------------------------------------------------------------
// Catalogue (FR-PUB-2)
// ---------------------------------------------------------------------------

const one = z.preprocess((v) => (typeof v === "string" ? v : undefined), z.string().optional());

const publicCatalogueSchema = z.object({
  q: one.transform((v) => v?.trim().slice(0, 100) || undefined),
  group: one.pipe(z.uuid().optional()).catch(undefined),
  type: one.pipe(z.enum(GROUP_TYPES as [string, ...string[]]).optional()).catch(undefined),
  year: one
    .transform((v) => (v ? Number(v) : undefined))
    .pipe(z.number().int().min(2000).max(2100).optional())
    .catch(undefined),
  member: one.pipe(z.string().min(1).max(64).optional()).catch(undefined),
  sort: one.pipe(z.enum(["date", "views", "likes", "comments"]).default("date")).catch("date"),
});

export type PublicCatalogueFilters = z.infer<typeof publicCatalogueSchema>;

/** Parse untrusted URL params into catalogue filters. Bad values are dropped. */
export function parsePublicCatalogueParams(p: Record<string, string | string[] | undefined>): PublicCatalogueFilters {
  return publicCatalogueSchema.parse(p);
}

const crewHas = (userId: string) =>
  sql`exists (select 1 from song_assignments a where a.song_id = "songs"."id" and a.user_id = ${userId})`;

async function cachedCatalogue(f: PublicCatalogueFilters) {
  "use cache";
  cacheLife("hours");

  const where: (SQL | undefined)[] = [eq(songs.status, "posted")];
  if (f.q) {
    const pattern = `%${f.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where.push(or(ilike(songs.title, pattern), ilike(idolGroups.name, pattern), ilike(youtubeVideos.title, pattern)));
  }
  if (f.group) where.push(eq(idolGroups.id, f.group));
  if (f.type) where.push(sql`${idolGroups.groupType} = ${f.type}`);
  if (f.year) where.push(sql`extract(year from (${youtubeVideos.publishedAt} at time zone 'Asia/Singapore'))::int = ${f.year}`);
  if (f.member) where.push(crewHas(f.member));

  const order = {
    date: desc(youtubeVideos.publishedAt),
    views: desc(youtubeVideos.viewCount),
    likes: desc(youtubeVideos.likeCount),
    comments: desc(youtubeVideos.commentCount),
  }[f.sort];

  const rows = await db
    .select(coverColumns)
    .from(songs)
    .innerJoin(idolGroups, eq(idolGroups.id, songs.groupId))
    .innerJoin(youtubeVideos, eq(youtubeVideos.id, songs.youtubeVideoId))
    .where(and(...where))
    .orderBy(order, desc(youtubeVideos.publishedAt));

  return rows as PublicCover[];
}

/** Posted covers matching the filters. Never filters by "me". */
export async function listPublicCatalogue(filters: PublicCatalogueFilters) {
  publicRead();
  return cachedCatalogue(filters);
}

async function cachedCatalogueOptions() {
  "use cache";
  cacheLife("hours");

  const [groups, members, years] = await Promise.all([
    db
      .selectDistinct({ id: idolGroups.id, name: idolGroups.name })
      .from(idolGroups)
      .innerJoin(songs, and(eq(songs.groupId, idolGroups.id), eq(songs.status, "posted")))
      .orderBy(asc(idolGroups.name)),
    // Only people credited on a posted cover; their names are in the captions.
    db
      .selectDistinct({ id: users.id, name: users.name, stageName: users.stageName })
      .from(users)
      .innerJoin(songAssignments, eq(songAssignments.userId, users.id))
      .innerJoin(songs, and(eq(songs.id, songAssignments.songId), eq(songs.status, "posted")))
      .orderBy(asc(users.name)),
    db.execute<{ y: number }>(sql`
      select distinct extract(year from (v.published_at at time zone 'Asia/Singapore'))::int as y
      from songs s join youtube_videos v on v.id = s.youtube_video_id where s.status = 'posted' order by y desc`),
  ]);

  return {
    groups,
    members: members
      .map((m) => ({ id: m.id, name: displayName(m) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    years: years.rows.map((r) => Number(r.y)),
  };
}

/** Options for the public catalogue's filter controls. */
export async function getPublicCatalogueOptions() {
  publicRead();
  return cachedCatalogueOptions();
}

// ---------------------------------------------------------------------------
// Song page with credits (FR-PUB-3)
// ---------------------------------------------------------------------------

export type PublicCredit = {
  name: string;
  instagram: string | null;
  isGuest: boolean;
};

async function cachedSong(songId: string) {
  "use cache";
  cacheLife("hours");

  const [song] = await db
    .select({
      ...coverColumns,
      groupType: idolGroups.groupType,
      videoTitle: youtubeVideos.title,
    })
    .from(songs)
    .innerJoin(idolGroups, eq(idolGroups.id, songs.groupId))
    .innerJoin(youtubeVideos, eq(youtubeVideos.id, songs.youtubeVideoId))
    .where(and(eq(songs.id, songId), eq(songs.status, "posted")));
  if (!song) return null;

  const [positions, assignments] = await Promise.all([
    db
      .select({ id: songPositions.id, customLabel: songPositions.customLabel, idolName: idolMembers.name })
      .from(songPositions)
      .leftJoin(idolMembers, eq(idolMembers.id, songPositions.idolMemberId))
      .where(eq(songPositions.songId, songId))
      .orderBy(asc(songPositions.sortOrder)),
    db
      .select({
        id: songAssignments.id,
        role: songAssignments.role,
        positionId: songAssignments.positionId,
        userName: users.name,
        userStage: users.stageName,
        userInstagram: users.instagramHandle,
        guestName: guests.name,
        guestInstagram: guests.instagram,
        isGuest: sql<boolean>`${songAssignments.guestId} is not null`,
      })
      .from(songAssignments)
      .leftJoin(users, eq(users.id, songAssignments.userId))
      .leftJoin(guests, eq(guests.id, songAssignments.guestId))
      .where(eq(songAssignments.songId, songId))
      .orderBy(asc(songAssignments.createdAt)),
  ]);

  const credit = (a: (typeof assignments)[number]): PublicCredit =>
    a.isGuest
      ? { name: a.guestName ?? "Guest", instagram: a.guestInstagram, isGuest: true }
      : { name: displayName({ name: a.userName, stageName: a.userStage }), instagram: a.userInstagram, isGuest: false };

  const byRole = (role: "ic" | "videographer" | "editor") =>
    assignments.filter((a) => a.role === role).map(credit);

  return {
    ...song,
    // Only filled positions: an empty slot on a posted cover isn't a credit.
    dancers: positions.flatMap((p) => {
      const a = assignments.find((x) => x.positionId === p.id);
      return a ? [{ id: p.id, position: p.customLabel ?? p.idolName ?? "Dancer", ...credit(a) }] : [];
    }),
    ics: byRole("ic"),
    videographers: byRole("videographer"),
    editors: byRole("editor"),
  };
}

/** A posted cover with its crew credits, or null if it isn't public. */
export async function getPublicSong(songId: string) {
  publicRead();
  const id = z.uuid().safeParse(songId);
  if (!id.success) return null;
  return cachedSong(id.data);
}

export type PublicSong = NonNullable<Awaited<ReturnType<typeof getPublicSong>>>;
