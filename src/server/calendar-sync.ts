import "server-only";
import { and, eq, gt, inArray, lt, sql } from "drizzle-orm";
import {
  calendarEvents,
  db,
  memberCalendars,
  sessionsSched,
  songs,
} from "@/db";
import { liveDeleteEvent, liveUpsertEvent } from "@/server/google";
import { SESSION_KIND_LABEL } from "@/lib/labels";
import { isMockGoogle } from "@/server/integrations";
import { mockWriteEvent } from "@/server/mock/calendar";
import { notify, songMemberIds } from "@/server/notify";

// Google Calendar write-back (FR-CAL-1..6). Always called after the DB write
// has committed (via after()), and never blocks saving a session.

const MAX_ATTEMPTS = 3;
const CONCURRENCY = 5;

async function pool<T>(items: T[], fn: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) await fn(item);
    }),
  );
}

async function isConnected(userId: string) {
  const [row] = await db
    .select({ id: memberCalendars.id })
    .from(memberCalendars)
    .where(eq(memberCalendars.userId, userId))
    .limit(1);
  return !!row;
}

/** Create/update/delete every crew member's event for one session. */
export async function syncSessionCalendars(sessionId: string, opts: { retryOnly?: boolean } = {}) {
  const [s] = await db
    .select({
      id: sessionsSched.id,
      songId: sessionsSched.songId,
      songTitle: songs.title,
      songStatus: songs.status,
      kind: sessionsSched.kind,
      status: sessionsSched.status,
      startsAt: sessionsSched.startsAt,
      endsAt: sessionsSched.endsAt,
      locationText: sessionsSched.locationText,
      notes: sessionsSched.notes,
    })
    .from(sessionsSched)
    .innerJoin(songs, eq(songs.id, sessionsSched.songId))
    .where(eq(sessionsSched.id, sessionId));
  if (!s) return;

  const live = s.status === "scheduled" && s.songStatus !== "cancelled";
  // Guests are never in this list (FR-CAL-6): only member assignments.
  const crew = live ? await songMemberIds(s.songId) : [];
  const existing = await db.select().from(calendarEvents).where(eq(calendarEvents.sessionId, sessionId));
  const existingByUser = new Map(existing.map((e) => [e.userId, e]));

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const event = {
    summary: `[RepresENT] ${s.songTitle} – ${SESSION_KIND_LABEL[s.kind]}`,
    description: [
      s.locationText ? `📍 ${s.locationText}` : null,
      s.notes,
      `${appUrl}/songs/${s.songId}/sessions/${s.id}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
    location: s.locationText,
    start: s.startsAt,
    end: s.endsAt,
    sessionId: s.id,
  };

  const failedNow: string[] = [];

  // Upserts for current crew
  await pool(crew, async (userId) => {
    const row = existingByUser.get(userId);
    // Retries stop after MAX_ATTEMPTS; a real edit to the session always tries again.
    if (opts.retryOnly && row?.syncState !== "failed") return;
    if (opts.retryOnly && row && row.attempts >= MAX_ATTEMPTS) return;
    try {
      const eventId = isMockGoogle
        ? mockWriteEvent(await isConnected(userId), row?.googleEventId ?? null)
        : await liveUpsertEvent(userId, row?.googleEventId ?? null, event);
      await db
        .insert(calendarEvents)
        .values({ sessionId, userId, googleEventId: eventId, syncState: "ok", attempts: 0, lastSyncedAt: new Date() })
        .onConflictDoUpdate({
          target: [calendarEvents.sessionId, calendarEvents.userId],
          set: { googleEventId: eventId, syncState: "ok", attempts: 0, lastError: null, lastSyncedAt: new Date() },
        });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (row?.syncState !== "failed") failedNow.push(userId);
      await db
        .insert(calendarEvents)
        .values({ sessionId, userId, syncState: "failed", attempts: 1, lastError: message })
        .onConflictDoUpdate({
          target: [calendarEvents.sessionId, calendarEvents.userId],
          set: { syncState: "failed", attempts: sql`${calendarEvents.attempts} + 1`, lastError: message },
        });
    }
  });

  // Deletes for people no longer on the crew, or a cancelled session
  const crewSet = new Set(crew);
  const toDelete = existing.filter((e) => !crewSet.has(e.userId));
  await pool(toDelete, async (row) => {
    try {
      if (row.googleEventId && !isMockGoogle) await liveDeleteEvent(row.userId, row.googleEventId);
      await db.delete(calendarEvents).where(eq(calendarEvents.id, row.id));
    } catch (err) {
      await db
        .update(calendarEvents)
        .set({
          syncState: "failed",
          attempts: sql`${calendarEvents.attempts} + 1`,
          lastError: err instanceof Error ? err.message : String(err),
        })
        .where(eq(calendarEvents.id, row.id));
    }
  });

  if (failedNow.length > 0) {
    const ics = await songMemberIds(s.songId, ["ic"]);
    const href = `/songs/${s.songId}/sessions/${s.id}`;
    await notify(failedNow, "calendar_failed", {
      title: "Couldn't add an event to your Google Calendar",
      body: `${event.summary}. Reconnect Google Calendar to fix this.`,
      href,
    });
    await notify(ics.filter((id) => !failedNow.includes(id)), "calendar_failed", {
      title: `Calendar not updated for ${failedNow.length} crew member${failedNow.length === 1 ? "" : "s"}`,
      body: event.summary,
      href,
    });
  }
}

/** Re-sync every future session of a song (crew joined/left, FR-CAL-3). */
export async function syncSongFutureSessions(songId: string) {
  const rows = await db
    .select({ id: sessionsSched.id })
    .from(sessionsSched)
    .where(and(eq(sessionsSched.songId, songId), gt(sessionsSched.startsAt, new Date())));
  for (const r of rows) await syncSessionCalendars(r.id);
}

/** cron/tick: retry failed writes with fewer than 3 attempts (FR-CAL-5). */
export async function retryFailedCalendarSyncs() {
  const rows = await db
    .selectDistinct({ sessionId: calendarEvents.sessionId })
    .from(calendarEvents)
    .where(and(eq(calendarEvents.syncState, "failed"), lt(calendarEvents.attempts, MAX_ATTEMPTS)));
  for (const r of rows) await syncSessionCalendars(r.sessionId, { retryOnly: true });
  return rows.length;
}

/** Sync-status rows for a session page ("Calendar not updated for X"). */
export async function calendarStatusFor(sessionIds: string[]) {
  if (sessionIds.length === 0) return [];
  return db
    .select({
      sessionId: calendarEvents.sessionId,
      userId: calendarEvents.userId,
      syncState: calendarEvents.syncState,
      lastError: calendarEvents.lastError,
      attempts: calendarEvents.attempts,
    })
    .from(calendarEvents)
    .where(inArray(calendarEvents.sessionId, sessionIds));
}
