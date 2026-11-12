// Figures derived from the video list. Pure so they can be checked in isolation.

type VideoLike = { publishedAt: string; views: number };

const DAY = 86_400_000;

export function daysSince(iso: string, now: Date) {
  return Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / DAY));
}

export function median(values: number[]) {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

export function topBy<T>(items: T[], n: number, score: (item: T) => number) {
  return [...items].sort((a, b) => score(b) - score(a)).slice(0, n);
}

// Months are bucketed in the crew's time zone so a midnight upload in
// Singapore counts toward the month members expect.
const TZ = "Asia/Singapore";
const monthKey = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit" }).format(d);

export function uploadsPerMonth(videos: VideoLike[], now: Date, months = 12) {
  const counts = new Map<string, number>();
  for (const v of videos) {
    const k = monthKey(new Date(v.publishedAt));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const [y, m] = monthKey(now).split("-").map(Number);
  return Array.from({ length: months }, (_, i) => {
    const date = new Date(Date.UTC(y, m - 1 - (months - 1 - i), 15));
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    return {
      key,
      label: date.toLocaleDateString("en-SG", { month: "short", timeZone: "UTC" }),
      count: counts.get(key) ?? 0,
    };
  });
}

export function uploadsInYear(videos: VideoLike[], now: Date) {
  const year = monthKey(now).slice(0, 4);
  return videos.filter((v) => monthKey(new Date(v.publishedAt)).startsWith(year)).length;
}

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
export const formatCompact = (n: number) => (n < 10_000 ? n.toLocaleString("en") : compact.format(n));

export function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TZ,
  });
}
