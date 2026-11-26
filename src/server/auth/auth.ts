import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db, account, session, user, verification } from "@/db";
import { roleForEmail } from "@/lib/roles";
import { roleLists } from "./role-lists";

// BETTER_AUTH_SECRET and BETTER_AUTH_URL are read from the environment by Better Auth.
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Always offer the account picker so a shared device can switch accounts.
      prompt: "select_account",
    },
  },
  user: {
    // Runs on first sign-in and on every later Google sign-in, so someone
    // taken off the lists can't sign in again (SRS 6.4).
    validateUserInfo: ({ user: info }) => {
      if (!roleForEmail(info.email, roleLists())) {
        return { error: "not_on_list", errorDescription: "This Google account isn't on the crew list." };
      }
    },
  },
  onAPIError: { errorURL: "/login" },
  // nextCookies must be last so it sees cookies set by earlier plugins.
  plugins: [nextCookies()],
});
