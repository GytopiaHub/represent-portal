import {
  pgTable,
  text,
  boolean,
  date,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { userRef } from "./auth";
import { id, timestamps } from "./columns";
import { overrideKind, recurrence } from "./enums";

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
