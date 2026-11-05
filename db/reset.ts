// Resets the database to an empty state:
//   1. drop every table and enum in the public schema
//   2. recreate them from db/schema.ts (drizzle-kit push)
//   3. insert pre-approved users from db/seeds/users.json
// If the seed has no admin, the first person to sign in becomes the admin
// (R-ROLE-3).
import "dotenv/config";
import { execSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { users, type UserRole, type UserStatus } from "./schema";
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
    sql`select t.typname from pg_type t
        join pg_namespace n on n.oid = t.typnamespace
        where n.nspname = 'public' and t.typtype = 'e'`,
  );
  for (const { typname } of types) {
    await db.execute(sql`drop type if exists ${sql.identifier(typname)} cascade`);
  }

  console.log("Pushing schema...");
  execSync("npx drizzle-kit push --force", { stdio: "inherit" });

  // Pre-approved users. Each row is claimed by the Google account with the
  // same email on first sign-in (see allowDangerousEmailAccountLinking).
  console.log("Seeding users...");
  const file = path.join(import.meta.dirname, "seeds", "users.json");
  const seed: SeedUser[] = JSON.parse(await readFile(file, "utf8"));
  for (const u of seed) {
    await db
      .insert(users)
      .values({
        email: u.email.toLowerCase(),
        name: u.name ?? null,
        role: u.role ?? "member",
        status: u.status ?? "active",
        reviewedAt: new Date(),
      })
      .onConflictDoNothing();
    console.log(`  ${u.email} (${u.role ?? "member"})`);
  }
}

type SeedUser = {
  email: string;
  name?: string;
  role?: UserRole;
  status?: UserStatus;
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
