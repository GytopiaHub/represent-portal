import "server-only";
import { and, asc, desc, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import { db, users, notifications } from "@/db";
import { requireActiveUser, requireAdmin } from "./dal";
import { getGoogleTokenError, listCalendars } from "./google";

// Every exported function here starts with a DAL guard (R-ROLE-1).

// ---------------------------------------------------------------------------
// Current user
// ---------------------------------------------------------------------------

export async function getMyProfile() {
  const me = await requireActiveUser();
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      role: users.role,
      stageName: users.stageName,
      instagramHandle: users.instagramHandle,
      busyCalendarIds: users.busyCalendarIds,
      onboardedAt: users.onboardedAt,
    })
    .from(users)
    .where(eq(users.id, me.id));
  return row;
}

export async function getMyUnreadNotifications() {
  const me = await requireActiveUser();
  return db
    .select({
      id: notifications.id,
      kind: notifications.kind,
      message: notifications.message,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(and(eq(notifications.userId, me.id), isNull(notifications.readAt)))
    .orderBy(desc(notifications.createdAt));
}

/** null when connected; otherwise an error code and the user should reconnect. */
export async function getMyGoogleTokenError() {
  const me = await requireActiveUser();
  return getGoogleTokenError(me.id);
}

export async function getMyCalendars() {
  const me = await requireActiveUser();
  return listCalendars(me.id);
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

const memberColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  image: users.image,
  status: users.status,
  role: users.role,
  stageName: users.stageName,
  createdAt: users.createdAt,
  reviewedAt: users.reviewedAt,
};

export type MemberRow = Awaited<ReturnType<typeof searchMembers>>[number];

export async function getPendingApprovalCount(): Promise<number> {
  await requireAdmin();
  return db.$count(users, eq(users.status, "pending"));
}

export async function getApprovalQueue() {
  await requireAdmin();
  const rows = await db
    .select(memberColumns)
    .from(users)
    .where(inArray(users.status, ["pending", "rejected"]))
    .orderBy(asc(users.createdAt));
  return {
    pending: rows.filter((r) => r.status === "pending"),
    rejected: rows.filter((r) => r.status === "rejected"),
  };
}

export async function searchMembers(query: string) {
  await requireAdmin();
  const q = query.trim();
  const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return db
    .select(memberColumns)
    .from(users)
    .where(
      and(
        inArray(users.status, ["active", "removed"]),
        q
          ? or(
              ilike(users.name, pattern),
              ilike(users.email, pattern),
              ilike(users.stageName, pattern),
            )
          : undefined,
      ),
    )
    .orderBy(asc(users.status), desc(users.role), asc(users.name));
}
