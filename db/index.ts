import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

// The WebSocket (Pool) driver rather than neon-http, because several auth
// rules need real interactive transactions (bootstrap admin, last-admin guard).
// Node 22+ provides a global WebSocket, so no `ws` shim is required.
const globalForDb = globalThis as unknown as { pool?: Pool };
const pool =
  globalForDb.pool ?? new Pool({ connectionString: process.env.DATABASE_URL! });
if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

export const db = drizzle(pool, { schema });
export type Db = typeof db;
export * from "./schema";
