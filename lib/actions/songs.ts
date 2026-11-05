"use server";

import { and, asc, eq, ne, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import {
  db,
  guests,
  idolMembers,
  songAssignments,
  songInvitations,
  songPositions,
  songs,
  users,
  youtubeVideos,
  type CrewRole,
} from "@/db";
import { requireActiveUser, requireSongEditor } from "@/lib/dal";
import { CREW_ROLE_LABEL, SONG_STATUSES, SONG_STATUS_LABEL } from "@/lib/labels";
import { syncSongFutureSessions } from "@/lib/server/calendar-sync";
import type { Tx } from "@/lib/server/db-types";
import { notify, songMemberIds } from "@/lib/server/notify";
import { type ActionResult, UserError, formObject, parse, run, zId, zOptText, zOptUrl, zUserId } from "./result";

const zRole = z.enum(["ic", "dancer", "videographer", "editor"]);
const zDate = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date").nullable());

async function songTitle(songId: string, conn: Tx | typeof db = db) {
  const [s] = await conn.select({ title: songs.title, isBackfill: songs.isBackfill }).from(songs).where(eq(songs.id, songId));
  if (!s) throw new UserError("Song not found.");
  return s;
}

function isUniqueViolation(err: unknown) {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505";
}

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
// Recruiting (FR-SONG-5..9)
// ---------------------------------------------------------------------------

/** Forms send either role + positionId, or a combined "role:positionId" slot. */
function slotFields(obj: Record<string, unknown>) {
  if (typeof obj.slot === "string") {
    const [role, positionId] = obj.slot.split(":");
    return { ...obj, role, positionId: positionId ?? "" };
  }
  return obj;
}

const slotSchema = z
  .object({
    role: zRole,
    positionId: z.string().optional().transform((v) => (v ? v : null)).pipe(zId.nullable()),
  })
  .refine((s) => (s.role === "dancer") === (s.positionId != null), {
    message: "Dancers need a position; other roles don't.",
  });

/** Checks a dancer slot is open (no assignee, no pending invite). */
async function assertSlotOpen(tx: Tx, songId: string, role: CrewRole, positionId: string | null, holder?: { userId?: string; guestId?: string }) {
  if (positionId) {
    const [pos] = await tx.select({ id: songPositions.id }).from(songPositions).where(and(eq(songPositions.id, positionId), eq(songPositions.songId, songId)));
    if (!pos) throw new UserError("That position isn't part of this song.");
    const [taken] = await tx.select({ id: songAssignments.id }).from(songAssignments).where(eq(songAssignments.positionId, positionId));
    if (taken) throw new UserError("That position is already filled.");
  } else if (holder) {
    const [dup] = await tx
      .select({ id: songAssignments.id })
      .from(songAssignments)
      .where(
        and(
          eq(songAssignments.songId, songId),
          eq(songAssignments.role, role),
          holder.userId ? eq(songAssignments.userId, holder.userId) : eq(songAssignments.guestId, holder.guestId!),
        ),
      );
    if (dup) throw new UserError(`They're already ${CREW_ROLE_LABEL[role].toLowerCase()} on this song.`);
  }
}

export async function inviteMember(songId: string, formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const id = parse(zId, songId);
    const me = await requireSongEditor(id);
    const { role, positionId } = parse(slotSchema, slotFields(formObject(formData)));
    const inviteeId = parse(zUserId, formData.get("userId"));

    await db.transaction(async (tx) => {
      const song = await songTitle(id, tx);
      if (song.isBackfill) throw new UserError("Backfilled songs assign crew directly — no invitations needed.");
      const [invitee] = await tx.select({ status: users.status }).from(users).where(eq(users.id, inviteeId));
      if (invitee?.status !== "active") throw new UserError("You can only invite active members.");
      await assertSlotOpen(tx, id, role, positionId, positionId ? undefined : { userId: inviteeId });
      const [pendingDup] = await tx
        .select({ id: songInvitations.id })
        .from(songInvitations)
        .where(
          and(
            eq(songInvitations.songId, id),
            eq(songInvitations.status, "pending"),
            positionId ? eq(songInvitations.positionId, positionId) : and(eq(songInvitations.role, role), eq(songInvitations.inviteeUserId, inviteeId)),
          ),
        );
      if (pendingDup) throw new UserError(positionId ? "Someone already has a pending invite for this position." : "They already have a pending invite for this role.");

      await tx.insert(songInvitations).values({ songId: id, role, positionId, inviteeUserId: inviteeId, invitedBy: me.id });
      await notify([inviteeId], "invited", {
        title: `You're invited to ${song.title}`,
        body: `as ${CREW_ROLE_LABEL[role]}`,
        href: `/songs/${id}`,
      }, tx);
    });
    refresh();
  });
}

export async function cancelInvite(songId: string, inviteId: string): Promise<ActionResult> {
  return run(async () => {
    const id = parse(zId, songId);
    await requireSongEditor(id);
    await db
      .update(songInvitations)
      .set({ status: "cancelled", respondedAt: new Date() })
      .where(and(eq(songInvitations.id, parse(zId, inviteId)), eq(songInvitations.songId, id), eq(songInvitations.status, "pending")));
    refresh();
  });
}

/** Only the invitee may respond (SEC-1). Accepting adds them to the crew. */
export async function respondToInvite(inviteId: string, accept: boolean): Promise<ActionResult> {
  return run(async () => {
    const me = await requireActiveUser();
    const iid = parse(zId, inviteId);
    const songId = await db.transaction(async (tx) => {
      const [inv] = await tx
        .select()
        .from(songInvitations)
        .where(and(eq(songInvitations.id, iid), eq(songInvitations.inviteeUserId, me.id)))
        .for("update");
      if (!inv) throw new UserError("Invitation not found.");
      if (inv.status !== "pending") throw new UserError("This invitation is no longer open.");
      const song = await songTitle(inv.songId, tx);

      if (accept) {
        await assertSlotOpen(tx, inv.songId, inv.role, inv.positionId, inv.positionId ? undefined : { userId: me.id });
        try {
          await tx.insert(songAssignments).values({ songId: inv.songId, role: inv.role, positionId: inv.positionId, userId: me.id });
        } catch (err) {
          if (isUniqueViolation(err)) throw new UserError("That position was just filled.");
          throw err;
        }
      }
      await tx
        .update(songInvitations)
        .set({ status: accept ? "accepted" : "declined", respondedAt: new Date() })
        .where(eq(songInvitations.id, iid));
      const ics = await songMemberIds(inv.songId, ["ic"], tx);
      await notify(ics, "invite_response", {
        title: `${me.name ?? "A member"} ${accept ? "accepted" : "declined"} your invite`,
        body: `${song.title} · ${CREW_ROLE_LABEL[inv.role]}`,
        href: `/songs/${inv.songId}?tab=crew`,
      }, tx);
      return accept ? inv.songId : null;
    });
    // FR-CAL-3: a new crew member gets events for every future session.
    if (songId) after(() => syncSongFutureSessions(songId));
    refresh();
  });
}

const guestAssignSchema = z.object({
  guestId: z.string().optional().transform((v) => (v ? v : null)).pipe(zId.nullable()),
  newGuestName: zOptText(80),
  newGuestInstagram: zOptText(40),
});

/** Guests are assigned directly, no acceptance (FR-SONG-5). Can create inline. */
export async function assignGuest(songId: string, formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const id = parse(zId, songId);
    const me = await requireSongEditor(id);
    const obj = slotFields(formObject(formData));
    const { role, positionId } = parse(slotSchema, obj);
    const g = parse(guestAssignSchema, obj);
    if (!g.guestId && !g.newGuestName) throw new UserError("Pick a guest or enter a new guest's name.");

    await db.transaction(async (tx) => {
      let guestId = g.guestId;
      if (!guestId) {
        const [created] = await tx
          .insert(guests)
          .values({ name: g.newGuestName!, instagram: g.newGuestInstagram?.replace(/^@/, "") ?? null, createdBy: me.id })
          .returning({ id: guests.id });
        guestId = created.id;
      }
      await assertSlotOpen(tx, id, role, positionId, positionId ? undefined : { guestId });
      await tx.insert(songAssignments).values({ songId: id, role, positionId, guestId });
    });
    refresh();
  });
}

/** Backfilled songs record crew directly, without invitations (FR-YT-4). */
export async function assignMemberDirect(songId: string, formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const id = parse(zId, songId);
    await requireSongEditor(id);
    const { role, positionId } = parse(slotSchema, slotFields(formObject(formData)));
    const userId = parse(zUserId, formData.get("userId"));
    await db.transaction(async (tx) => {
      const song = await songTitle(id, tx);
      if (!song.isBackfill) throw new UserError("Invite members instead — direct assignment is for backfilled songs.");
      await assertSlotOpen(tx, id, role, positionId, positionId ? undefined : { userId });
      await tx.insert(songAssignments).values({ songId: id, role, positionId, userId });
    });
    refresh();
  });
}

/** FR-SONG-8. A song must keep at least one member IC (§3.2). */
export async function removeAssignment(songId: string, assignmentId: string): Promise<ActionResult> {
  return run(async () => {
    const id = parse(zId, songId);
    await requireSongEditor(id);
    const aid = parse(zId, assignmentId);
    const removedUser = await db.transaction(async (tx) => {
      await tx.execute(sql`select id from songs where id = ${id} for update`);
      const [a] = await tx.select().from(songAssignments).where(and(eq(songAssignments.id, aid), eq(songAssignments.songId, id)));
      if (!a) throw new UserError("Already removed.");
      if (a.role === "ic" && a.userId) {
        const others = await tx.$count(
          songAssignments,
          and(eq(songAssignments.songId, id), eq(songAssignments.role, "ic"), sql`${songAssignments.userId} is not null`, ne(songAssignments.id, aid)),
        );
        if (others === 0) throw new UserError("A song needs at least one IC who is a member. Add another IC first.");
      }
      await tx.delete(songAssignments).where(eq(songAssignments.id, aid));
      const song = await songTitle(id, tx);
      if (a.userId) {
        const [stillOnCrew] = await tx.select({ id: songAssignments.id }).from(songAssignments).where(and(eq(songAssignments.songId, id), eq(songAssignments.userId, a.userId)));
        await notify([a.userId], "crew_removed", {
          title: stillOnCrew ? `Your ${CREW_ROLE_LABEL[a.role]} role on ${song.title} was removed` : `You were removed from ${song.title}`,
          href: `/songs/${id}`,
        }, tx);
        return stillOnCrew ? null : a.userId;
      }
      return null;
    });
    // FR-SONG-8 / FR-CAL-3: their future events for this song are deleted.
    if (removedUser) after(() => syncSongFutureSessions(id));
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
