import type { Session } from "next-auth";

// Single source of truth for "where is this user allowed to be?".
// Used by proxy.ts (redirects) and src/server/auth-guards.ts (enforcement next to the data).

export type SessionUser = Session["user"];

export const LOGIN_PATH = "/login";
export const PENDING_PATH = "/pending";
export const NOT_APPROVED_PATH = "/not-approved";
export const ONBOARDING_PATH = "/onboarding";

/** The only page a non-active user may see, or null if they're active. */
export function gatePathFor(user: SessionUser | null | undefined): string | null {
  if (!user || user.status === "removed") return LOGIN_PATH;
  if (user.status === "pending") return PENDING_PATH;
  if (user.status === "rejected") return NOT_APPROVED_PATH;
  return null;
}

/** Where to send a user who lands somewhere they shouldn't be. */
export function homePathFor(user: SessionUser | null | undefined): string {
  const gate = gatePathFor(user);
  if (gate) return gate;
  if (!user!.onboarded) return ONBOARDING_PATH;
  return "/";
}

/** Only allow same-origin relative redirects after sign-in. */
export function safeCallbackUrl(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}
