// Resets the database to an empty schema:
//   1. drop every table and enum in the public schema
//   2. recreate tables from src/db/schema/ (drizzle-kit push)
// Destructive: run it yourself, against a development branch.
import "dotenv/config";
import { execSync } from "node:child_process";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";

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
    sql`select t.typname from pg_type t join pg_namespace n on n.oid = t.typnamespace
        where n.nspname = 'public' and t.typtype = 'e'`,
  );
  for (const { typname } of types) {
    await db.execute(sql`drop type if exists ${sql.identifier(typname)} cascade`);
  }

  console.log("Pushing schema...");
  execSync("npx drizzle-kit push --force", { stdio: "inherit" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
