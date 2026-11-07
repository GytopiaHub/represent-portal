import { activeUserOrResponse } from "@/server/auth-guards";
import { countUnread } from "@/server/notify";

// Polled by the bell every 60 s while the tab is visible (FR-NOT-1).
export async function GET() {
  const auth = await activeUserOrResponse();
  if (auth.response) return auth.response;
  const count = await countUnread(auth.user.id);
  return Response.json({ count }, { headers: { "Cache-Control": "no-store" } });
}
