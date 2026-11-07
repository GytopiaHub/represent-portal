import "server-only";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { db, notifications, songAssignments, users, type NotificationPayload } from "@/db";
import type { Conn } from "@/db/types";

// In-app notifications (FR-NOT-2). Types are free text so new triggers don't
// need a migration; the payload carries the rendered title/body/link.

export type NotificationType =
  | "approved"
  | "signup_pending"
  | "invited"
  | "invite_response"
  | "crew_removed"
  | "session_created"
  | "session_changed"
  | "session_cancelled"
  | "rsvp_needed"
  | "song_status"
  | "group_requested"
  | "calendar_failed";

export async function notify(
  userIds: (string | null | undefined)[],
  type: NotificationType,
  payload: NotificationPayload,
  conn: Conn = db,
) {
  const ids = [...new Set(userIds.filter((x): x is string => !!x))];
  if (ids.length === 0) return;
  await conn.insert(notifications).values(ids.map((userId) => ({ userId, type, payload })));
}

export async function adminIds(conn: Conn = db) {
  const rows = await conn
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.status, "active")));
  return rows.map((r) => r.id);
}

export async function notifyAdmins(type: NotificationType, payload: NotificationPayload, conn: Conn = db) {
  await notify(await adminIds(conn), type, payload, conn);
}

/** Unread count for the bell. Callers must have authorised access to `userId`. */
export function countUnread(userId: string) {
  return db.$count(notifications, and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}

/** Member (not guest) user ids on a song, optionally limited to roles. */
export async function songMemberIds(
  songId: string,
  roles?: ("ic" | "dancer" | "videographer" | "editor")[],
  conn: Conn = db,
) {
  const rows = await conn
    .selectDistinct({ id: songAssignments.userId })
    .from(songAssignments)
    .where(
      and(
        eq(songAssignments.songId, songId),
        isNotNull(songAssignments.userId),
        roles ? inArray(songAssignments.role, roles) : undefined,
      ),
    );
  return rows.map((r) => r.id!);
}
