import "server-only";
import { and, eq } from "drizzle-orm";
import { db, accounts } from "@/db";
import { decrypt, encrypt } from "./crypto";

// The only place OAuth tokens are decrypted (FR-AUTH-3).
// Callers must already have authorised access to `userId` via lib/dal.ts.

export class GoogleAuthError extends Error {
  constructor(public readonly code: string) {
    super(`Google authorisation unavailable: ${code}`);
    this.name = "GoogleAuthError";
  }
}

type AccountRow = typeof accounts.$inferSelect;

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const EXPIRY_SKEW_MS = 60_000;

async function getGoogleAccount(userId: string): Promise<AccountRow | undefined> {
  const [row] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, "google")))
    .limit(1);
  return row;
}

async function markTokenError(acct: AccountRow, code: string) {
  await db
    .update(accounts)
    .set({ token_error: code })
    .where(
      and(
        eq(accounts.provider, acct.provider),
        eq(accounts.providerAccountId, acct.providerAccountId),
      ),
    );
}

async function refreshAccessToken(acct: AccountRow): Promise<string> {
  if (!acct.refresh_token) {
    await markTokenError(acct, "missing_refresh_token");
    throw new GoogleAuthError("missing_refresh_token");
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID!,
      client_secret: process.env.AUTH_GOOGLE_SECRET!,
      grant_type: "refresh_token",
      refresh_token: decrypt(acct.refresh_token),
    }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    scope?: string;
    error?: string;
  };

  if (!res.ok || !body.access_token) {
    const code = body.error ?? `http_${res.status}`;
    // invalid_grant = refresh token revoked or expired; only a new consent
    // fixes it. Other errors (network, 5xx) are transient: don't flag.
    if (code === "invalid_grant") await markTokenError(acct, code);
    throw new GoogleAuthError(code);
  }

  await db
    .update(accounts)
    .set({
      access_token: encrypt(body.access_token),
      expires_at: Math.floor(Date.now() / 1000) + (body.expires_in ?? 3600),
      ...(body.refresh_token ? { refresh_token: encrypt(body.refresh_token) } : {}),
      ...(body.scope ? { scope: body.scope } : {}),
      token_error: null,
    })
    .where(
      and(
        eq(accounts.provider, acct.provider),
        eq(accounts.providerAccountId, acct.providerAccountId),
      ),
    );

  return body.access_token;
}

export type GoogleClient = {
  /** Authenticated fetch against a Google API URL. Retries once after a 401. */
  fetch(url: string, init?: RequestInit): Promise<Response>;
};

/**
 * Returns an authenticated Google API client for the user, refreshing (and
 * persisting) the access token if it has expired.
 * Throws GoogleAuthError if the user needs to reconnect (FR-AUTH-4).
 */
export async function googleClient(userId: string): Promise<GoogleClient> {
  const acct = await getGoogleAccount(userId);
  if (!acct) throw new GoogleAuthError("no_account");
  if (acct.token_error) throw new GoogleAuthError(acct.token_error);

  const fresh =
    acct.access_token &&
    acct.expires_at &&
    acct.expires_at * 1000 > Date.now() + EXPIRY_SKEW_MS;
  let accessToken = fresh ? decrypt(acct.access_token!) : await refreshAccessToken(acct);

  const doFetch = (url: string, init?: RequestInit) =>
    fetch(url, {
      ...init,
      cache: "no-store",
      headers: { ...init?.headers, Authorization: `Bearer ${accessToken}` },
    });

  return {
    async fetch(url, init) {
      let res = await doFetch(url, init);
      if (res.status === 401) {
        accessToken = await refreshAccessToken(acct);
        res = await doFetch(url, init);
      }
      return res;
    },
  };
}

/** Whether the user's Google connection needs a reconnect (FR-AUTH-4). */
export async function getGoogleTokenError(userId: string): Promise<string | null> {
  const acct = await getGoogleAccount(userId);
  if (!acct) return "no_account";
  return acct.token_error;
}

export type GoogleCalendar = {
  id: string;
  summary: string;
  primary: boolean;
  backgroundColor?: string;
};

/**
 * The user's calendars, or null if their Google connection is broken
 * (callers should treat availability as "unknown").
 */
export async function listCalendars(userId: string): Promise<GoogleCalendar[] | null> {
  try {
    const client = await googleClient(userId);
    const res = await client.fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=freeBusyReader",
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      items?: { id: string; summary?: string; summaryOverride?: string; primary?: boolean; backgroundColor?: string }[];
    };
    return (data.items ?? [])
      .map((c) => ({
        id: c.id,
        summary: c.summaryOverride ?? c.summary ?? c.id,
        primary: !!c.primary,
        backgroundColor: c.backgroundColor,
      }))
      .sort((a, b) => Number(b.primary) - Number(a.primary) || a.summary.localeCompare(b.summary));
  } catch (err) {
    if (err instanceof GoogleAuthError) return null;
    throw err;
  }
}
