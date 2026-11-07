import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db, songAssignments, users } from "@/db";
import { displayName } from "@/lib/labels";
import { DAY } from "@/lib/time";
import { requireActiveUser } from "@/server/auth-guards";
import { getAvailability } from "@/server/availability/engine";
import { getSettings } from "@/server/settings/internal";

/**
 * Members to invite, with active-crew counts and an availability summary over
 * the planned practice period (FR-SONG-7).
 */
export async function getInviteCandidates(songId: string, targetPostDate: string | null) {
  await requireActiveUser();
  const settings = await getSettings();
  const from = new Date();
  const lookahead = new Date(Date.now() + settings.lookaheadWeeks * 7 * DAY);
  const target = targetPostDate ? new Date(`${targetPostDate}T23:59:59+08:00`) : null;
  const to = target && target > from && target < lookahead ? target : new Date(Date.now() + 14 * DAY);

  const members = await db
    .select({
      id: users.id,
      name: users.name,
      stageName: users.stageName,
      image: users.image,
      activeCrews: sql<number>`(
        select count(distinct sa.song_id) from song_assignments sa join songs s2 on s2.id = sa.song_id
        where sa.user_id = "users"."id" and s2.status not in ('posted','cancelled'))::int`,
    })
    .from(users)
    .where(eq(users.status, "active"))
    .orderBy(asc(users.name));

  const avails = await getAvailability(members.map((m) => m.id), from, to);
  return {
    from,
    to,
    members: members.map((m) => {
      const a = avails.get(m.id);
      const freeHours = a ? a.available.reduce((n, i) => n + (Math.min(i.end, to.getTime()) - Math.max(i.start, from.getTime())), 0) / 3_600_000 : 0;
      return {
        id: m.id,
        name: displayName(m),
        image: m.image,
        activeCrews: m.activeCrews,
        connected: a?.connected ?? false,
        freeHours: Math.max(0, Math.round(freeHours)),
      };
    }),
  };
}

/** Member ids for the avails heatmap: the crew, or every active member while recruiting. */
export async function getAvailsMemberIds(songId: string, everyone: boolean) {
  await requireActiveUser();
  if (everyone) {
    return (await db.select({ id: users.id }).from(users).where(eq(users.status, "active"))).map((r) => r.id);
  }
  const rows = await db
    .selectDistinct({ id: songAssignments.userId })
    .from(songAssignments)
    .where(and(eq(songAssignments.songId, songId), sql`${songAssignments.userId} is not null`));
  return rows.map((r) => r.id!);
}
