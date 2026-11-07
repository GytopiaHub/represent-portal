import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, notifications } from "@/db";
import { requireActiveUser } from "@/server/auth-guards";
import { countUnread } from "@/server/notify";

export async function getMyNotifications(limit = 50) {
  const me = await requireActiveUser();
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, me.id))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function getMyUnreadCount() {
  const me = await requireActiveUser();
  return countUnread(me.id);
}

/** Unread "You've been approved" style banners for the top of the app (FR-ADM-4). */
export async function getMyBannerNotifications() {
  const me = await requireActiveUser();
  return db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, me.id), eq(notifications.type, "approved"), isNull(notifications.readAt)));
}
