import "server-only";
import { connection } from "next/server";
import { db, clickTables } from "@/db";
import { COLORS, type Color, type Counts } from "./colors";

export function countClicks(color: Color): Promise<number> {
  return db.$count(clickTables[color]);
}

export async function getCounts(): Promise<Counts> {
  await connection(); // always read fresh counts at request time
  const totals = await Promise.all(COLORS.map(countClicks));
  return Object.fromEntries(COLORS.map((c, i) => [c, totals[i]])) as Counts;
}
