import { pgTable, text, integer, timestamp, primaryKey, index } from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";
import { userStatus, userRole } from "./enums";

/** A text FK to users.id that cascades on delete. */
export const userRef = (name: string) => text(name).references(() => users.id, { onDelete: "cascade" });

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
    // AES-256-GCM ciphertext (FR-AUTH-3). Only src/server/google.ts decrypts.
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
