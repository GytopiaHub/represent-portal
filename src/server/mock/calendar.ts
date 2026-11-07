import "server-only";
import { MOCK_CALENDARS } from "@/server/mock/fixtures";
import { hashString, seededRandom } from "@/lib/hash";
import type { Interval } from "@/lib/intervals";
import { DAY, addDaysKey, dateKey, zonedParts, zonedTime } from "@/lib/time";

// Simulated Google Calendar. Busy blocks are generated deterministically from
// (user, calendar, date) so the heatmaps look realistic and stay stable.
// Only busy intervals are produced — never titles (FR-AV-2, SEC-3).

const TZ = "Asia/Singapore";

export function mockCalendarList() {
  return MOCK_CALENDARS.map((c) => ({ ...c }));
}

type Persona = "office" | "student" | "shift";
function personaFor(userId: string): Persona {
  return (["office", "student", "shift"] as const)[hashString(userId) % 3];
}

function block(key: string, h1: number, m1: number, h2: number, m2: number): Interval {
  const [y, mo, d] = key.split("-").map(Number);
  return { start: zonedTime(y, mo, d, h1, m1, TZ).getTime(), end: zonedTime(y, mo, d, h2, m2, TZ).getTime() };
}

export function mockFreeBusy(userId: string, calendarIds: string[], from: Date, to: Date): Interval[] {
  const cals = new Set(calendarIds);
  const persona = personaFor(userId);
  const out: Interval[] = [];

  let key = dateKey(from, TZ);
  const lastKey = dateKey(new Date(to.getTime() - 1), TZ);
  for (let guard = 0; guard < 400 && key <= lastKey; guard++, key = addDaysKey(key, 1)) {
    const [y, mo, d] = key.split("-").map(Number);
    const weekday = zonedParts(zonedTime(y, mo, d, 12, 0, TZ), TZ).weekday;
    const weekend = weekday === 0 || weekday === 6;
    const rnd = seededRandom(`${userId}:${key}`);

    if (cals.has("work") && !weekend && persona === "office") out.push(block(key, 9, 0, 18, 30));
    if (cals.has("work") && persona === "shift" && rnd() < 0.45) out.push(block(key, 14, 0, 22, 0));
    if (cals.has("school") && !weekend && persona === "student") {
      out.push(block(key, 10, 0, 12, 0));
      if (rnd() < 0.6) out.push(block(key, 14, 0, 17, 0));
    }
    if (cals.has("primary")) {
      if (rnd() < 0.3) {
        const h = 18 + Math.floor(rnd() * 3); // 18–20
        out.push(block(key, h, rnd() < 0.5 ? 0 : 30, h + 2, 0));
      }
      if (weekend && rnd() < 0.35) {
        const h = 11 + Math.floor(rnd() * 4);
        out.push(block(key, h, 0, h + 3, 0));
      }
    }
  }
  return out.filter((i) => i.end > from.getTime() && i.start < to.getTime() + DAY);
}

/** Simulated event write. Members with no calendars selected count as disconnected. */
export function mockWriteEvent(connected: boolean, existingId: string | null): string {
  if (!connected) throw new Error("Google Calendar not connected");
  return existingId ?? `mock_evt_${crypto.randomUUID().slice(0, 12)}`;
}
