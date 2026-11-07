import "server-only";
import { eq } from "drizzle-orm";
import { db, memberCalendars, users } from "@/db";
import { requireActiveUser } from "@/server/auth-guards";
import { getGoogleTokenError, listCalendars } from "@/server/google";
import { isMockGoogle } from "@/server/integrations";

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
