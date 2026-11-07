import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  boolean,
  time,
  timestamp,
  jsonb,
  index,
  check,
} from "drizzle-orm/pg-core";
import { userRef } from "./auth";
import { id, timestamps } from "./columns";

// ---------------------------------------------------------------------------
// Notifications, settings, jobs
// ---------------------------------------------------------------------------

export type NotificationPayload = { title: string; body?: string; href?: string };

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: userRef("user_id").notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<NotificationPayload>().notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.readAt)],
);

export const appSettings = pgTable(
  "app_settings",
  {
    id: integer("id").primaryKey().default(1),
    youtubeChannelId: text("youtube_channel_id"),
    syncTimeSgt: time("sync_time_sgt").notNull().default("04:00"),
    defaultPracticeMinutes: integer("default_practice_minutes").notNull().default(120),
    defaultFilmingMinutes: integer("default_filming_minutes").notNull().default(180),
    availWindowStart: time("avail_window_start").notNull().default("09:00"),
    availWindowEnd: time("avail_window_end").notNull().default("23:00"),
    lookaheadWeeks: integer("lookahead_weeks").notNull().default(8),
    defaultTimezone: text("default_timezone").notNull().default("Asia/Singapore"),
    lastYoutubeSyncAt: timestamp("last_youtube_sync_at", { withTimezone: true }),
    lastTickAt: timestamp("last_tick_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [check("app_settings_single_row", sql`${t.id} = 1`)],
);

export type SyncSummary = {
  added?: number;
  updated?: number;
  snapshots?: number;
  errors?: string[];
  [key: string]: unknown;
};

export const syncRuns = pgTable("sync_runs", {
  id: id(),
  kind: text("kind").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  ok: boolean("ok"),
  summary: jsonb("summary").$type<SyncSummary>().notNull().default({}),
  ...timestamps,
});
