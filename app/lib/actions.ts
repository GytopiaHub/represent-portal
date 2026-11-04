"use server";

import { sql } from "drizzle-orm";
import { db, buttonCounts } from "@/db";
import { isColor } from "./colors";

export async function incrementCount(color: string): Promise<number> {
  // Server actions are reachable by direct POST, so validate input.
  if (!isColor(color)) throw new Error("Invalid color");

  const [row] = await db
    .insert(buttonCounts)
    .values({ color, count: 1 })
    .onConflictDoUpdate({
      target: buttonCounts.color,
      set: {
        count: sql`${buttonCounts.count} + 1`,
        updatedAt: sql`now()`,
      },
    })
    .returning({ count: buttonCounts.count });

  return row.count;
}
