import "server-only";
import { and, desc, eq, sql, asc, ilike, inArray, or } from "drizzle-orm";
import { db, idolGroups, songAssignments, songs, users, youtubeVideos } from "@/db";
import { getViewer, requireAdmin } from "@/server/auth-guards";
import { getMemberDashboard } from "@/server/stats";

/** Public member profile, visible to other members (FR-HIS-2). */
export async function getMemberProfile(userId: string) {
  const viewer = await getViewer();
  const [u] = await db
    .select({
      id: users.id,
      name: users.name,
      stageName: users.stageName,
      image: users.image,
      instagramHandle: users.instagramHandle,
      role: users.role,
      status: users.status,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(eq(users.id, userId), sql`${users.status} in ('active','removed')`));
  if (!u) return null;

  const posted = await db
    .select({
      id: songs.id,
      title: songs.title,
      groupName: idolGroups.name,
      publishedAt: youtubeVideos.publishedAt,
      views: youtubeVideos.viewCount,
      roles: sql<string[]>`array_agg(distinct ${songAssignments.role}::text)`,
    })
    .from(songAssignments)
    .innerJoin(songs, eq(songs.id, songAssignments.songId))
    .innerJoin(idolGroups, eq(idolGroups.id, songs.groupId))
    .innerJoin(youtubeVideos, eq(youtubeVideos.id, songs.youtubeVideoId))
    .where(and(eq(songAssignments.userId, userId), eq(songs.status, "posted")))
    .groupBy(songs.id, idolGroups.name, youtubeVideos.publishedAt, youtubeVideos.viewCount)
    .orderBy(desc(youtubeVideos.publishedAt));

  const stats = await getMemberDashboard(userId, null);
  return { tz: viewer.tz, user: u, posted, stats, isMe: viewer.id === userId };
}

const memberColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  image: users.image,
  status: users.status,
  role: users.role,
  stageName: users.stageName,
  createdAt: users.createdAt,
  reviewedAt: users.reviewedAt,
};

export type MemberRow = Awaited<ReturnType<typeof searchMembers>>[number];

export async function getPendingApprovalCount(): Promise<number> {
  await requireAdmin();
  return db.$count(users, eq(users.status, "pending"));
}

export async function getApprovalQueue() {
  await requireAdmin();
  const rows = await db
    .select(memberColumns)
    .from(users)
    .where(inArray(users.status, ["pending", "rejected"]))
    .orderBy(asc(users.createdAt));
  return {
    pending: rows.filter((r) => r.status === "pending"),
    rejected: rows.filter((r) => r.status === "rejected"),
  };
}

export async function searchMembers(query: string) {
  await requireAdmin();
  const q = query.trim();
  const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return db
    .select(memberColumns)
    .from(users)
    .where(
      and(
        inArray(users.status, ["active", "removed"]),
        q ? or(ilike(users.name, pattern), ilike(users.email, pattern), ilike(users.stageName, pattern)) : undefined,
      ),
    )
    .orderBy(asc(users.status), desc(users.role), asc(users.name));
}
