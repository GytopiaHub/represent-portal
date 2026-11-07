import { timingSafeEqual } from "node:crypto";
import { runTick } from "@/server/jobs/tick";

// Scheduled jobs (§7). Called hourly by GitHub Actions (POST) and daily by
// Vercel cron as a fallback (GET — Vercel sends the same bearer header).
// Requires Authorization: Bearer ${CRON_SECRET} (SEC-4, AC-9).

export const maxDuration = 60;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function handle(req: Request) {
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const result = await runTick();
  return Response.json({ ok: true, ...result });
}

export const POST = handle;
export const GET = handle;
