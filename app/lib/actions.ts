"use server";

import { db, clickTables } from "@/db";
import { isColor } from "./colors";
import { countClicks } from "./data";

export async function incrementCount(color: string): Promise<number> {
  // Server actions are reachable by direct POST, so validate input.
  if (!isColor(color)) throw new Error("Invalid color");

  await db.insert(clickTables[color]).values({});
  return countClicks(color);
}
