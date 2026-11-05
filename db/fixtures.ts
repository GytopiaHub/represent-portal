// Fixture data shared by the seed script and the mock Google integrations.
// Everything here is fictional (SEC-7) — idol groups are public acts, but all
// RepresENT members, guests and videos are made up.

export const MOCK_CHANNEL_ID = "UC_mock_represent_channel";

/** Calendars every mock Google account has (FR-AUTH-5 calendarList). */
export const MOCK_CALENDARS = [
  { id: "primary", summary: "Personal", primary: true, backgroundColor: "#ec4899" },
  { id: "work", summary: "Work", primary: false, backgroundColor: "#8b5cf6" },
  { id: "school", summary: "Uni timetable", primary: false, backgroundColor: "#06b6d4" },
  { id: "sg-holidays", summary: "Holidays in Singapore", primary: false, backgroundColor: "#64748b" },
] as const;

/**
 * Uploads that exist on the mock channel but are NOT seeded into the
 * database, so the first "Sync YouTube now" imports them (AC-6).
 * `daysAgo` is relative to the sync run.
 */
export const MOCK_NEW_UPLOADS = [
  {
    videoId: "mockNEW0001",
    title: "[KPOP IN PUBLIC] KISS OF LIFE 'Sticky' Dance Cover by RepresENT",
    daysAgo: 1,
    views: 1840,
    likes: 162,
    comments: 21,
  },
  {
    videoId: "mockNEW0002",
    title: "RepresENT Year-End Showcase Vlog 🎄",
    daysAgo: 0,
    views: 420,
    likes: 55,
    comments: 9,
  },
];

/** Small deterministic PRNG so mock data is stable between reloads. */
export function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seededRandom(seed: string) {
  let a = hashString(seed) || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
