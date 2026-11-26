import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db";
import { getGroupImages, type Photo } from "./images";

export type { Photo };
export type Member = { name: string; image: string | null };

export type Group = {
  slug: string;
  name: string;
  // Latest comeback photo, or null to show the fallback.
  image: Photo | null;
  // In official line order.
  members: Member[];
};

export type GroupsResult = { ok: true; groups: Group[] } | { ok: false; message: string };

type Row = { slug: string; name: string; members: string[] };

// Not cached itself: the groups and their photos are cached separately so a
// failed photo lookup retries within minutes instead of sitting in the hourly
// groups cache (an outer cacheLife overrides inner ones).
export async function getGroups(): Promise<GroupsResult> {
  const data = await loadGroups();
  if (!data.ok) return data;
  const images = await getGroupImages(data.groups);
  const groups = data.groups.map((g) => ({
    slug: g.slug,
    name: g.name,
    image: images[g.slug]?.group ?? null,
    members: g.members.map((name) => ({ name, image: images[g.slug]?.members[name] ?? null })),
  }));
  return { ok: true, groups };
}

// Groups change only when someone runs db:seed, so the page is prerendered and
// refreshed hourly instead of waking Neon on every visit. Tagged so a future
// edit action can call revalidateTag("groups").
async function loadGroups(): Promise<{ ok: true; groups: Row[] } | { ok: false; message: string }> {
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
