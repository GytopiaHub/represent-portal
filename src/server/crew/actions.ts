"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import {
  db,
  guests,
  songAssignments,
  songInvitations,
  songPositions,
  users,
  type CrewRole,
} from "@/db";
import { isUniqueViolation } from "@/db/errors";
import type { Tx } from "@/db/types";
import type { ActionResult } from "@/lib/action-result";
import { CREW_ROLE_LABEL } from "@/lib/labels";
import { UserError, formObject, parse, run, zId, zOptText, zUserId } from "@/server/action";
import { requireActiveUser, requireSongEditor } from "@/server/auth-guards";
import { syncSongFutureSessions } from "@/server/calendar-sync";
import { notify, songMemberIds } from "@/server/notify";
import { songTitle } from "@/server/songs/internal";

// Recruiting a song's crew: invitations, guests, direct assignment (FR-SONG-5..9).

const zRole = z.enum(["ic", "dancer", "videographer", "editor"]);

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
