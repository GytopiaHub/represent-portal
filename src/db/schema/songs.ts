import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  boolean,
  date,
  timestamp,
  uuid,
  jsonb,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { userRef, users } from "./auth";
import { id, timestamps } from "./columns";
import { songStatus, crewRole, inviteStatus } from "./enums";
import { idolGroups, idolMembers } from "./groups";
import { guests } from "./guests";
import { youtubeVideos } from "./youtube";

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
