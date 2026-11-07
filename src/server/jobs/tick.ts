import "server-only";
import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";
import {
  appSettings,
  db,
  freebusyCache,
  sessionReminders,
  sessionRsvps,
  sessionsSched,
  songAssignments,
  songs,
} from "@/db";
import { SESSION_KIND_LABEL } from "@/lib/labels";
import { DAY, dateKey, parseDateKey, timeToMinutes, zonedTime } from "@/lib/time";
import { retryFailedCalendarSyncs } from "@/server/calendar-sync";
import { notify } from "@/server/notify";
import { getSettings } from "@/server/settings/internal";
import { runYoutubeSync } from "@/server/youtube-sync";

// POST /api/cron/tick (§7). Idempotent: running it twice in a row produces no
// duplicate snapshots (upsert per day) or reminders (session_reminders unique).

export async function runTick(now = new Date()) {
  const settings = await getSettings();
  await db.update(appSettings).set({ lastTickAt: now }).where(eq(appSettings.id, 1));
  const result: Record<string, unknown> = {};

  // 1) YouTube sync once the daily sync time (SGT) has passed today.
  const tz = settings.defaultTimezone;
  const { year, month, day } = parseDateKey(dateKey(now, tz));
  const mins = timeToMinutes(settings.syncTimeSgt);
  const dueAt = zonedTime(year, month, day, Math.floor(mins / 60), mins % 60, tz);
  if (now >= dueAt && (!settings.lastYoutubeSyncAt || settings.lastYoutubeSyncAt < dueAt)) {
    result.youtube = await runYoutubeSync("cron");
  } else {
    result.youtube = "not due";
  }

  // 2) RSVP-needed reminders for sessions in the next 24 h.
  const due = await db
    .selectDistinct({
      sessionId: sessionsSched.id,
      userId: songAssignments.userId,
      songId: songs.id,
      songTitle: songs.title,
      kind: sessionsSched.kind,
    })
    .from(sessionsSched)
    .innerJoin(songs, eq(songs.id, sessionsSched.songId))
    .innerJoin(songAssignments, eq(songAssignments.songId, songs.id))
    .leftJoin(
      sessionRsvps,
      and(eq(sessionRsvps.sessionId, sessionsSched.id), eq(sessionRsvps.userId, songAssignments.userId)),
    )
    .where(
      and(
        eq(sessionsSched.status, "scheduled"),
        gt(sessionsSched.startsAt, now),
        lt(sessionsSched.startsAt, new Date(now.getTime() + DAY)),
        sql`${songAssignments.userId} is not null`,
        isNull(sessionRsvps.id),
      ),
    );
  let reminders = 0;
  for (const r of due) {
    const [inserted] = await db
      .insert(sessionReminders)
      .values({ sessionId: r.sessionId, userId: r.userId! })
      .onConflictDoNothing()
      .returning({ id: sessionReminders.id });
    if (!inserted) continue; // already reminded
    await notify([r.userId], "rsvp_needed", {
      title: `RSVP needed: ${r.songTitle} ${SESSION_KIND_LABEL[r.kind].toLowerCase()}`,
      body: "It's within 24 hours — let your IC know if you're coming.",
      href: `/songs/${r.songId}/sessions/${r.sessionId}`,
    });
    reminders++;
  }
  result.reminders = reminders;

  // 3) Retry failed calendar writes.
  result.calendarRetries = await retryFailedCalendarSyncs();

  // 4) Prune stale FreeBusy cache.
  const pruned = await db
    .delete(freebusyCache)
    .where(lt(freebusyCache.fetchedAt, new Date(now.getTime() - DAY)))
    .returning({ id: freebusyCache.id });
  result.cachePruned = pruned.length;

  return result;
}
