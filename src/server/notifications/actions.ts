"use server";

import { and, eq, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { db, notifications } from "@/db";
import { safeCallbackUrl } from "@/lib/access";
import { parse, zId } from "@/server/action";
import { requireActiveUser } from "@/server/auth-guards";

// ---------------------------------------------------------------------------
// Notifications (FR-NOT-1)
// ---------------------------------------------------------------------------

export async function markNotificationRead(id: string) {
  const me = await requireActiveUser();
  const nid = parse(zId, id);
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, nid), eq(notifications.userId, me.id)));
  refresh();
}

/** Mark read and follow the notification's link. */
export async function openNotification(id: string) {
  const me = await requireActiveUser();
  const nid = parse(zId, id);
  const [n] = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, nid), eq(notifications.userId, me.id)))
    .returning({ payload: notifications.payload });
  redirect(safeCallbackUrl(n?.payload.href ?? "/notifications"));
}

export async function markAllNotificationsRead() {
  const me = await requireActiveUser();
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, me.id), isNull(notifications.readAt)));
  refresh();
}
