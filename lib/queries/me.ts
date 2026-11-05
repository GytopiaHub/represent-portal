import "server-only";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { availOverrides, db, memberCalendars, notifications, users } from "@/db";
import { getViewer, requireActiveUser } from "@/lib/dal";
import { getGoogleTokenError, listCalendars } from "@/lib/google";
import { isMockGoogle } from "@/lib/server/integrations";

// The signed-in member's own data.

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
      timezone: users.timezone,
      onboardedAt: users.onboardedAt,
    })
    .from(users)
    .where(eq(users.id, me.id));
  const cals = await db
    .select({ id: memberCalendars.googleCalendarId, include: memberCalendars.includeInBusy })
    .from(memberCalendars)
    .where(eq(memberCalendars.userId, me.id));
  return { ...row, busyCalendarIds: cals.filter((c) => c.include).map((c) => c.id) };
}

export async function getMyCalendars() {
  const me = await requireActiveUser();
  return listCalendars(me.id);
}

/** null when connected; otherwise an error code and the user should reconnect. */
export async function getMyGoogleTokenError() {
  const me = await requireActiveUser();
  if (isMockGoogle) return null;
  return getGoogleTokenError(me.id);
}

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
  return db.$count(notifications, and(eq(notifications.userId, me.id), isNull(notifications.readAt)));
}

/** Unread "You've been approved" style banners for the top of the app (FR-ADM-4). */
export async function getMyBannerNotifications() {
  const me = await requireActiveUser();
  return db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, me.id), eq(notifications.type, "approved"), isNull(notifications.readAt)));
}

export async function getMyOverrides() {
  const viewer = await getViewer();
  const rows = await db
    .select()
    .from(availOverrides)
    .where(eq(availOverrides.userId, viewer.id))
    .orderBy(asc(availOverrides.startsAt));
  return { tz: viewer.tz, overrides: rows };
}
