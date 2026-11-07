// Time-zone helpers built on Intl (no extra deps). All storage is UTC; these
// convert between UTC instants and wall-clock times in a given IANA zone.

export const DEFAULT_TZ = "Asia/Singapore";
export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

type Parts = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };

const partsFormatters = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string) {
  let f = partsFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      weekday: "short",
    });
    partsFormatters.set(tz, f);
  }
  return f;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Wall-clock parts of `date` in `tz`. weekday: 0 = Sunday. */
export function zonedParts(date: Date, tz: string): Parts {
  const p: Record<string, string> = {};
  for (const { type, value } of partsFormatter(tz).formatToParts(date)) p[type] = value;
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    weekday: WEEKDAYS.indexOf(p.weekday),
  };
}

function offsetMs(date: Date, tz: string) {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return asUtc - Math.floor(date.getTime() / MINUTE) * MINUTE;
}

/** The UTC instant for a wall-clock time in `tz`. Month is 1-based. */
export function zonedTime(year: number, month: number, day: number, hour: number, minute: number, tz: string): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  let t = guess - offsetMs(new Date(guess), tz);
  t = guess - offsetMs(new Date(t), tz); // second pass handles DST edges
  return new Date(t);
}

/** "YYYY-MM-DD" of `date` in `tz`. */
export function dateKey(date: Date, tz: string) {
  const p = zonedParts(date, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function parseDateKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return { year: y, month: m, day: d };
}

/** Midnight (start of day) in `tz` for a YYYY-MM-DD key. */
export function startOfDayKey(key: string, tz: string) {
  const { year, month, day } = parseDateKey(key);
  return zonedTime(year, month, day, 0, 0, tz);
}

/** Add whole days to a YYYY-MM-DD key (calendar arithmetic, tz-independent). */
export function addDaysKey(key: string, days: number) {
  const { year, month, day } = parseDateKey(key);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing `date` in `tz`, as a key. */
export function weekStartKey(date: Date, tz: string) {
  const p = zonedParts(date, tz);
  const key = dateKey(date, tz);
  return addDaysKey(key, -((p.weekday + 6) % 7));
}

/** "HH:MM[:SS]" → minutes after midnight. */
export function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Parse a datetime-local input value ("YYYY-MM-DDTHH:MM") as wall time in tz. */
export function parseLocalDateTime(value: string, tz: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  return zonedTime(+m[1], +m[2], +m[3], +m[4], +m[5], tz);
}

/** Format a Date as a datetime-local input value in tz. */
export function toLocalInputValue(date: Date, tz: string) {
  const p = zonedParts(date, tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

// ---------------------------------------------------------------------------
// Display formatting
// ---------------------------------------------------------------------------

export function fmtDate(d: Date | string | null | undefined, tz: string, opts: Intl.DateTimeFormatOptions = {}) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-SG", { timeZone: tz, day: "numeric", month: "short", year: "numeric", ...opts }).format(
    typeof d === "string" ? new Date(d) : d,
  );
}

export function fmtDateTime(d: Date | null | undefined, tz: string) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-SG", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function fmtTime(d: Date, tz: string) {
  return new Intl.DateTimeFormat("en-SG", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(d);
}

export function fmtRange(start: Date, end: Date, tz: string) {
  return `${fmtDateTime(start, tz)} – ${fmtTime(end, tz)}`;
}

export function fmtRelative(d: Date, now = new Date()) {
  const diff = d.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < HOUR) return rtf.format(Math.round(diff / MINUTE), "minute");
  if (abs < DAY) return rtf.format(Math.round(diff / HOUR), "hour");
  if (abs < 30 * DAY) return rtf.format(Math.round(diff / DAY), "day");
  return rtf.format(Math.round(diff / (30 * DAY)), "month");
}

export function fmtCount(n: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}
