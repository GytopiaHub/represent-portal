import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import type { Adapter, AdapterAccount } from "next-auth/adapters";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { and, eq, sql } from "drizzle-orm";
import {
  db,
  users,
  accounts,
  sessions,
  verificationTokens,
  type UserRole,
  type UserStatus,
} from "@/db";
import { encryptOptional } from "@/lib/crypto";
import { ADMIN_SET_LOCK } from "@/lib/locks";

// FR-AUTH-2
const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      status: UserStatus;
      role: UserRole;
      onboarded: boolean;
    } & DefaultSession["user"];
  }
}

type UserRow = typeof users.$inferSelect;

const drizzleAdapter = DrizzleAdapter(db, {
  usersTable: users,
  accountsTable: accounts,
  sessionsTable: sessions,
  verificationTokensTable: verificationTokens,
});

// FR-AUTH-3: tokens are encrypted before they ever reach the database.
const adapter: Adapter = {
  ...drizzleAdapter,
  async linkAccount(account: AdapterAccount) {
    await drizzleAdapter.linkAccount!({
      ...account,
      access_token: encryptOptional(account.access_token) ?? undefined,
      refresh_token: encryptOptional(account.refresh_token) ?? undefined,
      id_token: undefined, // not needed; don't keep PII-bearing tokens around
      token_error: account.refresh_token ? null : "missing_refresh_token",
    } as AdapterAccount);
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter,
  session: { strategy: "database" },
  providers: [
    Google({
      // Lets a pre-seeded user row (db/seeds/users.json) be claimed by the
      // matching Google account on first sign-in. Safe here because Google is
      // the only provider and it only returns verified emails.
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          scope: GOOGLE_SCOPES,
          access_type: "offline",
          prompt: "consent",
          include_granted_scopes: "true",
        },
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    // For returning users `user` is the database row. Removed members can no
    // longer sign in (R-ROLE-5).
    signIn({ user }) {
      if ((user as Partial<UserRow>).status === "removed") {
        return "/login?error=removed";
      }
      return true;
    },
    // Database sessions: `user` is re-read from the DB on every request, so
    // approvals, role changes and removals take effect immediately.
    session({ session, user }) {
      const u = user as unknown as UserRow;
      session.user = {
        ...session.user,
        id: u.id,
        status: u.status,
        role: u.role,
        onboarded: u.onboardedAt != null,
      };
      return session;
    },
  },
  events: {
    // R-ROLE-3: the first user on an empty database becomes an active admin.
    // The advisory lock serialises concurrent first sign-ins (and admin
    // demotions/removals, which take the same lock).
    async createUser({ user }) {
      if (!user.id) return;
      const userId = user.id;
      await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(${ADMIN_SET_LOCK})`);
        const [existingAdmin] = await tx
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.role, "admin"), eq(users.status, "active")))
          .limit(1);
        if (!existingAdmin) {
          await tx
            .update(users)
            .set({ status: "active", role: "admin", reviewedAt: new Date() })
            .where(eq(users.id, userId));
        }
      });
    },
    // A seeded user has no name/avatar until their Google account is linked.
    async linkAccount({ user, profile }) {
      if (!user.id) return;
      await db
        .update(users)
        .set({
          name: sql`coalesce(${users.name}, ${profile.name ?? null})`,
          image: sql`coalesce(${users.image}, ${profile.image ?? null})`,
        })
        .where(eq(users.id, user.id));
    },
    // Auth.js only calls linkAccount the first time. On later sign-ins
    // (including "Reconnect Google Calendar") store the fresh tokens and clear
    // any token error (FR-AUTH-4).
    async signIn({ account, isNewUser }) {
      if (!account || account.provider !== "google" || isNewUser) return;
      await db
        .update(accounts)
        .set({
          access_token: encryptOptional(account.access_token),
          expires_at: account.expires_at ?? null,
          scope: account.scope ?? null,
          token_type: account.token_type ?? null,
          id_token: null,
          ...(account.refresh_token
            ? { refresh_token: encryptOptional(account.refresh_token), token_error: null }
            : {}),
        })
        .where(
          and(
            eq(accounts.provider, "google"),
            eq(accounts.providerAccountId, account.providerAccountId),
          ),
        );
    },
  },
});
