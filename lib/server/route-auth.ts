import "server-only";
import { getSessionUser } from "@/lib/dal";

/**
 * Route Handler guard: JSON 401/403 instead of a redirect (AC-1).
 * Returns the active user, or a Response to send back.
 */
export async function activeUserOrResponse() {
  const user = await getSessionUser();
  if (!user) return { response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  if (user.status !== "active") return { response: Response.json({ error: "Forbidden" }, { status: 403 }) };
  return { user };
}
