import { and, eq, isNull } from "drizzle-orm";
import { db, notifications } from "@/db";
import { activeUserOrResponse } from "@/lib/server/route-auth";

// Polled by the bell every 60 s while the tab is visible (FR-NOT-1).
export async function GET() {
  const auth = await activeUserOrResponse();
  if (auth.response) return auth.response;
  const count = await db.$count(notifications, and(eq(notifications.userId, auth.user.id), isNull(notifications.readAt)));
  return Response.json({ count }, { headers: { "Cache-Control": "no-store" } });
}
