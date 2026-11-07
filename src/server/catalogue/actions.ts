"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, idolMembers, songAssignments, songPositions, songs, youtubeVideos } from "@/db";
import type { ActionResult } from "@/lib/action-result";
import { UserError, formObject, parse, run, zId, zUserId } from "@/server/action";
import { requireAdmin } from "@/server/auth-guards";

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
