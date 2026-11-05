"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db, groupRequests, guests } from "@/db";
import { ForbiddenError, requireActiveUser } from "@/lib/dal";
import { notifyAdmins } from "@/lib/server/notify";
import { type ActionResult, formObject, parse, run, zId, zOptText } from "./result";

// Guests (FR-GST-1) and group requests (FR-GRP-4).

const guestSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  instagram: zOptText(40).transform((v) => (v ? v.replace(/^@/, "") : null)),
  contactNote: zOptText(300),
});

export async function createGuest(formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const me = await requireActiveUser();
    await db.insert(guests).values({ ...parse(guestSchema, formObject(formData)), createdBy: me.id });
    refresh();
  });
}

/** Members edit guests they created; admins edit all. */
export async function updateGuest(guestId: string, formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const me = await requireActiveUser();
    const id = parse(zId, guestId);
    const [g] = await db.select({ createdBy: guests.createdBy }).from(guests).where(eq(guests.id, id));
    if (!g) return;
    if (me.role !== "admin" && g.createdBy !== me.id) throw new ForbiddenError("You can only edit guests you added.");
    await db.update(guests).set(parse(guestSchema, formObject(formData))).where(eq(guests.id, id));
    refresh();
  });
}

export async function requestGroup(formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const me = await requireActiveUser();
    const d = parse(
      z.object({ name: z.string().trim().min(1, "Which group?").max(80), note: zOptText(300) }),
      formObject(formData),
    );
    await db.insert(groupRequests).values({ requestedBy: me.id, ...d });
    await notifyAdmins("group_requested", {
      title: `Group requested: ${d.name}`,
      body: `${me.name ?? "A member"}${d.note ? ` — ${d.note}` : ""}`,
      href: "/admin/groups",
    });
    refresh();
  });
}
