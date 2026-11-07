import type { NextRequest } from "next/server";
import { z } from "zod";
import { getAvailability } from "@/server/availability/engine";
import { activeUserOrResponse } from "@/server/auth-guards";

// GET /api/avails?members=a,b&from=ISO&to=ISO[&refresh=1]  (FR-AV-8)
// Returns merged busy intervals (Google + overrides − RepresENT sessions).
// Only busy/free intervals are ever returned — no event details (SEC-3).

const query = z
  .object({
    members: z.string().transform((s) => s.split(",").filter(Boolean)).pipe(z.array(z.string().min(1).max(100)).min(1).max(50)),
    from: z.iso.datetime({ offset: true }),
    to: z.iso.datetime({ offset: true }),
    refresh: z.enum(["0", "1"]).optional(),
  })
  .refine((q) => Date.parse(q.to) > Date.parse(q.from), "to must be after from")
  .refine((q) => Date.parse(q.to) - Date.parse(q.from) <= 31 * 86_400_000, "range must be 31 days or less");

export async function GET(req: NextRequest) {
  const auth = await activeUserOrResponse();
  if (auth.response) return auth.response;

  const parsed = query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const q = parsed.data;

  // "Refresh from Google" only for your own calendar.
  const refresh = q.refresh === "1" && q.members.length === 1 && q.members[0] === auth.user.id;
  const avails = await getAvailability(q.members, new Date(q.from), new Date(q.to), { refresh });

  const iso = (t: number) => new Date(t).toISOString();
  return Response.json(
    {
      members: [...avails.values()].map((a) => ({
        userId: a.userId,
        name: a.name,
        status: a.connected ? "connected" : "unknown",
        busy: a.effectiveBusy.map((i) => ({ start: iso(i.start), end: iso(i.end) })),
        available: a.available.map((i) => ({ start: iso(i.start), end: iso(i.end) })),
      })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
