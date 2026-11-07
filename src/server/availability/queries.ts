import "server-only";
import { asc, eq } from "drizzle-orm";
import { availOverrides, db } from "@/db";
import { getViewer } from "@/server/auth-guards";

export async function getMyOverrides() {
  const viewer = await getViewer();
  const rows = await db
    .select()
    .from(availOverrides)
    .where(eq(availOverrides.userId, viewer.id))
    .orderBy(asc(availOverrides.startsAt));
  return { tz: viewer.tz, overrides: rows };
}
