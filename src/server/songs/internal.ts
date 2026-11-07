import "server-only";
import { eq } from "drizzle-orm";
import { db, songs } from "@/db";
import type { Tx } from "@/db/types";
import { UserError } from "@/server/action";

// Unguarded helpers shared by song and crew actions. Callers authorize first.

export async function songTitle(songId: string, conn: Tx | typeof db = db) {
  const [s] = await conn.select({ title: songs.title, isBackfill: songs.isBackfill }).from(songs).where(eq(songs.id, songId));
  if (!s) throw new UserError("Song not found.");
  return s;
}
