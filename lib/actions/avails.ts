"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { availOverrides, db, freebusyCache } from "@/db";
import { getViewer } from "@/lib/dal";
import { parseLocalDateTime } from "@/lib/time";
import { type ActionResult, UserError, formObject, parse, run, zId, zOptText } from "./result";

// Manual availability overrides (FR-AV-4). Members edit only their own.

const overrideSchema = z.object({
  kind: z.enum(["busy", "free"]),
  startsAt: z.string().min(1, "Pick a start time"),
  endsAt: z.string().min(1, "Pick an end time"),
  recurrence: z.enum(["none", "weekly"]).default("none"),
  recurrenceUntil: z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()),
  note: zOptText(200),
});

export async function addOverride(formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const me = await getViewer();
    const d = parse(overrideSchema, formObject(formData));
    const s = parseLocalDateTime(d.startsAt, me.tz);
    const e = parseLocalDateTime(d.endsAt, me.tz);
    if (!s || !e || e <= s) throw new UserError("End must be after start.");
    if (e.getTime() - s.getTime() > 7 * 24 * 3600_000) throw new UserError("Keep a block under a week long.");
    await db.insert(availOverrides).values({
      userId: me.id,
      kind: d.kind,
      startsAt: s,
      endsAt: e,
      recurrence: d.recurrence,
      recurrenceUntil: d.recurrence === "weekly" ? d.recurrenceUntil : null,
      note: d.note,
    });
    refresh();
  });
}

export async function deleteOverride(overrideId: string): Promise<ActionResult> {
  return run(async () => {
    const me = await getViewer();
    await db
      .delete(availOverrides)
      .where(and(eq(availOverrides.id, parse(zId, overrideId)), eq(availOverrides.userId, me.id)));
    refresh();
  });
}

/** "Refresh from Google": drop my cached FreeBusy so the next read refetches (FR-AV-8). */
export async function refreshFromGoogle(): Promise<ActionResult> {
  return run(async () => {
    const me = await getViewer();
    await db.delete(freebusyCache).where(eq(freebusyCache.userId, me.id));
    refresh();
  });
}
