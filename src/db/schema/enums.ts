import { pgEnum } from "drizzle-orm/pg-core";

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
