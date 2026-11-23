import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db";

export type Group = {
  slug: string;
  name: string;
  // Stage names in official line order.
  members: string[];
};

export type GroupsResult = { ok: true; groups: Group[] } | { ok: false; message: string };

// Groups change only when someone runs db:seed, so the page is prerendered and
// refreshed hourly instead of waking Neon on every visit. Tagged so a future
// edit action can call revalidateTag("groups").
export async function getGroups(): Promise<GroupsResult> {
  "use cache";
  cacheTag("groups");
  try {
    const rows = await db.query.groups.findMany({
      columns: { slug: true, name: true },
      with: { members: { columns: { name: true }, orderBy: (m, { asc }) => [asc(m.position)] } },
    });
    cacheLife("hours");
    const groups = rows
      .map((g) => ({ slug: g.slug, name: g.name, members: g.members.map((m) => m.name) }))
      // In JS rather than SQL so "aespa" sorts with the A's whatever the DB collation.
      .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
    return { ok: true, groups };
  } catch (err) {
    // A short lifetime so an outage clears within minutes, not an hour.
    cacheLife("minutes");
    console.error(err instanceof Error ? err.message : err);
    return { ok: false, message: "Couldn't load groups. Try again in a few minutes." };
  }
}
