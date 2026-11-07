import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { db, guests, users } from "@/db";
import { requireActiveUser } from "@/server/auth-guards";

export async function listGuests() {
  const viewer = await requireActiveUser();
  const rows = await db
    .select({
      id: guests.id,
      name: guests.name,
      instagram: guests.instagram,
      contactNote: guests.contactNote,
      createdBy: guests.createdBy,
      creatorName: users.name,
      credits: sql<number>`(select count(*) from song_assignments sa where sa.guest_id = "guests"."id")::int`,
    })
    .from(guests)
    .leftJoin(users, eq(users.id, guests.createdBy))
    .orderBy(asc(guests.name));
  return rows.map((g) => ({ ...g, canEdit: viewer.role === "admin" || g.createdBy === viewer.id }));
}
