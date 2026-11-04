import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import { buttonCounts } from "./schema";

const seedData = [
  { color: "red", count: 52 },
  { color: "green", count: 67 },
  { color: "blue", count: 69 },
];

async function main() {
  const db = drizzle(neon(process.env.DATABASE_URL!));

  // Upsert so the seed can be re-run: it resets each button to its fixed value.
  await db
    .insert(buttonCounts)
    .values(seedData)
    .onConflictDoUpdate({
      target: buttonCounts.color,
      set: { count: sql`excluded.count`, updatedAt: sql`now()` },
    });

  const rows = await db.select().from(buttonCounts);
  console.table(rows);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
