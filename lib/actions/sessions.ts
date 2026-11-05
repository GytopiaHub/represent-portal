"use server";

import { and, eq, inArray } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import {
  db,
  filmingLocations,
  sessionRsvps,
  sessionVideographers,
  sessionsSched,
  songAssignments,
  songs,
} from "@/db";
import { getViewer, requireActiveUser, requireSongEditor } from "@/lib/dal";
import { SESSION_KIND_LABEL } from "@/lib/labels";
import { fmtDateTime, parseLocalDateTime } from "@/lib/time";
import { syncSessionCalendars } from "@/lib/server/calendar-sync";
import { notify, songMemberIds } from "@/lib/server/notify";
import { type ActionResult, UserError, formObject, parse, run, zId, zOptText, zOptUrl } from "./result";

// Practices & filming (FR-PR-*, FR-FM-*). Calendar sync always runs after the
// DB write commits (FR-CAL-5) and never blocks saving.

const sessionSchema = z
  .object({
    kind: z.enum(["practice", "filming"]),
    startsAt: z.string().min(1, "Pick a start time"),
    endsAt: z.string().min(1, "Pick an end time"),
    locationText: zOptText(200),
    locationUrl: zOptUrl,
    bookingStatus: z.enum(["not_needed", "to_book", "booked"]).default("not_needed"),
    bookingRef: zOptText(100),
    notes: zOptText(2000),
    checklist: zOptText(2000),
    refUrl: zOptUrl,
  });

function parseTimes(startsAt: string, endsAt: string, tz: string) {
  const s = parseLocalDateTime(startsAt, tz);
  const e = parseLocalDateTime(endsAt, tz);
  if (!s || !e) throw new UserError("Enter valid start and end times.");
  if (e <= s) throw new UserError("End time must be after the start time.");
  return { s, e };
}

async function songOf(sessionId: string) {
  const [row] = await db
    .select({ songId: sessionsSched.songId, title: songs.title, kind: sessionsSched.kind, startsAt: sessionsSched.startsAt })
    .from(sessionsSched)
    .innerJoin(songs, eq(songs.id, sessionsSched.songId))
    .where(eq(sessionsSched.id, sessionId));
  if (!row) throw new UserError("Session not found.");
  return row;
}

export async function createSession(songId: string, formData: FormData): Promise<ActionResult> {
  const res = await run(async () => {
    const id = parse(zId, songId);
    const me = await requireSongEditor(id);
    const viewer = await getViewer();
    const d = parse(sessionSchema, formObject(formData));
    const { s, e } = parseTimes(d.startsAt, d.endsAt, viewer.tz);

    const [created] = await db
      .insert(sessionsSched)
      .values({
        songId: id,
        kind: d.kind,
        startsAt: s,
        endsAt: e,
        locationText: d.locationText,
        locationUrl: d.locationUrl,
        bookingStatus: d.kind === "practice" ? d.bookingStatus : "not_needed",
        bookingRef: d.bookingRef,
        notes: d.notes,
        checklist: d.kind === "filming" ? d.checklist : null,
        referenceLinks: d.refUrl ? [{ label: "Reference", url: d.refUrl }] : [],
        createdBy: me.id,
      })
      .returning({ id: sessionsSched.id });

    if (d.kind === "filming" && d.locationText) {
      await db.insert(filmingLocations).values({ sessionId: created.id, name: d.locationText, mapUrl: d.locationUrl });
    }

    const [song] = await db.select({ title: songs.title }).from(songs).where(eq(songs.id, id));
    const crew = await songMemberIds(id);
    await notify(crew.filter((u) => u !== me.id), "session_created", {
      title: `New ${SESSION_KIND_LABEL[d.kind].toLowerCase()} for ${song.title}`,
      body: fmtDateTime(s, viewer.tz),
      href: `/songs/${id}/sessions/${created.id}`,
    });
    after(() => syncSessionCalendars(created.id));
    return created.id;
  });
  if (res.ok) redirect(`/songs/${songId}/sessions/${res.data}`);
  return { ok: false, error: res.ok ? "" : res.error };
}

export async function updateSession(sessionId: string, formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const sid = parse(zId, sessionId);
    const info = await songOf(sid);
    const me = await requireSongEditor(info.songId);
    const viewer = await getViewer();
    const d = parse(sessionSchema, formObject(formData));
    const { s, e } = parseTimes(d.startsAt, d.endsAt, viewer.tz);
    await db
      .update(sessionsSched)
      .set({
        startsAt: s,
        endsAt: e,
        locationText: d.locationText,
        locationUrl: d.locationUrl,
        bookingStatus: info.kind === "practice" ? d.bookingStatus : "not_needed",
        bookingRef: d.bookingRef,
        notes: d.notes,
        checklist: info.kind === "filming" ? d.checklist : null,
        referenceLinks: d.refUrl ? [{ label: "Reference", url: d.refUrl }] : [],
      })
      .where(eq(sessionsSched.id, sid));
    const crew = await songMemberIds(info.songId);
    await notify(crew.filter((u) => u !== me.id), "session_changed", {
      title: `${info.title} ${SESSION_KIND_LABEL[info.kind].toLowerCase()} updated`,
      body: fmtDateTime(s, viewer.tz),
      href: `/songs/${info.songId}/sessions/${sid}`,
    });
    after(() => syncSessionCalendars(sid));
    refresh();
  });
}

export async function setSessionCancelled(sessionId: string, cancelled: boolean): Promise<ActionResult> {
  return run(async () => {
    const sid = parse(zId, sessionId);
    const info = await songOf(sid);
    const me = await requireSongEditor(info.songId);
    const viewer = await getViewer();
    await db.update(sessionsSched).set({ status: cancelled ? "cancelled" : "scheduled" }).where(eq(sessionsSched.id, sid));
    const crew = await songMemberIds(info.songId);
    await notify(crew.filter((u) => u !== me.id), cancelled ? "session_cancelled" : "session_changed", {
      title: `${info.title} ${SESSION_KIND_LABEL[info.kind].toLowerCase()} ${cancelled ? "cancelled" : "is back on"}`,
      body: fmtDateTime(info.startsAt, viewer.tz),
      href: `/songs/${info.songId}/sessions/${sid}`,
    });
    // FR-CAL-2: cancelling deletes everyone's events.
    after(() => syncSessionCalendars(sid));
    refresh();
  });
}

// ---------------------------------------------------------------------------
// RSVP (FR-PR-3) — members edit only their own
// ---------------------------------------------------------------------------

export async function rsvp(sessionId: string, formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const me = await requireActiveUser();
    const sid = parse(zId, sessionId);
    const { response, reason } = parse(
      z.object({ response: z.enum(["going", "not_going"]), reason: zOptText(300) }),
      formObject(formData),
    );
    const info = await songOf(sid);
    const [onCrew] = await db
      .select({ id: songAssignments.id })
      .from(songAssignments)
      .where(and(eq(songAssignments.songId, info.songId), eq(songAssignments.userId, me.id)))
      .limit(1);
    if (!onCrew) throw new UserError("Only crew members can RSVP.");
    await db
      .insert(sessionRsvps)
      .values({ sessionId: sid, userId: me.id, response, reason })
      .onConflictDoUpdate({ target: [sessionRsvps.sessionId, sessionRsvps.userId], set: { response, reason } });
    refresh();
  });
}

// ---------------------------------------------------------------------------
// Filming locations & videographers (FR-FM-1)
// ---------------------------------------------------------------------------

export async function addFilmingLocation(sessionId: string, formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const sid = parse(zId, sessionId);
    await requireSongEditor((await songOf(sid)).songId);
    const d = parse(
      z.object({ name: z.string().trim().min(1, "Name the location").max(120), mapUrl: zOptUrl, notes: zOptText(500) }),
      formObject(formData),
    );
    await db.insert(filmingLocations).values({ sessionId: sid, ...d });
    refresh();
  });
}

export async function setFinalLocation(sessionId: string, locationId: string): Promise<ActionResult> {
  return run(async () => {
    const sid = parse(zId, sessionId);
    await requireSongEditor((await songOf(sid)).songId);
    const lid = parse(zId, locationId);
    await db.transaction(async (tx) => {
      await tx.update(filmingLocations).set({ isFinal: false }).where(eq(filmingLocations.sessionId, sid));
      const [loc] = await tx
        .update(filmingLocations)
        .set({ isFinal: true })
        .where(and(eq(filmingLocations.id, lid), eq(filmingLocations.sessionId, sid)))
        .returning();
      if (loc) await tx.update(sessionsSched).set({ locationText: loc.name, locationUrl: loc.mapUrl }).where(eq(sessionsSched.id, sid));
    });
    after(() => syncSessionCalendars(sid));
    refresh();
  });
}

export async function removeFilmingLocation(sessionId: string, locationId: string): Promise<ActionResult> {
  return run(async () => {
    const sid = parse(zId, sessionId);
    await requireSongEditor((await songOf(sid)).songId);
    await db.delete(filmingLocations).where(and(eq(filmingLocations.id, parse(zId, locationId)), eq(filmingLocations.sessionId, sid)));
    refresh();
  });
}

export async function setVideographers(sessionId: string, formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const sid = parse(zId, sessionId);
    const info = await songOf(sid);
    await requireSongEditor(info.songId);
    const ids = formData.getAll("assignmentId").map((v) => parse(zId, v));
    // Only the song's videographer assignments are allowed.
    const valid = ids.length
      ? await db
          .select({ id: songAssignments.id })
          .from(songAssignments)
          .where(and(inArray(songAssignments.id, ids), eq(songAssignments.songId, info.songId), eq(songAssignments.role, "videographer")))
      : [];
    await db.transaction(async (tx) => {
      await tx.delete(sessionVideographers).where(eq(sessionVideographers.sessionId, sid));
      if (valid.length) await tx.insert(sessionVideographers).values(valid.map((v) => ({ sessionId: sid, assignmentId: v.id })));
    });
    refresh();
  });
}
