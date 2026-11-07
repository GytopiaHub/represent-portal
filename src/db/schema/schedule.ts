import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  uuid,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { userRef, users } from "./auth";
import { id, timestamps } from "./columns";
import { sessionKind, bookingStatus, schedStatus, rsvpResponse, calSyncState } from "./enums";
import { type ReferenceLink, songAssignments, songs } from "./songs";

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
