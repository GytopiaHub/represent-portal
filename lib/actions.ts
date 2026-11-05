"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { db, users, sessions, notifications, type UserStatus } from "@/db";
import { safeCallbackUrl } from "./access";
import { requireActiveUser, requireAdmin } from "./dal";
import { listCalendars } from "./google";
import { ADMIN_SET_LOCK } from "./locks";

// Server Actions are reachable by direct POST: every one re-checks the
// session through lib/dal.ts and validates its input.

export type ActionResult = { ok: true } | { ok: false; error: string };

class ActionError extends Error {}

function fail(err: unknown): ActionResult {
  if (err instanceof ActionError) return { ok: false, error: err.message };
  throw err;
}

function assertId(id: unknown): asserts id is string {
  if (typeof id !== "string" || id.length === 0 || id.length > 100) {
    throw new ActionError("Invalid user id");
  }
}

// ---------------------------------------------------------------------------
// Sign in / out
// ---------------------------------------------------------------------------

export async function signInWithGoogle(formData: FormData) {
  await signIn("google", { redirectTo: safeCallbackUrl(formData.get("callbackUrl")) });
}

/** FR-AUTH-4: re-run Google sign-in with consent to get a fresh refresh token. */
export async function reconnectGoogle(formData: FormData) {
  await requireActiveUser();
  await signIn("google", { redirectTo: safeCallbackUrl(formData.get("returnTo")) });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

// ---------------------------------------------------------------------------
// Onboarding (FR-AUTH-5)
// ---------------------------------------------------------------------------

export type OnboardingState = { error?: string; fieldErrors?: Record<string, string> };

const INSTAGRAM_RE = /^[A-Za-z0-9._]{1,30}$/;

export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const me = await requireActiveUser();

  const name = String(formData.get("name") ?? "").trim();
  const stageName = String(formData.get("stageName") ?? "").trim();
  const instagram = String(formData.get("instagramHandle") ?? "").trim().replace(/^@/, "");
  const calendarIds = formData.getAll("calendarIds").map(String);

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "Display name is required.";
  else if (name.length > 80) fieldErrors.name = "Keep it under 80 characters.";
  if (stageName.length > 80) fieldErrors.stageName = "Keep it under 80 characters.";
  if (instagram && !INSTAGRAM_RE.test(instagram)) {
    fieldErrors.instagramHandle = "Letters, numbers, dots and underscores only (max 30).";
  }
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  // Only accept calendar ids that actually belong to this user's Google account.
  let busyCalendarIds: string[] = [];
  if (calendarIds.length > 0) {
    const calendars = await listCalendars(me.id);
    if (calendars) {
      const allowed = new Set(calendars.map((c) => c.id));
      busyCalendarIds = calendarIds.filter((id) => allowed.has(id));
    }
  }

  await db
    .update(users)
    .set({
      name,
      stageName: stageName || null,
      instagramHandle: instagram || null,
      busyCalendarIds,
      onboardedAt: sql`coalesce(${users.onboardedAt}, now())`,
    })
    .where(eq(users.id, me.id));

  redirect("/");
}

// ---------------------------------------------------------------------------
// Notifications (FR-ADM-4)
// ---------------------------------------------------------------------------

export async function dismissNotification(id: number) {
  const me = await requireActiveUser();
  if (!Number.isInteger(id)) return;
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, me.id)));
  refresh();
}

// ---------------------------------------------------------------------------
// Admin: approvals (R-ROLE-2, FR-ADM-1)
// ---------------------------------------------------------------------------

async function setStatus(
  id: string,
  from: UserStatus[],
  to: UserStatus,
  adminId: string,
) {
  const [row] = await db
    .update(users)
    .set({ status: to, reviewedAt: new Date(), reviewedBy: adminId })
    .where(and(eq(users.id, id), inArray(users.status, from)))
    .returning({ id: users.id });
  if (!row) throw new ActionError("That user has already been dealt with.");
}

export async function approveUser(id: string): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    assertId(id);
    await db.transaction(async (tx) => {
      const [row] = await tx
        .update(users)
        .set({ status: "active", reviewedAt: new Date(), reviewedBy: admin.id })
        .where(and(eq(users.id, id), inArray(users.status, ["pending", "rejected"])))
        .returning({ id: users.id });
      if (!row) throw new ActionError("That user has already been dealt with.");
      await tx.insert(notifications).values({
        userId: id,
        kind: "approved",
        message: "You've been approved! Welcome to the crew.",
      });
    });
    refresh();
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function rejectUser(id: string): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    assertId(id);
    await setStatus(id, ["pending"], "rejected", admin.id);
    refresh();
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

// ---------------------------------------------------------------------------
// Admin: members (FR-ADM-2, R-ROLE-4, R-ROLE-5)
// ---------------------------------------------------------------------------

/**
 * Runs a change to one user under the admin-set lock, refusing it if it would
 * leave no active admin (R-ROLE-4).
 */
async function changeMember(
  id: string,
  change: { role?: "member" | "admin"; status?: UserStatus },
  opts: { allowedFrom: UserStatus[]; adminId: string; deleteSessions?: boolean },
) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${ADMIN_SET_LOCK})`);

    const [target] = await tx
      .select({ id: users.id, role: users.role, status: users.status })
      .from(users)
      .where(eq(users.id, id));
    if (!target) throw new ActionError("User not found.");
    if (!opts.allowedFrom.includes(target.status)) {
      throw new ActionError("That action doesn't apply to this user any more.");
    }

    const wasActiveAdmin = target.role === "admin" && target.status === "active";
    const willBeActiveAdmin =
      (change.role ?? target.role) === "admin" &&
      (change.status ?? target.status) === "active";
    if (wasActiveAdmin && !willBeActiveAdmin) {
      const admins = await tx.$count(
        users,
        and(eq(users.role, "admin"), eq(users.status, "active")),
      );
      if (admins <= 1) {
        throw new ActionError("You can't demote or remove the last remaining admin.");
      }
    }

    await tx
      .update(users)
      .set({ ...change, reviewedAt: new Date(), reviewedBy: opts.adminId })
      .where(eq(users.id, id));

    if (opts.deleteSessions) {
      await tx.delete(sessions).where(eq(sessions.userId, id));
    }
  });
}

export async function promoteToAdmin(id: string): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    assertId(id);
    await changeMember(id, { role: "admin" }, { allowedFrom: ["active"], adminId: admin.id });
    refresh();
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function demoteToMember(id: string): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    assertId(id);
    await changeMember(id, { role: "member" }, { allowedFrom: ["active"], adminId: admin.id });
    refresh();
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

/** Soft delete: history stays, sign-in is blocked, sessions are revoked. */
export async function removeMember(id: string): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    assertId(id);
    await changeMember(
      id,
      { status: "removed", role: "member" },
      { allowedFrom: ["active", "rejected"], adminId: admin.id, deleteSessions: true },
    );
    refresh();
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function restoreMember(id: string): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    assertId(id);
    await changeMember(id, { status: "active" }, { allowedFrom: ["removed"], adminId: admin.id });
    refresh();
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}
