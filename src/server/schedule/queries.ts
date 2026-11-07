import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import {
  db,
  filmingLocations,
  guests,
  idolGroups,
  sessionRsvps,
  sessionVideographers,
  sessionsSched,
  songAssignments,
  songs,
  users,
} from "@/db";
import { displayName } from "@/lib/labels";
import { DAY } from "@/lib/time";
import { canEditSong, getViewer, requireActiveUser } from "@/server/auth-guards";
import { getAvailability, statusFor } from "@/server/availability/engine";
import { calendarStatusFor } from "@/server/calendar-sync";
import { getSettings } from "@/server/settings/internal";

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
