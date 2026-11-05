import "server-only";
import { and, eq, gt, inArray, isNotNull, lt, ne, sql } from "drizzle-orm";
import {
  accounts,
  availOverrides,
  db,
  freebusyCache,
  memberCalendars,
  sessionsSched,
  songAssignments,
  songs,
  users,
} from "@/db";
import { liveFreeBusy } from "@/lib/google";
import { type Interval, covers, merge, overlaps, subtract, union } from "@/lib/intervals";
import { DAY, MINUTE, addDaysKey, dateKey, parseDateKey, timeToMinutes, zonedTime } from "@/lib/time";
import { isMockGoogle } from "./integrations";
import { mockFreeBusy } from "./mock/calendar";
import { getSettings } from "./settings";

// Availability (FR-AV-1):
//   available = (window ∪ manualFree) − effectiveBusy
//   effectiveBusy = ((googleBusy − ownRepresentSessions) ∪ manualBusy) − manualFree
// Manual blocks override Google.

const CACHE_TTL_MS = 15 * MINUTE; // FR-AV-8

export type AvailStatus = "available" | "unavailable" | "unknown";

export type MemberAvailability = {
  userId: string;
  name: string;
  image: string | null;
  /** false = no calendar connected → status "unknown" unless overridden. */
  connected: boolean;
  googleBusy: Interval[];
  ownSessions: (Interval & { sessionId: string; songId: string; songTitle: string; kind: string })[];
  manual: (Interval & { overrideId: string; kind: "busy" | "free"; note: string | null })[];
  effectiveBusy: Interval[];
  available: Interval[];
};

/** Daily availability-window intervals across [from, to) in the settings zone. */
function windowIntervals(from: Date, to: Date, startTime: string, endTime: string, tz: string): Interval[] {
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);
  const out: Interval[] = [];
  let key = addDaysKey(dateKey(from, tz), -1);
  const last = dateKey(to, tz);
  for (let i = 0; i < 400 && key <= last; i++, key = addDaysKey(key, 1)) {
    const { year, month, day } = parseDateKey(key);
    const s = zonedTime(year, month, day, Math.floor(startMin / 60), startMin % 60, tz).getTime();
    const e = zonedTime(year, month, day, Math.floor(endMin / 60), endMin % 60, tz).getTime();
    out.push({ start: s, end: e });
  }
  return out.filter((i) => i.end > from.getTime() && i.start < to.getTime());
}

/** Expand one-off and weekly overrides into concrete intervals within the range. */
function expandOverrides(rows: (typeof availOverrides.$inferSelect)[], from: Date, to: Date) {
  const out: MemberAvailability["manual"] = [];
  for (const r of rows) {
    const len = r.endsAt.getTime() - r.startsAt.getTime();
    if (r.recurrence === "none") {
      if (r.endsAt > from && r.startsAt < to) {
        out.push({ start: r.startsAt.getTime(), end: r.endsAt.getTime(), overrideId: r.id, kind: r.kind, note: r.note });
      }
      continue;
    }
    const until = r.recurrenceUntil ? Date.parse(`${r.recurrenceUntil}T23:59:59Z`) : Infinity;
    let s = r.startsAt.getTime();
    if (s < from.getTime() - len) {
      const weeks = Math.floor((from.getTime() - len - s) / (7 * DAY));
      s += weeks * 7 * DAY;
    }
    for (; s < to.getTime() && s <= until; s += 7 * DAY) {
      if (s + len > from.getTime()) {
        out.push({ start: s, end: s + len, overrideId: r.id, kind: r.kind, note: r.note });
      }
    }
  }
  return out;
}

async function googleBusyFor(
  userId: string,
  calendarIds: string[],
  from: Date,
  to: Date,
  refresh: boolean,
): Promise<Interval[]> {
  if (!refresh) {
    const [hit] = await db
      .select({ busy: freebusyCache.busy, fetchedAt: freebusyCache.fetchedAt })
      .from(freebusyCache)
      .where(
        and(
          eq(freebusyCache.userId, userId),
          eq(freebusyCache.rangeStart, from),
          eq(freebusyCache.rangeEnd, to),
        ),
      );
    if (hit && Date.now() - hit.fetchedAt.getTime() < CACHE_TTL_MS) {
      return hit.busy.map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) }));
    }
  }

  const busy = merge(
    isMockGoogle ? mockFreeBusy(userId, calendarIds, from, to) : await liveFreeBusy(userId, calendarIds, from, to),
  );
  const stored = busy.map((b) => ({ start: new Date(b.start).toISOString(), end: new Date(b.end).toISOString() }));
  await db
    .insert(freebusyCache)
    .values({ userId, rangeStart: from, rangeEnd: to, busy: stored, fetchedAt: new Date() })
    .onConflictDoUpdate({
      target: [freebusyCache.userId, freebusyCache.rangeStart, freebusyCache.rangeEnd],
      set: { busy: stored, fetchedAt: new Date() },
    });
  return busy;
}

/**
 * Availability for several members over [from, to). Google calls run
 * concurrently; any failure degrades that member to "unknown" (FR-AUTH-4).
 * Callers must have authorised the request (requireActiveUser).
 */
export async function getAvailability(
  userIds: string[],
  from: Date,
  to: Date,
  opts: { refresh?: boolean } = {},
): Promise<Map<string, MemberAvailability>> {
  const ids = [...new Set(userIds)];
  const result = new Map<string, MemberAvailability>();
  if (ids.length === 0) return result;

  const settings = await getSettings();
  const window = windowIntervals(from, to, settings.availWindowStart, settings.availWindowEnd, settings.defaultTimezone);

  const [people, cals, broken, overrides, sessionRows] = await Promise.all([
    db.select({ id: users.id, name: users.name, stageName: users.stageName, image: users.image }).from(users).where(inArray(users.id, ids)),
    db
      .select({ userId: memberCalendars.userId, calId: memberCalendars.googleCalendarId })
      .from(memberCalendars)
      .where(and(inArray(memberCalendars.userId, ids), eq(memberCalendars.includeInBusy, true))),
    isMockGoogle
      ? Promise.resolve([] as { userId: string }[])
      : db
          .select({ userId: accounts.userId })
          .from(accounts)
          .where(and(inArray(accounts.userId, ids), isNotNull(accounts.token_error))),
    db
      .select()
      .from(availOverrides)
      .where(
        and(
          inArray(availOverrides.userId, ids),
          lt(availOverrides.startsAt, to),
          sql`(${availOverrides.recurrence} = 'weekly' or ${availOverrides.endsAt} > ${from})`,
        ),
      ),
    // FR-AV-3: each member's own RepresENT sessions.
    db
      .selectDistinct({
        userId: songAssignments.userId,
        sessionId: sessionsSched.id,
        songId: songs.id,
        songTitle: songs.title,
        kind: sessionsSched.kind,
        startsAt: sessionsSched.startsAt,
        endsAt: sessionsSched.endsAt,
      })
      .from(sessionsSched)
      .innerJoin(songs, eq(songs.id, sessionsSched.songId))
      .innerJoin(songAssignments, eq(songAssignments.songId, songs.id))
      .where(
        and(
          inArray(songAssignments.userId, ids),
          eq(sessionsSched.status, "scheduled"),
          ne(songs.status, "cancelled"),
          lt(sessionsSched.startsAt, to),
          gt(sessionsSched.endsAt, from),
        ),
      ),
  ]);

  const brokenIds = new Set(broken.map((b) => b.userId));
  const calsByUser = new Map<string, string[]>();
  for (const c of cals) calsByUser.set(c.userId, [...(calsByUser.get(c.userId) ?? []), c.calId]);

  await Promise.all(
    people.map(async (p) => {
      const calIds = calsByUser.get(p.id) ?? [];
      let connected = calIds.length > 0 && !brokenIds.has(p.id);
      let googleBusy: Interval[] = [];
      if (connected) {
        try {
          googleBusy = await googleBusyFor(p.id, calIds, from, to, !!opts.refresh);
        } catch {
          connected = false; // degrade gracefully
        }
      }
      const ownSessions = sessionRows
        .filter((s) => s.userId === p.id)
        .map((s) => ({
          start: s.startsAt.getTime(),
          end: s.endsAt.getTime(),
          sessionId: s.sessionId,
          songId: s.songId,
          songTitle: s.songTitle,
          kind: s.kind,
        }));
      const manual = expandOverrides(overrides.filter((o) => o.userId === p.id), from, to);
      const manualBusy = manual.filter((m) => m.kind === "busy");
      const manualFree = manual.filter((m) => m.kind === "free");

      const effectiveBusy = subtract(union(subtract(googleBusy, ownSessions), manualBusy), manualFree);
      const available = subtract(union(window, manualFree), effectiveBusy);

      result.set(p.id, {
        userId: p.id,
        name: p.stageName || p.name || "Member",
        image: p.image,
        connected,
        googleBusy,
        ownSessions,
        manual,
        effectiveBusy,
        available,
      });
    }),
  );
  return result;
}

/** Availability flag for one time range (FR-PR-2). */
export function statusFor(a: MemberAvailability | undefined, start: number, end: number): AvailStatus {
  if (!a) return "unknown";
  if (overlaps(a.effectiveBusy, start, end)) return "unavailable";
  const manuallyFree = a.manual.some((m) => m.kind === "free" && m.start <= start && m.end >= end);
  if (!a.connected && !manuallyFree) return "unknown";
  return "available";
}

// ---------------------------------------------------------------------------
// Crew heatmap & suggested slots (FR-AV-6, FR-AV-7)
// ---------------------------------------------------------------------------

export type HeatCell = {
  start: number;
  end: number;
  free: string[];
  busy: string[];
  unknown: string[];
};

export type HeatDay = { key: string; cells: HeatCell[] };

export async function buildHeatmap(
  avails: Map<string, MemberAvailability>,
  weekStartKey: string,
  days = 7,
  slotMinutes = 60,
): Promise<HeatDay[]> {
  const settings = await getSettings();
  const tz = settings.defaultTimezone;
  const startMin = timeToMinutes(settings.availWindowStart);
  const endMin = timeToMinutes(settings.availWindowEnd);
  const members = [...avails.values()];

  const out: HeatDay[] = [];
  for (let d = 0; d < days; d++) {
    const key = addDaysKey(weekStartKey, d);
    const { year, month, day } = parseDateKey(key);
    const cells: HeatCell[] = [];
    for (let m = startMin; m + slotMinutes <= endMin; m += slotMinutes) {
      const s = zonedTime(year, month, day, Math.floor(m / 60), m % 60, tz).getTime();
      const e = s + slotMinutes * MINUTE;
      const cell: HeatCell = { start: s, end: e, free: [], busy: [], unknown: [] };
      for (const a of members) {
        const st = statusFor(a, s, e);
        if (st === "unavailable") cell.busy.push(a.name);
        else if (st === "unknown") cell.unknown.push(a.name);
        else if (covers(a.available, s, e)) cell.free.push(a.name);
        else cell.busy.push(a.name);
      }
      cells.push(cell);
    }
    out.push({ key, cells });
  }
  return out;
}

export type SuggestedSlot = { start: number; end: number; free: string[]; total: number };

/** Top non-overlapping slots ranked by free count, ties → earlier (FR-AV-7). */
export function suggestSlots(
  avails: Map<string, MemberAvailability>,
  from: Date,
  to: Date,
  durationMinutes: number,
  limit = 5,
): SuggestedSlot[] {
  const step = 30 * MINUTE;
  const dur = durationMinutes * MINUTE;
  const members = [...avails.values()];
  const candidates: SuggestedSlot[] = [];
  const startAt = Math.ceil(Math.max(from.getTime(), Date.now()) / step) * step;
  for (let s = startAt; s + dur <= to.getTime(); s += step) {
    // "Unknown" (no calendar) members are not counted as free.
    const free = members.filter((a) => statusFor(a, s, s + dur) === "available" && covers(a.available, s, s + dur));
    if (free.length > 0) candidates.push({ start: s, end: s + dur, free: free.map((a) => a.name), total: members.length });
  }
  candidates.sort((a, b) => b.free.length - a.free.length || a.start - b.start);
  const picked: SuggestedSlot[] = [];
  for (const c of candidates) {
    if (picked.some((p) => p.start < c.end && p.end > c.start)) continue;
    picked.push(c);
    if (picked.length >= limit) break;
  }
  return picked;
}
