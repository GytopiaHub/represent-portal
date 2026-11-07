"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { appSettings, db } from "@/db";
import type { ActionResult } from "@/lib/action-result";
import { UserError, formObject, parse, run, zOptText } from "@/server/action";
import { requireAdmin } from "@/server/auth-guards";
import { runYoutubeSync } from "@/server/youtube-sync";

// ---------------------------------------------------------------------------
// Settings (§4.3, FR-SET-1/2)
// ---------------------------------------------------------------------------

const zTime = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Use HH:MM");

const settingsSchema = z
  .object({
    youtubeChannelId: zOptText(64),
    syncTimeSgt: zTime,
    defaultPracticeMinutes: z.coerce.number().int().min(15).max(24 * 60),
    defaultFilmingMinutes: z.coerce.number().int().min(15).max(24 * 60),
    availWindowStart: zTime,
    availWindowEnd: zTime,
    lookaheadWeeks: z.coerce.number().int().min(1).max(26),
    defaultTimezone: z.string().trim().min(1).refine((tz) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "Unknown time zone"),
  })
  .refine((s) => s.availWindowStart < s.availWindowEnd, { message: "Window start must be before end", path: ["availWindowEnd"] });

export async function updateSettings(formData: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    const data = parse(settingsSchema, formObject(formData));
    await db.insert(appSettings).values({ id: 1, ...data }).onConflictDoUpdate({ target: appSettings.id, set: data });
    refresh();
  });
}

export async function syncYoutubeNow(): Promise<ActionResult<{ added: number; errors: string[] }>> {
  return run(async () => {
    await requireAdmin();
    const res = await runYoutubeSync("manual");
    refresh();
    if (!res.ok) throw new UserError(res.summary.errors?.join("; ") || "Sync failed");
    return { added: res.summary.added ?? 0, errors: res.summary.errors ?? [] };
  });
}

/** Run cron/tick now from the settings page (handy before GitHub Actions is set up). */
export async function runTickNow(): Promise<ActionResult<Record<string, unknown>>> {
  return run(async () => {
    await requireAdmin();
    const { runTick } = await import("@/server/jobs/tick");
    const result = await runTick();
    refresh();
    return result;
  });
}
