import "server-only";
import { and, asc, desc, eq, gt, inArray, ne, sql } from "drizzle-orm";
import {
  db,
  idolGroups,
  idolMembers,
  sessionRsvps,
  sessionsSched,
  songAssignments,
  songInvitations,
  songPositions,
  songs,
} from "@/db";
import { getViewer } from "@/server/auth-guards";

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
