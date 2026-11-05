import {
  pgTable,
  pgEnum,
  text,
  integer,
  timestamp,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

// ---------------------------------------------------------------------------
// Users, roles & status (§3.1)
// ---------------------------------------------------------------------------

/**
 * pending  – signed in, waiting for an admin (R-ROLE-1)
 * active   – approved member/admin
 * rejected – admin said no; can be re-approved later (R-ROLE-2)
 * removed  – soft-deleted; cannot sign in, history kept (R-ROLE-5)
 */
export const userStatus = pgEnum("user_status", [
  "pending",
  "active",
  "rejected",
  "removed",
]);
export const userRole = pgEnum("user_role", ["member", "admin"]);

export type UserStatus = (typeof userStatus.enumValues)[number];
export type UserRole = (typeof userRole.enumValues)[number];

// Auth.js Drizzle adapter tables (FR-AUTH-1). Column names for the adapter's
// own fields must stay as-is; the extra columns are ours.
export const users = pgTable(
  "users",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name"),
    email: text("email").unique(),
    emailVerified: timestamp("email_verified", { mode: "date" }),
    image: text("image"),

    status: userStatus("status").notNull().default("pending"),
    role: userRole("role").notNull().default("member"),

    // Onboarding (FR-AUTH-5)
    stageName: text("stage_name"),
    instagramHandle: text("instagram_handle"),
    busyCalendarIds: text("busy_calendar_ids").array().notNull().default([]),
    onboardedAt: timestamp("onboarded_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
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
    // access_token / refresh_token are AES-256-GCM ciphertext (FR-AUTH-3).
    // Only lib/google.ts decrypts them.
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
    // Set when the refresh token is missing or revoked (FR-AUTH-4).
    token_error: text("token_error"),
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
// In-app notifications (FR-ADM-4)
// ---------------------------------------------------------------------------

export const notifications = pgTable(
  "notifications",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    message: text("message").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (t) => [index("notifications_user_id_idx").on(t.userId)],
);
