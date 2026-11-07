// Resets the database to the seeded demo state:
//   1. drop every table and enum in the public schema
//   2. enable pg_trgm and recreate tables from src/db/schema/  (drizzle-kit push)
//   3. insert fictional demo data (scripts/seed.ts)
//
// SEED_ADMIN_EMAIL (in .env, never committed) becomes an active admin. If it
// is unset, the first person to sign in becomes the admin (R-ROLE-3).
import "dotenv/config";
import { execSync } from "node:child_process";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import { seedDatabase } from "./seed";

async function main() {
  const db = drizzle(neon(process.env.DATABASE_URL!));

  console.log("Dropping tables...");
  const { rows: tables } = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`,
  );
  for (const { tablename } of tables) {
    await db.execute(sql`drop table if exists ${sql.identifier(tablename)} cascade`);
  }

  console.log("Dropping enums...");
  const { rows: types } = await db.execute<{ typname: string }>(
    sql`select t.typname from pg_type t
        join pg_namespace n on n.oid = t.typnamespace
        where n.nspname = 'public' and t.typtype = 'e'`,
  );
  for (const { typname } of types) {
    await db.execute(sql`drop type if exists ${sql.identifier(typname)} cascade`);
  }

  console.log("Enabling pg_trgm...");
  await db.execute(sql`create extension if not exists pg_trgm`);

  console.log("Pushing schema...");
  execSync("npx drizzle-kit push --force", { stdio: "inherit" });

  if (process.argv.includes("--no-seed")) return;
  console.log("Seeding demo data...");
  const result = await seedDatabase(db, process.env.SEED_ADMIN_EMAIL);
  console.log(`  ${result.members} members, ${result.songs} songs, ${result.sessions} sessions`);
  console.log(process.env.SEED_ADMIN_EMAIL ? `  admin: ${process.env.SEED_ADMIN_EMAIL}` : "  (no SEED_ADMIN_EMAIL — first sign-in becomes admin)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
