import "server-only";
import { eq } from "drizzle-orm";
import { appSettings, db } from "@/db";
import type { Conn } from "./db-types";

export type AppSettings = typeof appSettings.$inferSelect;

/** The single settings row, created with defaults on first use (§4.3). */
export async function getSettings(conn: Conn = db): Promise<AppSettings> {
  const [row] = await conn.select().from(appSettings).where(eq(appSettings.id, 1));
  if (row) return row;
  const [created] = await conn.insert(appSettings).values({ id: 1 }).onConflictDoNothing().returning();
  return created ?? (await conn.select().from(appSettings).where(eq(appSettings.id, 1)))[0];
}

export const STALL_THRESHOLD_MS = 3 * 60 * 60 * 1000;

/** True when cron/tick hasn't run for over 3 hours (§2.1). */
export function ticksStalled(settings: AppSettings, now = new Date()) {
  return !settings.lastTickAt || now.getTime() - settings.lastTickAt.getTime() > STALL_THRESHOLD_MS;
}
