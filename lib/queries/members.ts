import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, idolGroups, songAssignments, songs, users, youtubeVideos } from "@/db";
import { getViewer } from "@/lib/dal";
import { getMemberDashboard } from "@/lib/server/stats";

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
