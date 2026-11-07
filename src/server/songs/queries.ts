import "server-only";
import { and, asc, desc, eq, ne, notInArray, sql } from "drizzle-orm";
import {
  db,
  guests,
  idolGroups,
  idolMembers,
  songAssignments,
  songInvitations,
  songPositions,
  songs,
  users,
  youtubeVideos,
  type CrewRole,
  type SongStatus,
} from "@/db";
import { displayName } from "@/lib/labels";
import { canEditSong, getViewer, requireActiveUser } from "@/server/auth-guards";

// ---------------------------------------------------------------------------
// Song detail
// ---------------------------------------------------------------------------

export type Holder =
  | { kind: "member"; userId: string; name: string; image: string | null }
  | { kind: "guest"; guestId: string; name: string; instagram: string | null };

export async function getSongDetail(songId: string) {
  const viewer = await getViewer();

  const [song] = await db
    .select({
      id: songs.id,
      title: songs.title,
      status: songs.status,
      targetPostDate: songs.targetPostDate,
      description: songs.description,
      referenceLinks: songs.referenceLinks,
      isBackfill: songs.isBackfill,
      createdAt: songs.createdAt,
      group: { id: idolGroups.id, name: idolGroups.name, groupType: idolGroups.groupType },
      video: {
        id: youtubeVideos.id,
        videoId: youtubeVideos.videoId,
        title: youtubeVideos.title,
        publishedAt: youtubeVideos.publishedAt,
        viewCount: youtubeVideos.viewCount,
        likeCount: youtubeVideos.likeCount,
        commentCount: youtubeVideos.commentCount,
        thumbnailUrl: youtubeVideos.thumbnailUrl,
      },
    })
    .from(songs)
    .innerJoin(idolGroups, eq(idolGroups.id, songs.groupId))
    .leftJoin(youtubeVideos, eq(youtubeVideos.id, songs.youtubeVideoId))
    .where(eq(songs.id, songId));
  if (!song) return null;

  const [positions, assignments, invitations] = await Promise.all([
    db
      .select({
        id: songPositions.id,
        sortOrder: songPositions.sortOrder,
        customLabel: songPositions.customLabel,
        idolName: idolMembers.name,
      })
      .from(songPositions)
      .leftJoin(idolMembers, eq(idolMembers.id, songPositions.idolMemberId))
      .where(eq(songPositions.songId, songId))
      .orderBy(asc(songPositions.sortOrder)),
    db
      .select({
        id: songAssignments.id,
        role: songAssignments.role,
        positionId: songAssignments.positionId,
        userId: songAssignments.userId,
        guestId: songAssignments.guestId,
        userName: users.name,
        userStage: users.stageName,
        userImage: users.image,
        userStatus: users.status,
        guestName: guests.name,
        guestInstagram: guests.instagram,
      })
      .from(songAssignments)
      .leftJoin(users, eq(users.id, songAssignments.userId))
      .leftJoin(guests, eq(guests.id, songAssignments.guestId))
      .where(eq(songAssignments.songId, songId))
      .orderBy(asc(songAssignments.createdAt)),
    db
      .select({
        id: songInvitations.id,
        role: songInvitations.role,
        positionId: songInvitations.positionId,
        inviteeUserId: songInvitations.inviteeUserId,
        inviteeName: users.name,
        inviteeStage: users.stageName,
        inviteeImage: users.image,
        status: songInvitations.status,
        createdAt: songInvitations.createdAt,
      })
      .from(songInvitations)
      .innerJoin(users, eq(users.id, songInvitations.inviteeUserId))
      .where(and(eq(songInvitations.songId, songId), eq(songInvitations.status, "pending"))),
  ]);

  const crew = assignments.map((a) => ({
    id: a.id,
    role: a.role,
    positionId: a.positionId,
    holder: (a.userId
      ? { kind: "member", userId: a.userId, name: displayName({ name: a.userName, stageName: a.userStage }), image: a.userImage }
      : { kind: "guest", guestId: a.guestId!, name: a.guestName ?? "Guest", instagram: a.guestInstagram }) as Holder,
  }));

  const pending = invitations.map((i) => ({
    id: i.id,
    role: i.role,
    positionId: i.positionId,
    userId: i.inviteeUserId,
    name: displayName({ name: i.inviteeName, stageName: i.inviteeStage }),
    image: i.inviteeImage,
    createdAt: i.createdAt,
  }));

  return {
    ...song,
    video: song.video?.id ? song.video : null,
    positions: positions.map((p) => ({
      id: p.id,
      label: p.customLabel ?? p.idolName ?? "Position",
      isCustom: !!p.customLabel,
      assignment: crew.find((c) => c.positionId === p.id) ?? null,
      invite: pending.find((i) => i.positionId === p.id) ?? null,
    })),
    crew,
    pendingInvites: pending,
    canEdit: await canEditSong(viewer, songId),
    viewerId: viewer.id,
    tz: viewer.tz,
    myInvites: pending.filter((p) => p.userId === viewer.id),
  };
}

export type SongDetail = NonNullable<Awaited<ReturnType<typeof getSongDetail>>>;

/** Daily stats history for the sparkline (FR-CAT-3). */
export async function getVideoHistory(videoDbId: string) {
  await requireActiveUser();
  const r = await db.execute<{ d: string; v: string }>(sql`
    select captured_on::text as d, view_count as v from video_stats_history
    where video_id = ${videoDbId} order by captured_on`);
  return r.rows.map((x) => ({ date: x.d, views: Number(x.v) }));
}

/** Unlinked, non-ignored videos, best title matches first (FR-YT-2, pg_trgm). */
export async function getLinkableVideos(songTitle: string, groupName: string) {
  await requireActiveUser();
  const needle = `${groupName} ${songTitle}`;
  return db
    .select({
      id: youtubeVideos.id,
      videoId: youtubeVideos.videoId,
      title: youtubeVideos.title,
      publishedAt: youtubeVideos.publishedAt,
      score: sql<number>`similarity(${youtubeVideos.title}, ${needle})`,
    })
    .from(youtubeVideos)
    .where(
      and(
        ne(youtubeVideos.backfillState, "ignored"),
        sql`not exists (select 1 from songs s where s.youtube_video_id = "youtube_videos"."id")`,
      ),
    )
    .orderBy(desc(sql`similarity(${youtubeVideos.title}, ${needle})`), desc(youtubeVideos.publishedAt))
    .limit(25);
}

// ---------------------------------------------------------------------------
// My songs (FR-HIS-1)
// ---------------------------------------------------------------------------

export async function listMySongs(filters: { role?: CrewRole; status?: SongStatus }) {
  const viewer = await getViewer();
  const rows = await db
    .select({
      id: songs.id,
      title: songs.title,
      status: songs.status,
      groupName: idolGroups.name,
      role: songAssignments.role,
      positionLabel: sql<string | null>`coalesce(${songPositions.customLabel}, ${idolMembers.name})`,
      postedAt: youtubeVideos.publishedAt,
      updatedAt: songs.updatedAt,
      createdAt: songs.createdAt,
    })
    .from(songAssignments)
    .innerJoin(songs, eq(songs.id, songAssignments.songId))
    .innerJoin(idolGroups, eq(idolGroups.id, songs.groupId))
    .leftJoin(songPositions, eq(songPositions.id, songAssignments.positionId))
    .leftJoin(idolMembers, eq(idolMembers.id, songPositions.idolMemberId))
    .leftJoin(youtubeVideos, eq(youtubeVideos.id, songs.youtubeVideoId))
    .where(
      and(
        eq(songAssignments.userId, viewer.id),
        filters.status ? eq(songs.status, filters.status) : undefined,
      ),
    )
    .orderBy(desc(sql`coalesce(${youtubeVideos.publishedAt}, ${songs.createdAt})`));

  // Group the role rows per song.
  const bySong = new Map<string, { id: string; title: string; status: SongStatus; groupName: string; roles: CrewRole[]; positions: string[]; postedAt: Date | null }>();
  for (const r of rows) {
    const s = bySong.get(r.id) ?? { id: r.id, title: r.title, status: r.status, groupName: r.groupName, roles: [], positions: [], postedAt: r.postedAt };
    if (!s.roles.includes(r.role)) s.roles.push(r.role);
    if (r.positionLabel) s.positions.push(r.positionLabel);
    bySong.set(r.id, s);
  }
  const list = [...bySong.values()];
  return { tz: viewer.tz, songs: filters.role ? list.filter((s) => s.roles.includes(filters.role!)) : list };
}

/** Active songs list for the "Songs" page (recruiting/in progress). */
export async function listActiveSongs() {
  const viewer = await getViewer();
  const rows = await db
    .select({
      id: songs.id,
      title: songs.title,
      status: songs.status,
      groupName: idolGroups.name,
      targetPostDate: songs.targetPostDate,
      openSlots: sql<number>`(
        select count(*) from song_positions p
        where p.song_id = "songs"."id"
          and not exists (select 1 from song_assignments a where a.position_id = p.id))::int`,
      crewSize: sql<number>`(select count(distinct coalesce(a.user_id, a.guest_id::text)) from song_assignments a where a.song_id = "songs"."id")::int`,
      mine: sql<boolean>`exists (select 1 from song_assignments a where a.song_id = "songs"."id" and a.user_id = ${viewer.id})`,
    })
    .from(songs)
    .innerJoin(idolGroups, eq(idolGroups.id, songs.groupId))
    .where(notInArray(songs.status, ["posted", "cancelled"]))
    .orderBy(asc(songs.status), desc(songs.createdAt));
  return { tz: viewer.tz, songs: rows };
}
