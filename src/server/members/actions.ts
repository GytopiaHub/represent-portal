"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { db, sessions, users, type UserStatus } from "@/db";
import { ADMIN_SET_LOCK } from "@/db/locks";
import type { ActionResult } from "@/lib/action-result";
import { UserError, parse, run, zUserId } from "@/server/action";
import { requireAdmin } from "@/server/auth-guards";
import { notify } from "@/server/notify";

// ---------------------------------------------------------------------------
// Approvals (R-ROLE-2, FR-ADM-1, FR-ADM-4)
// ---------------------------------------------------------------------------

export async function approveUser(id: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin();
    const userId = parse(zUserId, id);
    await db.transaction(async (tx) => {
      const [row] = await tx
        .update(users)
        .set({ status: "active", reviewedAt: new Date(), reviewedBy: admin.id })
        .where(and(eq(users.id, userId), inArray(users.status, ["pending", "rejected"])))
        .returning({ id: users.id });
      if (!row) throw new UserError("That user has already been dealt with.");
      await notify([userId], "approved", { title: "You've been approved!", body: "Welcome to RepresENT 🎉", href: "/" }, tx);
    });
    refresh();
  });
}

export async function rejectUser(id: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin();
    const userId = parse(zUserId, id);
    const [row] = await db
      .update(users)
      .set({ status: "rejected", reviewedAt: new Date(), reviewedBy: admin.id })
      .where(and(eq(users.id, userId), eq(users.status, "pending")))
      .returning({ id: users.id });
    if (!row) throw new UserError("That user has already been dealt with.");
    refresh();
  });
}

// ---------------------------------------------------------------------------
// Members (FR-ADM-2, R-ROLE-4, R-ROLE-5)
// ---------------------------------------------------------------------------

/** Change one user under the admin-set lock; refuse to leave zero admins (R-ROLE-4). */
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
    if (!target) throw new UserError("User not found.");
    if (!opts.allowedFrom.includes(target.status)) {
      throw new UserError("That action doesn't apply to this user any more.");
    }
    const wasActiveAdmin = target.role === "admin" && target.status === "active";
    const willBeActiveAdmin =
      (change.role ?? target.role) === "admin" && (change.status ?? target.status) === "active";
    if (wasActiveAdmin && !willBeActiveAdmin) {
      const admins = await tx.$count(users, and(eq(users.role, "admin"), eq(users.status, "active")));
      if (admins <= 1) throw new UserError("You can't demote or remove the last remaining admin.");
    }
    await tx
      .update(users)
      .set({ ...change, reviewedAt: new Date(), reviewedBy: opts.adminId })
      .where(eq(users.id, id));
    if (opts.deleteSessions) await tx.delete(sessions).where(eq(sessions.userId, id));
  });
}

export async function promoteToAdmin(id: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin();
    await changeMember(parse(zUserId, id), { role: "admin" }, { allowedFrom: ["active"], adminId: admin.id });
    refresh();
  });
}

export async function demoteToMember(id: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin();
    await changeMember(parse(zUserId, id), { role: "member" }, { allowedFrom: ["active"], adminId: admin.id });
    refresh();
  });
}

/** Soft delete: history stays, sign-in is blocked, sessions are revoked. */
export async function removeMember(id: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin();
    await changeMember(
      parse(zUserId, id),
      { status: "removed", role: "member" },
      { allowedFrom: ["active", "rejected"], adminId: admin.id, deleteSessions: true },
    );
    refresh();
  });
}

export async function restoreMember(id: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin();
    await changeMember(parse(zUserId, id), { status: "active" }, { allowedFrom: ["removed"], adminId: admin.id });
    refresh();
  });
}
