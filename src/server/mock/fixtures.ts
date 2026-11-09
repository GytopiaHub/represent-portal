

// Fixture data shared by the seed script and the mock Google integrations.
// Everything here is fictional (SEC-7) — idol groups are public acts, but all
// RepresENT members, guests and videos are made up.

export const MOCK_CHANNEL_ID = "UC_mock_represent_channel";

/**
 * Placeholder channel profile for the public /explore page (FR-PUB-4). The
 * live version will come from YouTube `channels.list`; until then this is
 * hard-coded and made up.
 */
export const MOCK_CHANNEL_INFO = {
  title: "RepresENT",
  handle: "@represent.dance",
  description:
    "A K-pop dance cover crew from Singapore. New covers, dance-in-public videos and behind-the-scenes every month.",
  url: "https://www.youtube.com/@represent.dance",
  subscriberCount: 12_400,
  videoCount: 86,
  viewCount: 1_930_000,
};

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
