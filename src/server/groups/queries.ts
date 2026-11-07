import "server-only";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db, groupRequests, idolGroups, idolMembers, users } from "@/db";
import { requireActiveUser, requireAdmin } from "@/server/auth-guards";

/** All groups with full rosters (members can view; FR-GRP-4). */
export async function listGroupsWithMembers() {
  await requireActiveUser();
  const [groups, members] = await Promise.all([
    db
      .select({
        id: idolGroups.id,
        name: idolGroups.name,
        nameKr: idolGroups.nameKr,
        groupType: idolGroups.groupType,
        imageUrl: idolGroups.imageUrl,
        isActive: idolGroups.isActive,
        songCount: sql<number>`(select count(*) from songs s where s.group_id = "idol_groups"."id")::int`,
      })
      .from(idolGroups)
      .orderBy(asc(idolGroups.name)),
    db.select().from(idolMembers).orderBy(asc(idolMembers.sortOrder), asc(idolMembers.name)),
  ]);
  return groups.map((g) => ({ ...g, members: members.filter((m) => m.groupId === g.id) }));
}

export async function listGroupRequests(onlyMine = false) {
  const me = await requireActiveUser();
  if (!onlyMine && me.role !== "admin") await requireAdmin();
  return db
    .select({
      id: groupRequests.id,
      name: groupRequests.name,
      note: groupRequests.note,
      status: groupRequests.status,
      createdAt: groupRequests.createdAt,
      requestedByName: users.name,
    })
    .from(groupRequests)
    .innerJoin(users, eq(users.id, groupRequests.requestedBy))
    .where(onlyMine ? eq(groupRequests.requestedBy, me.id) : undefined)
    .orderBy(desc(groupRequests.createdAt));
}

/** Groups with their active rosters, for the new-song form (FR-SONG-2). */
export async function getGroupsWithRosters() {
  await requireActiveUser();
  const [groups, members] = await Promise.all([
    db.select().from(idolGroups).orderBy(asc(idolGroups.name)),
    db
      .select()
      .from(idolMembers)
      .where(eq(idolMembers.isActive, true))
      .orderBy(asc(idolMembers.sortOrder), asc(idolMembers.name)),
  ]);
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    groupType: g.groupType,
    isActive: g.isActive,
    roster: members.filter((m) => m.groupId === g.id).map((m) => ({ id: m.id, name: m.name })),
  }));
}
