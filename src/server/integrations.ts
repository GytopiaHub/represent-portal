import "server-only";

/**
 * Which Google APIs to talk to.
 *
 * - "mock" (default): Calendar FreeBusy/calendarList/event writes and the
 *   YouTube channel are simulated from seeded data (src/server/mock/), so the
 *   whole app can be explored before the APIs are wired up.
 * - "live": call the real Google APIs. Set GOOGLE_APIS=live once the OAuth
 *   app has the Calendar API enabled and YOUTUBE_API_KEY is set.
 */
export const GOOGLE_APIS_MODE: "mock" | "live" =
  process.env.GOOGLE_APIS === "live" ? "live" : "mock";

export const isMockGoogle = GOOGLE_APIS_MODE === "mock";
