import "server-only";
import { db } from "@/db";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
/** Either the pool or an open transaction. */
export type Conn = typeof db | Tx;
