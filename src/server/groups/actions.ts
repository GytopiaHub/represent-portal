"use server";

import { eq, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db, groupRequests, idolGroups, idolMembers } from "@/db";
import type { ActionResult } from "@/lib/action-result";
import { GROUP_TYPES } from "@/lib/labels";
import { formObject, parse, run, zId, zOptText, zOptUrl } from "@/server/action";
import { requireAdmin, requireActiveUser } from "@/server/auth-guards";
import { notify, notifyAdmins } from "@/server/notify";

// ---------------------------------------------------------------------------
// Idol groups & rosters (FR-GRP-1..3)
// ---------------------------------------------------------------------------

const groupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  nameKr: zOptText(80),
  groupType: z.enum(GROUP_TYPES as [string, ...string[]]),
  imageUrl: zOptUrl,
  isActive: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

export async function saveGroup(groupId: string | null, formData: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    const data = parse(groupSchema, formObject(formData));
    const values = { ...data, groupType: data.groupType as (typeof GROUP_TYPES)[number] };
    if (groupId) await db.update(idolGroups).set(values).where(eq(idolGroups.id, parse(zId, groupId)));
    else await db.insert(idolGroups).values(values);
    refresh();
  });
}

const memberSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  romanisation: zOptText(80),
  imageUrl: zOptUrl,
});

export async function addIdolMember(groupId: string, formData: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    const gid = parse(zId, groupId);
    const data = parse(memberSchema, formObject(formData));
    const [{ max }] = await db
      .select({ max: sql<number>`coalesce(max(${idolMembers.sortOrder}), -1)::int` })
      .from(idolMembers)
      .where(eq(idolMembers.groupId, gid));
    await db.insert(idolMembers).values({ ...data, groupId: gid, sortOrder: max + 1 });
    refresh();
  });
}

export async function updateIdolMember(memberId: string, formData: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    const data = parse(memberSchema, formObject(formData));
    await db.update(idolMembers).set(data).where(eq(idolMembers.id, parse(zId, memberId)));
    refresh();
  });
}

/** Deactivate rather than delete so historical songs keep positions (FR-GRP-2). */
export async function setIdolMemberActive(memberId: string, active: boolean): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    await db.update(idolMembers).set({ isActive: active }).where(eq(idolMembers.id, parse(zId, memberId)));
    refresh();
  });
}

export async function resolveGroupRequest(requestId: string, status: "done" | "rejected"): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    const [r] = await db
      .update(groupRequests)
      .set({ status })
      .where(eq(groupRequests.id, parse(zId, requestId)))
      .returning();
    if (r) {
      await notify([r.requestedBy], "group_requested", {
        title: status === "done" ? `${r.name} has been added` : `Your request for ${r.name} was declined`,
        href: "/groups",
      });
    }
    refresh();
  });
}

// ---------------------------------------------------------------------------
// Group requests from members (FR-GRP-4)
// ---------------------------------------------------------------------------

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
