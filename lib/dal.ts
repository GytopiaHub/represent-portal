import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LOGIN_PATH, gatePathFor, type SessionUser } from "./access";

// Data Access Layer. Every data function and Server Action starts with one of
// these guards, so a pending/rejected/removed user can't read or change
// anything even if they bypass proxy.ts (R-ROLE-1).
//
// auth() re-reads the user row from the database on every request (database
// session strategy), so status changes apply immediately.

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
