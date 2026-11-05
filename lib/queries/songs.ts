import "server-only";
import { and, asc, desc, eq, gt, inArray, ne, notInArray, sql } from "drizzle-orm";
import {
  db,
  filmingLocations,
  guests,
  idolGroups,
  idolMembers,
  sessionRsvps,
  sessionVideographers,
  sessionsSched,
  songAssignments,
  songInvitations,
  songPositions,
  songs,
  users,
  youtubeVideos,
  type CrewRole,
  type SongStatus,
} from "@/db";
import { canEditSong, getViewer, requireActiveUser } from "@/lib/dal";
import { DAY } from "@/lib/time";
import { getAvailability, statusFor } from "@/lib/server/avails";
import { calendarStatusFor } from "@/lib/server/calendar-sync";
import { getSettings } from "@/lib/server/settings";

export function displayName(u: { name: string | null; stageName?: string | null }) {
  return u.stageName || u.name || "Member";
}

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

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export async function getSongSessions(songId: string) {
  await requireActiveUser();
  return db
    .select({
      id: sessionsSched.id,
      kind: sessionsSched.kind,
      startsAt: sessionsSched.startsAt,
      endsAt: sessionsSched.endsAt,
      locationText: sessionsSched.locationText,
      bookingStatus: sessionsSched.bookingStatus,
      status: sessionsSched.status,
      going: sql<number>`(select count(*) from session_rsvps r where r.session_id = "sessions_sched"."id" and r.response = 'going')::int`,
      notGoing: sql<number>`(select count(*) from session_rsvps r where r.session_id = "sessions_sched"."id" and r.response = 'not_going')::int`,
    })
    .from(sessionsSched)
    .where(eq(sessionsSched.songId, songId))
    .orderBy(asc(sessionsSched.startsAt));
}

export async function getSessionDetail(songId: string, sessionId: string) {
  const viewer = await getViewer();
  const [s] = await db
    .select()
    .from(sessionsSched)
    .where(and(eq(sessionsSched.id, sessionId), eq(sessionsSched.songId, songId)));
  if (!s) return null;

  const [song] = await db
    .select({ id: songs.id, title: songs.title, status: songs.status, groupName: idolGroups.name })
    .from(songs)
    .innerJoin(idolGroups, eq(idolGroups.id, songs.groupId))
    .where(eq(songs.id, songId));

  const crewRows = await db
    .selectDistinct({ userId: songAssignments.userId, name: users.name, stageName: users.stageName, image: users.image })
    .from(songAssignments)
    .innerJoin(users, eq(users.id, songAssignments.userId))
    .where(eq(songAssignments.songId, songId));
  const roleRows = await db
    .select({ userId: songAssignments.userId, role: songAssignments.role, id: songAssignments.id, guestName: guests.name, userName: users.name, userStage: users.stageName })
    .from(songAssignments)
    .leftJoin(users, eq(users.id, songAssignments.userId))
    .leftJoin(guests, eq(guests.id, songAssignments.guestId))
    .where(eq(songAssignments.songId, songId));

  const [rsvps, locations, videographers, calendar] = await Promise.all([
    db.select().from(sessionRsvps).where(eq(sessionRsvps.sessionId, sessionId)),
    db.select().from(filmingLocations).where(eq(filmingLocations.sessionId, sessionId)).orderBy(asc(filmingLocations.createdAt)),
    db.select({ assignmentId: sessionVideographers.assignmentId }).from(sessionVideographers).where(eq(sessionVideographers.sessionId, sessionId)),
    calendarStatusFor([sessionId]),
  ]);

  // FR-PR-2: recompute availability flags on every view.
  const avails = await getAvailability(
    crewRows.map((c) => c.userId!),
    new Date(s.startsAt.getTime() - DAY),
    new Date(s.endsAt.getTime() + DAY),
  );

  const crew = crewRows.map((c) => {
    const a = avails.get(c.userId!);
    // Their own RepresENT session doesn't make them busy (FR-AV-3).
    const flag = statusFor(a, s.startsAt.getTime(), s.endsAt.getTime());
    const rsvp = rsvps.find((r) => r.userId === c.userId);
    const cal = calendar.find((x) => x.userId === c.userId);
    return {
      userId: c.userId!,
      name: displayName(c),
      image: c.image,
      roles: roleRows.filter((r) => r.userId === c.userId).map((r) => r.role),
      flag,
      rsvp: rsvp ? { response: rsvp.response, reason: rsvp.reason } : null,
      calendar: cal ? { state: cal.syncState, error: cal.lastError } : null,
    };
  });

  return {
    session: s,
    song: song!,
    crew,
    locations,
    videographerAssignments: roleRows
      .filter((r) => r.role === "videographer")
      .map((r) => ({
        id: r.id,
        name: r.userId ? displayName({ name: r.userName, stageName: r.userStage }) : (r.guestName ?? "Guest"),
        selected: videographers.some((v) => v.assignmentId === r.id),
      })),
    canEdit: await canEditSong(viewer, songId),
    viewerId: viewer.id,
    tz: viewer.tz,
    settings: await getSettings(),
  };
}

// ---------------------------------------------------------------------------
// Creating songs / recruiting
// ---------------------------------------------------------------------------

/** Groups with their active rosters, for the new-song form (FR-SONG-2). */
export async function getGroupsWithRosters() {
  await requireActiveUser();
  const [groups, members] = await Promise.all([
    db.select().from(idolGroups).orderBy(asc(idolGroups.name)),
    db
      .select()
      .from(idolMembers)
      .where(eq(idolMembers.isActive, true))
      .orderBy(asc(idolMembers.sortOrder), asc(idolMembers.name)),
  ]);
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    groupType: g.groupType,
    isActive: g.isActive,
    roster: members.filter((m) => m.groupId === g.id).map((m) => ({ id: m.id, name: m.name })),
  }));
}

/**
 * Members to invite, with active-crew counts and an availability summary over
 * the planned practice period (FR-SONG-7).
 */
export async function getInviteCandidates(songId: string, targetPostDate: string | null) {
  await requireActiveUser();
  const settings = await getSettings();
  const from = new Date();
  const lookahead = new Date(Date.now() + settings.lookaheadWeeks * 7 * DAY);
  const target = targetPostDate ? new Date(`${targetPostDate}T23:59:59+08:00`) : null;
  const to = target && target > from && target < lookahead ? target : new Date(Date.now() + 14 * DAY);

  const members = await db
    .select({
      id: users.id,
      name: users.name,
      stageName: users.stageName,
      image: users.image,
      activeCrews: sql<number>`(
        select count(distinct sa.song_id) from song_assignments sa join songs s2 on s2.id = sa.song_id
        where sa.user_id = "users"."id" and s2.status not in ('posted','cancelled'))::int`,
    })
    .from(users)
    .where(eq(users.status, "active"))
    .orderBy(asc(users.name));

  const avails = await getAvailability(members.map((m) => m.id), from, to);
  return {
    from,
    to,
    members: members.map((m) => {
      const a = avails.get(m.id);
      const freeHours = a ? a.available.reduce((n, i) => n + (Math.min(i.end, to.getTime()) - Math.max(i.start, from.getTime())), 0) / 3_600_000 : 0;
      return {
        id: m.id,
        name: displayName(m),
        image: m.image,
        activeCrews: m.activeCrews,
        connected: a?.connected ?? false,
        freeHours: Math.max(0, Math.round(freeHours)),
      };
    }),
  };
}

export async function listGuests() {
  const viewer = await requireActiveUser();
  const rows = await db
    .select({
      id: guests.id,
      name: guests.name,
      instagram: guests.instagram,
      contactNote: guests.contactNote,
      createdBy: guests.createdBy,
      creatorName: users.name,
      credits: sql<number>`(select count(*) from song_assignments sa where sa.guest_id = "guests"."id")::int`,
    })
    .from(guests)
    .leftJoin(users, eq(users.id, guests.createdBy))
    .orderBy(asc(guests.name));
  return rows.map((g) => ({ ...g, canEdit: viewer.role === "admin" || g.createdBy === viewer.id }));
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

// ---------------------------------------------------------------------------
// Upcoming (FR-DB-4) — all crews, not only dancer roles
// ---------------------------------------------------------------------------

export async function getUpcoming() {
  const viewer = await getViewer();
  const mySongIds = db
    .selectDistinct({ id: songAssignments.songId })
    .from(songAssignments)
    .where(eq(songAssignments.userId, viewer.id));

  const [sessions, invites] = await Promise.all([
    db
      .select({
        id: sessionsSched.id,
        songId: songs.id,
        songTitle: songs.title,
        kind: sessionsSched.kind,
        startsAt: sessionsSched.startsAt,
        endsAt: sessionsSched.endsAt,
        locationText: sessionsSched.locationText,
        rsvp: sessionRsvps.response,
      })
      .from(sessionsSched)
      .innerJoin(songs, eq(songs.id, sessionsSched.songId))
      .leftJoin(sessionRsvps, and(eq(sessionRsvps.sessionId, sessionsSched.id), eq(sessionRsvps.userId, viewer.id)))
      .where(
        and(
          inArray(sessionsSched.songId, mySongIds),
          eq(sessionsSched.status, "scheduled"),
          ne(songs.status, "cancelled"),
          gt(sessionsSched.endsAt, new Date()),
        ),
      )
      .orderBy(asc(sessionsSched.startsAt))
      .limit(8),
    getMyPendingInvites(viewer.id),
  ]);

  return {
    tz: viewer.tz,
    sessions,
    invites,
    rsvpNeeded: sessions.filter((s) => !s.rsvp),
  };
}

async function getMyPendingInvites(userId: string) {
  return db
    .select({
      id: songInvitations.id,
      songId: songs.id,
      songTitle: songs.title,
      groupName: idolGroups.name,
      role: songInvitations.role,
      positionLabel: sql<string | null>`coalesce(${songPositions.customLabel}, ${idolMembers.name})`,
      invitedByName: sql<string | null>`(select coalesce(u.stage_name, u.name) from users u where u.id = "song_invitations"."invited_by")`,
      createdAt: songInvitations.createdAt,
    })
    .from(songInvitations)
    .innerJoin(songs, eq(songs.id, songInvitations.songId))
    .innerJoin(idolGroups, eq(idolGroups.id, songs.groupId))
    .leftJoin(songPositions, eq(songPositions.id, songInvitations.positionId))
    .leftJoin(idolMembers, eq(idolMembers.id, songPositions.idolMemberId))
    .where(and(eq(songInvitations.inviteeUserId, userId), eq(songInvitations.status, "pending")))
    .orderBy(desc(songInvitations.createdAt));
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

/** Member ids for the avails heatmap: the crew, or every active member while recruiting. */
export async function getAvailsMemberIds(songId: string, everyone: boolean) {
  await requireActiveUser();
  if (everyone) {
    return (await db.select({ id: users.id }).from(users).where(eq(users.status, "active"))).map((r) => r.id);
  }
  const rows = await db
    .selectDistinct({ id: songAssignments.userId })
    .from(songAssignments)
    .where(and(eq(songAssignments.songId, songId), sql`${songAssignments.userId} is not null`));
  return rows.map((r) => r.id!);
}
