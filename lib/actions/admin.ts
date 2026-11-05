"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  appSettings,
  db,
  groupRequests,
  idolGroups,
  idolMembers,
  sessions,
  songAssignments,
  songPositions,
  songs,
  users,
  youtubeVideos,
  type UserStatus,
} from "@/db";
import { requireAdmin } from "@/lib/dal";
import { GROUP_TYPES } from "@/lib/labels";
import { ADMIN_SET_LOCK } from "@/lib/locks";
import { notify } from "@/lib/server/notify";
import { runYoutubeSync } from "@/lib/server/youtube-sync";
import { type ActionResult, UserError, formObject, parse, run, zId, zOptText, zOptUrl, zUserId } from "./result";

// ---------------------------------------------------------------------------
// Approvals (R-ROLE-2, FR-ADM-1, FR-ADM-4)
// ---------------------------------------------------------------------------

export async function approveUser(id: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin();
    const userId = parse(zUserId, id);
    await db.transaction(async (tx) => {
      const [row] = await tx
        .update(users)
        .set({ status: "active", reviewedAt: new Date(), reviewedBy: admin.id })
        .where(and(eq(users.id, userId), inArray(users.status, ["pending", "rejected"])))
        .returning({ id: users.id });
      if (!row) throw new UserError("That user has already been dealt with.");
      await notify([userId], "approved", { title: "You've been approved!", body: "Welcome to RepresENT 🎉", href: "/" }, tx);
    });
    refresh();
  });
}

export async function rejectUser(id: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin();
    const userId = parse(zUserId, id);
    const [row] = await db
      .update(users)
      .set({ status: "rejected", reviewedAt: new Date(), reviewedBy: admin.id })
      .where(and(eq(users.id, userId), eq(users.status, "pending")))
      .returning({ id: users.id });
    if (!row) throw new UserError("That user has already been dealt with.");
    refresh();
  });
}

// ---------------------------------------------------------------------------
// Members (FR-ADM-2, R-ROLE-4, R-ROLE-5)
// ---------------------------------------------------------------------------

/** Change one user under the admin-set lock; refuse to leave zero admins (R-ROLE-4). */
async function changeMember(
  id: string,
  change: { role?: "member" | "admin"; status?: UserStatus },
  opts: { allowedFrom: UserStatus[]; adminId: string; deleteSessions?: boolean },
) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${ADMIN_SET_LOCK})`);
    const [target] = await tx
      .select({ id: users.id, role: users.role, status: users.status })
      .from(users)
      .where(eq(users.id, id));
    if (!target) throw new UserError("User not found.");
    if (!opts.allowedFrom.includes(target.status)) {
      throw new UserError("That action doesn't apply to this user any more.");
    }
    const wasActiveAdmin = target.role === "admin" && target.status === "active";
    const willBeActiveAdmin =
      (change.role ?? target.role) === "admin" && (change.status ?? target.status) === "active";
    if (wasActiveAdmin && !willBeActiveAdmin) {
      const admins = await tx.$count(users, and(eq(users.role, "admin"), eq(users.status, "active")));
      if (admins <= 1) throw new UserError("You can't demote or remove the last remaining admin.");
    }
    await tx
      .update(users)
      .set({ ...change, reviewedAt: new Date(), reviewedBy: opts.adminId })
      .where(eq(users.id, id));
    if (opts.deleteSessions) await tx.delete(sessions).where(eq(sessions.userId, id));
  });
}

export async function promoteToAdmin(id: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin();
    await changeMember(parse(zUserId, id), { role: "admin" }, { allowedFrom: ["active"], adminId: admin.id });
    refresh();
  });
}

export async function demoteToMember(id: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin();
    await changeMember(parse(zUserId, id), { role: "member" }, { allowedFrom: ["active"], adminId: admin.id });
    refresh();
  });
}

/** Soft delete: history stays, sign-in is blocked, sessions are revoked. */
export async function removeMember(id: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin();
    await changeMember(
      parse(zUserId, id),
      { status: "removed", role: "member" },
      { allowedFrom: ["active", "rejected"], adminId: admin.id, deleteSessions: true },
    );
    refresh();
  });
}

export async function restoreMember(id: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin();
    await changeMember(parse(zUserId, id), { status: "active" }, { allowedFrom: ["removed"], adminId: admin.id });
    refresh();
  });
}

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
// Backfill queue (FR-YT-3/4)
// ---------------------------------------------------------------------------

export async function setVideoIgnored(videoId: string, ignored: boolean): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    await db
      .update(youtubeVideos)
      .set({ backfillState: ignored ? "ignored" : "untagged" })
      .where(eq(youtubeVideos.id, parse(zId, videoId)));
    refresh();
  });
}

const backfillSchema = z.object({
  title: z.string().trim().min(1, "Song title is required").max(120),
  groupId: zId,
  icUserId: zUserId,
});

/**
 * Create a posted song record for an existing video. Positions are prefilled
 * from the roster; crew is then assigned directly on the Crew tab (FR-YT-4).
 */
export async function createBackfillSong(videoId: string, formData: FormData): Promise<ActionResult> {
  const res = await run(async () => {
  await requireAdmin();
  const vid = parse(zId, videoId);
  const data = parse(backfillSchema, formObject(formData));

  return db.transaction(async (tx) => {
    const [video] = await tx.select().from(youtubeVideos).where(eq(youtubeVideos.id, vid));
    if (!video || video.backfillState !== "untagged") throw new UserError("That video is no longer untagged.");
    const [song] = await tx
      .insert(songs)
      .values({
        title: data.title,
        groupId: data.groupId,
        status: "posted",
        youtubeVideoId: vid,
        isBackfill: true,
        createdBy: data.icUserId,
      })
      .returning({ id: songs.id });
    const roster = await tx
      .select({ id: idolMembers.id })
      .from(idolMembers)
      .where(and(eq(idolMembers.groupId, data.groupId), eq(idolMembers.isActive, true)))
      .orderBy(idolMembers.sortOrder);
    if (roster.length > 0) {
      await tx.insert(songPositions).values(roster.map((m, i) => ({ songId: song.id, idolMemberId: m.id, sortOrder: i })));
    }
    await tx.insert(songAssignments).values({ songId: song.id, role: "ic", userId: data.icUserId });
    await tx.update(youtubeVideos).set({ backfillState: "tagged" }).where(eq(youtubeVideos.id, vid));
    return song.id;
  });
  });
  if (res.ok) redirect(`/songs/${res.data}?tab=crew`);
  return { ok: false, error: res.ok ? "" : res.error };
}

/** Run cron/tick now from the settings page (handy before GitHub Actions is set up). */
export async function runTickNow(): Promise<ActionResult<Record<string, unknown>>> {
  return run(async () => {
    await requireAdmin();
    const { runTick } = await import("@/lib/server/cron");
    const result = await runTick();
    refresh();
    return result;
  });
}
