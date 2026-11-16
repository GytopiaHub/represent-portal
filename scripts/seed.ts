// Loads the reference data in src/db/seed/ (SRS 6.2). Safe to run again:
// groups are upserted by slug and each seeded group's members are replaced,
// all in one transaction. Groups not in the seed are left alone.
import "dotenv/config";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { eq, sql } from "drizzle-orm";
import { groupMembers, groups } from "../src/db/schema";
import { seedGroups } from "../src/db/seed/groups";

async function main() {
  // The Pool driver, because neon-http has no interactive transactions.
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const db = drizzle(pool);
  try {
    await db.transaction(async (tx) => {
      for (const g of seedGroups) {
        const [row] = await tx
          .insert(groups)
          .values({ slug: g.slug, name: g.name })
          .onConflictDoUpdate({ target: groups.slug, set: { name: sql`excluded.name` } })
          .returning({ id: groups.id });
        await tx.delete(groupMembers).where(eq(groupMembers.groupId, row.id));
        await tx
          .insert(groupMembers)
          .values(g.members.map((name, i) => ({ groupId: row.id, name, position: i + 1 })));
      }
    });
    const members = seedGroups.reduce((n, g) => n + g.members.length, 0);
    console.log(`Seeded ${seedGroups.length} groups and ${members} members.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
