import "server-only";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import { db, songAssignments, users } from "@/db";
import { LOGIN_PATH, gatePathFor, type SessionUser } from "@/lib/access";
import { DEFAULT_TZ } from "@/lib/time";

// Authorization layer (SEC-1). Every data function and Server Action starts
// with one of these guards; proxy.ts is only for UX.
//
// auth() re-reads the user row from the database on every request (database
// session strategy), so status changes apply immediately.

/** Thrown for "you can't do that" — Server Actions turn it into an error message. */
export class ForbiddenError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  return session?.user ?? null;
});

/** Any signed-in user, whatever their status (for the status screens). */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || user.status === "removed") redirect(LOGIN_PATH);
  return user;
}

/** An approved member or admin. */
export async function requireActiveUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  const gate = gatePathFor(user);
  if (gate) redirect(gate);
  return user!;
}

/** An approved admin. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireActiveUser();
  if (user.role !== "admin") redirect("/");
  return user;
}

/** The active user may only act on their own records. */
export async function requireSelf(userId: string): Promise<SessionUser> {
  const user = await requireActiveUser();
  if (user.id !== userId) throw new ForbiddenError();
  return user;
}

/** True if the user is an IC of the song or an admin. */
export async function canEditSong(user: SessionUser, songId: string): Promise<boolean> {
  if (user.role === "admin") return true;
  const [row] = await db
    .select({ id: songAssignments.id })
    .from(songAssignments)
    .where(
      and(
        eq(songAssignments.songId, songId),
        eq(songAssignments.userId, user.id),
        eq(songAssignments.role, "ic"),
      ),
    )
    .limit(1);
  return !!row;
}

/** An IC of the song, or an admin (SEC-1). */
export async function requireSongEditor(songId: string): Promise<SessionUser> {
  const user = await requireActiveUser();
  if (!(await canEditSong(user, songId))) {
    throw new ForbiddenError("Only this song's ICs or an admin can do that.");
  }
  return user;
}

export type Viewer = SessionUser & { tz: string };

/** The active user plus their display time zone. */
export const getViewer = cache(async (): Promise<Viewer> => {
  const user = await requireActiveUser();
  const [row] = await db.select({ tz: users.timezone }).from(users).where(eq(users.id, user.id));
  return { ...user, tz: row?.tz ?? DEFAULT_TZ };
});

/**
 * Route Handler guard: JSON 401/403 instead of a redirect (AC-1).
 * Returns the active user, or a Response to send back.
 */
export async function activeUserOrResponse() {
  const user = await getSessionUser();
  if (!user) return { response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  if (user.status !== "active") return { response: Response.json({ error: "Forbidden" }, { status: 403 }) };
  return { user };
}
