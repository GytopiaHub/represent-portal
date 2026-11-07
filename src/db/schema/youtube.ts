import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  bigint,
  date,
  timestamp,
  uuid,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { id, timestamps } from "./columns";
import { backfillState } from "./enums";

// ---------------------------------------------------------------------------
// YouTube
// ---------------------------------------------------------------------------

export const youtubeVideos = pgTable(
  "youtube_videos",
  {
    id: id(),
    videoId: text("video_id").notNull().unique(),
    title: text("title").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    thumbnailUrl: text("thumbnail_url"),
    duration: text("duration"),
    viewCount: bigint("view_count", { mode: "number" }).notNull().default(0),
    likeCount: bigint("like_count", { mode: "number" }).notNull().default(0),
    commentCount: bigint("comment_count", { mode: "number" }).notNull().default(0),
    statsUpdatedAt: timestamp("stats_updated_at", { withTimezone: true }),
    backfillState: backfillState("backfill_state").notNull().default("untagged"),
    ...timestamps,
  },
  (t) => [index("youtube_videos_title_trgm").using("gin", sql`${t.title} gin_trgm_ops`)],
);

export const videoStatsHistory = pgTable(
  "video_stats_history",
  {
    id: id(),
    videoId: uuid("video_id")
      .notNull()
      .references(() => youtubeVideos.id, { onDelete: "cascade" }),
    capturedOn: date("captured_on").notNull(),
    viewCount: bigint("view_count", { mode: "number" }).notNull(),
    likeCount: bigint("like_count", { mode: "number" }).notNull(),
    commentCount: bigint("comment_count", { mode: "number" }).notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("video_stats_history_uq").on(t.videoId, t.capturedOn)],
);
