import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  text,
  integer,
  bigint,
  boolean,
  date,
  time,
  timestamp,
  uuid,
  jsonb,
  primaryKey,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

// SRS §5. Times are timestamptz (UTC); display happens in the viewer's zone.

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(() => new Date()),
};
const id = () => uuid("id").primaryKey().defaultRandom();
const userRef = (name: string) => text(name).references(() => users.id, { onDelete: "cascade" });

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const userStatus = pgEnum("user_status", ["pending", "active", "rejected", "removed"]);
export const userRole = pgEnum("user_role", ["member", "admin"]);
export const groupType = pgEnum("group_type", [
  "boy_group",
  "girl_group",
  "co_ed",
  "male_solo",
  "female_solo",
]);
export const requestStatus = pgEnum("group_request_status", ["open", "done", "rejected"]);
export const songStatus = pgEnum("song_status", [
  "recruiting",
  "practising",
  "filming",
  "editing",
  "posted",
  "cancelled",
]);
export const crewRole = pgEnum("crew_role", ["ic", "dancer", "videographer", "editor"]);
export const inviteStatus = pgEnum("invite_status", ["pending", "accepted", "declined", "cancelled"]);
export const sessionKind = pgEnum("session_kind", ["practice", "filming"]);
export const bookingStatus = pgEnum("booking_status", ["not_needed", "to_book", "booked"]);
export const schedStatus = pgEnum("sched_status", ["scheduled", "cancelled"]);
export const rsvpResponse = pgEnum("rsvp_response", ["going", "not_going"]);
export const calSyncState = pgEnum("cal_sync_state", ["ok", "pending", "failed"]);
export const overrideKind = pgEnum("override_kind", ["busy", "free"]);
export const recurrence = pgEnum("recurrence", ["none", "weekly"]);
export const backfillState = pgEnum("backfill_state", ["untagged", "tagged", "ignored"]);

export type UserStatus = (typeof userStatus.enumValues)[number];
export type UserRole = (typeof userRole.enumValues)[number];
export type GroupType = (typeof groupType.enumValues)[number];
export type SongStatus = (typeof songStatus.enumValues)[number];
export type CrewRole = (typeof crewRole.enumValues)[number];
export type SessionKind = (typeof sessionKind.enumValues)[number];
export type BookingStatus = (typeof bookingStatus.enumValues)[number];

// ---------------------------------------------------------------------------
// Auth.js tables (extended)
// ---------------------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text("name"), // display name
    email: text("email").unique(),
    emailVerified: timestamp("email_verified", { mode: "date" }),
    image: text("image"),

    status: userStatus("status").notNull().default("pending"),
    role: userRole("role").notNull().default("member"),
    stageName: text("stage_name"),
    instagramHandle: text("instagram_handle"),
    timezone: text("timezone").notNull().default("Asia/Singapore"),
    onboardedAt: timestamp("onboarded_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: text("reviewed_by"),
  },
  (t) => [index("users_status_idx").on(t.status)],
);

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    // AES-256-GCM ciphertext (FR-AUTH-3). Only lib/google.ts decrypts.
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
    token_error: text("token_error"), // FR-AUTH-4
  },
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index("accounts_user_id_idx").on(t.userId),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    sessionToken: text("session_token").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

export const memberCalendars = pgTable(
  "member_calendars",
  {
    id: id(),
    userId: userRef("user_id").notNull(),
    googleCalendarId: text("google_calendar_id").notNull(),
    summary: text("summary").notNull(),
    includeInBusy: boolean("include_in_busy").notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex("member_calendars_user_cal_uq").on(t.userId, t.googleCalendarId)],
);

export const availOverrides = pgTable(
  "avail_overrides",
  {
    id: id(),
    userId: userRef("user_id").notNull(),
    kind: overrideKind("kind").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    recurrence: recurrence("recurrence").notNull().default("none"),
    recurrenceUntil: date("recurrence_until"),
    note: text("note"),
    ...timestamps,
  },
  (t) => [index("avail_overrides_user_idx").on(t.userId)],
);

export type BusyInterval = { start: string; end: string };

export const freebusyCache = pgTable(
  "freebusy_cache",
  {
    id: id(),
    userId: userRef("user_id").notNull(),
    rangeStart: timestamp("range_start", { withTimezone: true }).notNull(),
    rangeEnd: timestamp("range_end", { withTimezone: true }).notNull(),
    busy: jsonb("busy").$type<BusyInterval[]>().notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [uniqueIndex("freebusy_cache_uq").on(t.userId, t.rangeStart, t.rangeEnd)],
);

// ---------------------------------------------------------------------------
// Idol groups
// ---------------------------------------------------------------------------

export const idolGroups = pgTable("idol_groups", {
  id: id(),
  name: text("name").notNull(),
  nameKr: text("name_kr"),
  groupType: groupType("group_type").notNull(),
  imageUrl: text("image_url"),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});

export const idolMembers = pgTable(
  "idol_members",
  {
    id: id(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => idolGroups.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    romanisation: text("romanisation"),
    imageUrl: text("image_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [index("idol_members_group_idx").on(t.groupId)],
);

export const groupRequests = pgTable("group_requests", {
  id: id(),
  requestedBy: userRef("requested_by").notNull(),
  name: text("name").notNull(),
  note: text("note"),
  status: requestStatus("status").notNull().default("open"),
  ...timestamps,
});

// ---------------------------------------------------------------------------
// Guests
// ---------------------------------------------------------------------------

export const guests = pgTable("guests", {
  id: id(),
  name: text("name").notNull(),
  instagram: text("instagram"),
  contactNote: text("contact_note"),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
});

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

// ---------------------------------------------------------------------------
// Songs & crews
// ---------------------------------------------------------------------------

export type ReferenceLink = { label: string; url: string };

export const songs = pgTable(
  "songs",
  {
    id: id(),
    title: text("title").notNull(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => idolGroups.id),
    status: songStatus("status").notNull().default("recruiting"),
    targetPostDate: date("target_post_date"),
    description: text("description"),
    referenceLinks: jsonb("reference_links").$type<ReferenceLink[]>().notNull().default([]),
    youtubeVideoId: uuid("youtube_video_id")
      .unique()
      .references(() => youtubeVideos.id, { onDelete: "set null" }),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    isBackfill: boolean("is_backfill").notNull().default(false),
    ...timestamps,
  },
  (t) => [index("songs_group_idx").on(t.groupId), index("songs_status_idx").on(t.status)],
);

export const songPositions = pgTable(
  "song_positions",
  {
    id: id(),
    songId: uuid("song_id")
      .notNull()
      .references(() => songs.id, { onDelete: "cascade" }),
    idolMemberId: uuid("idol_member_id").references(() => idolMembers.id),
    customLabel: text("custom_label"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index("song_positions_song_idx").on(t.songId),
    check(
      "song_positions_one_of",
      sql`(${t.idolMemberId} is null) <> (${t.customLabel} is null)`,
    ),
  ],
);

export const songAssignments = pgTable(
  "song_assignments",
  {
    id: id(),
    songId: uuid("song_id")
      .notNull()
      .references(() => songs.id, { onDelete: "cascade" }),
    role: crewRole("role").notNull(),
    positionId: uuid("position_id").references(() => songPositions.id, { onDelete: "cascade" }),
    userId: userRef("user_id"),
    guestId: uuid("guest_id").references(() => guests.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [
    index("song_assignments_song_idx").on(t.songId),
    index("song_assignments_user_idx").on(t.userId),
    // One assignee per dance position (§3.2).
    uniqueIndex("song_assignments_position_uq").on(t.positionId).where(sql`${t.positionId} is not null`),
    check("song_assignments_one_holder", sql`(${t.userId} is null) <> (${t.guestId} is null)`),
    check(
      "song_assignments_position_dancer",
      sql`${t.positionId} is null or ${t.role} = 'dancer'`,
    ),
  ],
);

export const songInvitations = pgTable(
  "song_invitations",
  {
    id: id(),
    songId: uuid("song_id")
      .notNull()
      .references(() => songs.id, { onDelete: "cascade" }),
    role: crewRole("role").notNull(),
    positionId: uuid("position_id").references(() => songPositions.id, { onDelete: "cascade" }),
    inviteeUserId: userRef("invitee_user_id").notNull(),
    invitedBy: text("invited_by").references(() => users.id, { onDelete: "set null" }),
    status: inviteStatus("status").notNull().default("pending"),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("song_invitations_invitee_idx").on(t.inviteeUserId),
    index("song_invitations_song_idx").on(t.songId),
  ],
);

// ---------------------------------------------------------------------------
// Practices & filming
// ---------------------------------------------------------------------------

export const sessionsSched = pgTable(
  "sessions_sched",
  {
    id: id(),
    songId: uuid("song_id")
      .notNull()
      .references(() => songs.id, { onDelete: "cascade" }),
    kind: sessionKind("kind").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    locationText: text("location_text"),
    locationUrl: text("location_url"),
    bookingStatus: bookingStatus("booking_status").notNull().default("not_needed"),
    bookingRef: text("booking_ref"),
    notes: text("notes"),
    referenceLinks: jsonb("reference_links").$type<ReferenceLink[]>().notNull().default([]),
    checklist: text("checklist"),
    status: schedStatus("status").notNull().default("scheduled"),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    index("sessions_sched_song_idx").on(t.songId),
    index("sessions_sched_starts_idx").on(t.startsAt),
  ],
);

export const filmingLocations = pgTable("filming_locations", {
  id: id(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => sessionsSched.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  mapUrl: text("map_url"),
  notes: text("notes"),
  isFinal: boolean("is_final").notNull().default(false),
  ...timestamps,
});

export const sessionVideographers = pgTable(
  "session_videographers",
  {
    id: id(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessionsSched.id, { onDelete: "cascade" }),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => songAssignments.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("session_videographers_uq").on(t.sessionId, t.assignmentId)],
);

export const sessionRsvps = pgTable(
  "session_rsvps",
  {
    id: id(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessionsSched.id, { onDelete: "cascade" }),
    userId: userRef("user_id").notNull(),
    response: rsvpResponse("response").notNull(),
    reason: text("reason"),
    ...timestamps,
  },
  (t) => [uniqueIndex("session_rsvps_uq").on(t.sessionId, t.userId)],
);

export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: id(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessionsSched.id, { onDelete: "cascade" }),
    userId: userRef("user_id").notNull(),
    googleEventId: text("google_event_id"),
    syncState: calSyncState("sync_state").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("calendar_events_uq").on(t.sessionId, t.userId)],
);

export const sessionReminders = pgTable(
  "session_reminders",
  {
    id: id(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessionsSched.id, { onDelete: "cascade" }),
    userId: userRef("user_id").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [uniqueIndex("session_reminders_uq").on(t.sessionId, t.userId)],
);

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
