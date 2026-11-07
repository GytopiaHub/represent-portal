"use server";

import { and, asc, eq, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { db, idolMembers, songAssignments, songPositions, songs, youtubeVideos } from "@/db";
import { isUniqueViolation } from "@/db/errors";
import type { ActionResult } from "@/lib/action-result";
import { SONG_STATUSES, SONG_STATUS_LABEL } from "@/lib/labels";
import { UserError, formObject, parse, run, zId, zOptText, zOptUrl } from "@/server/action";
import { requireActiveUser, requireSongEditor } from "@/server/auth-guards";
import { syncSongFutureSessions } from "@/server/calendar-sync";
import { notify, songMemberIds } from "@/server/notify";

const zDate = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date").nullable());

// ---------------------------------------------------------------------------
// Create & edit (FR-SONG-1..4)
// ---------------------------------------------------------------------------

const positionSchema = z.array(
  z.union([z.object({ idolMemberId: zId }), z.object({ customLabel: z.string().trim().min(1).max(40) })]),
);

const createSchema = z.object({
  title: z.string().trim().min(1, "Song title is required").max(120),
  groupId: zId,
  targetPostDate: zDate,
  mvUrl: zOptUrl,
  practiceUrl: zOptUrl,
  description: zOptText(2000),
  positions: z.string().transform((s, ctx) => {
    try {
      return JSON.parse(s) as unknown;
    } catch {
      ctx.addIssue({ code: "custom", message: "Invalid positions" });
      return z.NEVER;
    }
  }).pipe(positionSchema),
});

export async function createSong(formData: FormData): Promise<ActionResult> {
  const res = await run(async () => {
    const me = await requireActiveUser();
    const data = parse(createSchema, formObject(formData));

    return db.transaction(async (tx) => {
      // Only roster members of the chosen group may be used as positions.
      const roster = await tx.select({ id: idolMembers.id }).from(idolMembers).where(eq(idolMembers.groupId, data.groupId));
      const allowed = new Set(roster.map((r) => r.id));
      const positions = data.positions.filter((p) => !("idolMemberId" in p) || allowed.has(p.idolMemberId));

      const [song] = await tx
        .insert(songs)
        .values({
          title: data.title,
          groupId: data.groupId,
          targetPostDate: data.targetPostDate,
          description: data.description,
          referenceLinks: [
            ...(data.mvUrl ? [{ label: "Original MV", url: data.mvUrl }] : []),
            ...(data.practiceUrl ? [{ label: "Dance practice", url: data.practiceUrl }] : []),
          ],
          createdBy: me.id,
        })
        .returning({ id: songs.id });
      if (positions.length > 0) {
        await tx.insert(songPositions).values(
          positions.map((p, i) => ({
            songId: song.id,
            sortOrder: i,
            ...("idolMemberId" in p ? { idolMemberId: p.idolMemberId } : { customLabel: p.customLabel }),
          })),
        );
      }
      // The creator becomes the first IC (§3.2).
      await tx.insert(songAssignments).values({ songId: song.id, role: "ic", userId: me.id });
      return song.id;
    });
  });
  if (res.ok) redirect(`/songs/${res.data}?tab=crew`);
  return { ok: false, error: res.ok ? "" : res.error };
}

const detailsSchema = z.object({
  title: z.string().trim().min(1).max(120),
  targetPostDate: zDate,
  description: zOptText(2000),
  mvUrl: zOptUrl,
  practiceUrl: zOptUrl,
});

export async function updateSongDetails(songId: string, formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const id = parse(zId, songId);
    await requireSongEditor(id);
    const d = parse(detailsSchema, formObject(formData));
    await db
      .update(songs)
      .set({
        title: d.title,
        targetPostDate: d.targetPostDate,
        description: d.description,
        referenceLinks: [
          ...(d.mvUrl ? [{ label: "Original MV", url: d.mvUrl }] : []),
          ...(d.practiceUrl ? [{ label: "Dance practice", url: d.practiceUrl }] : []),
        ],
      })
      .where(eq(songs.id, id));
    refresh();
  });
}

export async function setSongStatus(songId: string, formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const id = parse(zId, songId);
    const me = await requireSongEditor(id);
    const status = parse(z.enum(SONG_STATUSES as [string, ...string[]]), formData.get("status")) as (typeof SONG_STATUSES)[number];
    const [song] = await db.select({ title: songs.title, videoId: songs.youtubeVideoId, status: songs.status }).from(songs).where(eq(songs.id, id));
    if (!song) throw new UserError("Song not found.");
    if (status === song.status) return;
    // FR-SONG-4: Posted requires a linked YouTube video.
    if (status === "posted" && !song.videoId) throw new UserError("Link the YouTube video before marking it Posted.");
    await db.update(songs).set({ status }).where(eq(songs.id, id));
    const crew = await songMemberIds(id);
    await notify(crew.filter((u) => u !== me.id), "song_status", {
      title: `${song.title} is now ${SONG_STATUS_LABEL[status]}`,
      href: `/songs/${id}`,
    });
    // Cancelling removes calendar events; un-cancelling restores them.
    if (status === "cancelled" || song.status === "cancelled") after(() => syncSongFutureSessions(id));
    refresh();
  });
}

// ---------------------------------------------------------------------------
// Positions (FR-SONG-3)
// ---------------------------------------------------------------------------

export async function addCustomPosition(songId: string, formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const id = parse(zId, songId);
    await requireSongEditor(id);
    const label = parse(z.string().trim().min(1, "Enter a label").max(40), formData.get("label"));
    const [{ max }] = await db
      .select({ max: sql<number>`coalesce(max(${songPositions.sortOrder}), -1)::int` })
      .from(songPositions)
      .where(eq(songPositions.songId, id));
    await db.insert(songPositions).values({ songId: id, customLabel: label, sortOrder: max + 1 });
    refresh();
  });
}

export async function movePosition(songId: string, positionId: string, dir: -1 | 1): Promise<ActionResult> {
  return run(async () => {
    const id = parse(zId, songId);
    await requireSongEditor(id);
    await db.transaction(async (tx) => {
      const list = await tx
        .select({ id: songPositions.id })
        .from(songPositions)
        .where(eq(songPositions.songId, id))
        .orderBy(asc(songPositions.sortOrder));
      const i = list.findIndex((p) => p.id === positionId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      for (const [order, p] of list.entries()) {
        await tx.update(songPositions).set({ sortOrder: order }).where(eq(songPositions.id, p.id));
      }
    });
    refresh();
  });
}

export async function removePosition(songId: string, positionId: string): Promise<ActionResult> {
  return run(async () => {
    const id = parse(zId, songId);
    await requireSongEditor(id);
    const pid = parse(zId, positionId);
    const [taken] = await db.select({ id: songAssignments.id }).from(songAssignments).where(eq(songAssignments.positionId, pid));
    if (taken) throw new UserError("Remove the dancer from this position first.");
    await db.delete(songPositions).where(and(eq(songPositions.id, pid), eq(songPositions.songId, id)));
    refresh();
  });
}

// ---------------------------------------------------------------------------
// YouTube linking (FR-YT-2)
// ---------------------------------------------------------------------------

export async function linkVideo(songId: string, videoDbId: string): Promise<ActionResult> {
  return run(async () => {
    const id = parse(zId, songId);
    await requireSongEditor(id);
    const vid = parse(zId, videoDbId);
    await db.transaction(async (tx) => {
      const [v] = await tx.select({ state: youtubeVideos.backfillState }).from(youtubeVideos).where(eq(youtubeVideos.id, vid));
      if (!v || v.state === "ignored") throw new UserError("That video can't be linked.");
      try {
        await tx.update(songs).set({ youtubeVideoId: vid }).where(eq(songs.id, id));
      } catch (err) {
        if (isUniqueViolation(err)) throw new UserError("That video is already linked to another song.");
        throw err;
      }
      await tx.update(youtubeVideos).set({ backfillState: "tagged" }).where(eq(youtubeVideos.id, vid));
    });
    refresh();
  });
}

export async function unlinkVideo(songId: string): Promise<ActionResult> {
  return run(async () => {
    const id = parse(zId, songId);
    await requireSongEditor(id);
    await db.transaction(async (tx) => {
      const [s] = await tx.select({ videoId: songs.youtubeVideoId, status: songs.status }).from(songs).where(eq(songs.id, id));
      if (!s?.videoId) return;
      await tx
        .update(songs)
        .set({ youtubeVideoId: null, status: s.status === "posted" ? "editing" : s.status })
        .where(eq(songs.id, id));
      await tx.update(youtubeVideos).set({ backfillState: "untagged" }).where(eq(youtubeVideos.id, s.videoId));
    });
    refresh();
  });
}
