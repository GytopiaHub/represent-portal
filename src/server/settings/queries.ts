import "server-only";
import { desc } from "drizzle-orm";
import { db, syncRuns } from "@/db";
import { requireAdmin } from "@/server/auth-guards";
import { getSettings } from "@/server/settings/internal";

export async function getAdminSettings() {
  await requireAdmin();
  const [settings, runs] = await Promise.all([
    getSettings(),
    db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt)).limit(5),
  ]);
  return { settings, runs };
}
