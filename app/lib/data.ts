import "server-only";
import { connection } from "next/server";
import { db, buttonCounts } from "@/db";
import { COLORS, type Counts } from "./colors";

export async function getCounts(): Promise<Counts> {
  await connection(); // always read fresh counts at request time
  const rows = await db.select().from(buttonCounts);

  // Buttons without a row yet show 0.
  const counts = Object.fromEntries(COLORS.map((c) => [c, 0])) as Counts;
  for (const row of rows) {
    if (row.color in counts) counts[row.color as keyof Counts] = row.count;
  }
  return counts;
}
