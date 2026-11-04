// Resets the database to the seeded state:
//   1. drop every table in the public schema
//   2. recreate tables from db/schema.ts (drizzle-kit push)
//   3. insert the rows from db/seeds/<table>.json
import "dotenv/config";
import { execSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import { clickTables } from "./schema";

type SeedRow = { clickedAt: string };

async function main() {
  const db = drizzle(neon(process.env.DATABASE_URL!));

  console.log("Dropping tables...");
  const { rows } = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`,
  );
  for (const { tablename } of rows) {
    await db.execute(sql`drop table if exists ${sql.identifier(tablename)} cascade`);
  }

  console.log("Pushing schema...");
  execSync("npx drizzle-kit push --force", { stdio: "inherit" });

  console.log("Seeding...");
  for (const [name, table] of Object.entries(clickTables)) {
    const file = path.join(import.meta.dirname, "seeds", `${name}.json`);
    const seed: SeedRow[] = JSON.parse(await readFile(file, "utf8"));
    if (seed.length > 0) {
      await db
        .insert(table)
        .values(seed.map((r) => ({ clickedAt: new Date(r.clickedAt) })));
    }
    console.log(`  ${name}: ${await db.$count(table)} rows`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
