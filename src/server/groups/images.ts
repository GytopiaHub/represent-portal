import "server-only";
import { cacheLife, cacheTag } from "next/cache";

// Photos come from the K-pop Wiki on Fandom, whose editors keep each group and
// idol page's lead image on the newest concept photo. We only link to them
// (SRS 2.1: URLs only, never stored). API docs:
// https://www.mediawiki.org/wiki/API:Query and https://www.mediawiki.org/wiki/Extension:PageImages
const API = "https://kpop.fandom.com/api.php";
const GROUP_WIDTH = 960;
const MEMBER_WIDTH = 480;
// The API caps titles per request at 50.
const BATCH = 50;

// Wiki titles for members the matcher gets wrong or can't find, keyed
// "<group slug>/<stage name>".
const TITLE_OVERRIDES: Record<string, string> = {};

type Lookup = { slug: string; name: string; members: string[] };
export type GroupImages = { group: string | null; members: Record<string, string | null> };

type Page = { title: string; missing?: boolean; thumbnail?: { source: string }; links?: { title: string }[] };
type Reply = {
  query?: { normalized?: Rename[]; redirects?: Rename[]; pages?: Page[] };
  continue?: Record<string, string>;
};
type Rename = { from: string; to: string };

export async function getGroupImages(groups: Lookup[]): Promise<Record<string, GroupImages>> {
  "use cache";
  cacheTag("group-images");
  try {
    const result = await lookup(groups);
    // New photos go up with each comeback, so once a day is fresh enough.
    cacheLife("days");
    return result;
  } catch (err) {
    cacheLife("minutes");
    console.error(`Group photos unavailable: ${err instanceof Error ? err.message : err}`);
    return {};
  }
}

async function lookup(groups: Lookup[]) {
  const groupPages = await query(
    groups.map((g) => g.name),
    { prop: "links|pageimages", plnamespace: "0", pllimit: "max", piprop: "thumbnail", pithumbsize: String(GROUP_WIDTH) },
  );

  const memberTitles = new Map<string, string>();
  for (const g of groups) {
    const page = groupPages.get(g.name);
    const links = page?.links?.map((l) => l.title) ?? [];
    for (const m of g.members) {
      const title = TITLE_OVERRIDES[`${g.slug}/${m}`] ?? pickMember(m, [g.name, page?.title], links);
      if (title) memberTitles.set(`${g.slug}/${m}`, title);
    }
  }

  const memberPages = await query([...new Set(memberTitles.values())], {
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: String(MEMBER_WIDTH),
  });

  const result: Record<string, GroupImages> = {};
  for (const g of groups) {
    const members: Record<string, string | null> = {};
    for (const m of g.members) {
      const title = memberTitles.get(`${g.slug}/${m}`);
      members[m] = (title && memberPages.get(title)?.thumbnail?.source) || null;
    }
    result[g.slug] = { group: groupPages.get(g.name)?.thumbnail?.source ?? null, members };
  }
  return result;
}

// Members are matched only against links on their own group's page, so a
// common stage name can't pull in an unrelated idol. A title tagged with the
// group ("Jay (ENHYPEN)") wins; otherwise only an unambiguous match is used.
function pickMember(member: string, groupNames: (string | undefined)[], links: string[]) {
  const key = fold(member);
  const matches = links.filter((t) => fold(t.replace(/\s*\([^)]*\)$/, "")) === key);
  const tagged = matches.find((t) => groupNames.some((n) => n && t.endsWith(`(${n})`)));
  return tagged ?? (matches.length === 1 ? matches[0] : undefined);
}

// NFD splits accents into marks, which the filter drops along with spaces and
// punctuation, so "Rosé" matches "Rose" and "Ni-ki" matches "Ni-Ki".
const fold = (s: string) =>
  s
    .normalize("NFD")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");

// Fetches pages for the given titles, following redirects and API
// continuation. Returns each requested title's final page.
async function query(titles: string[], params: Record<string, string>) {
  const out = new Map<string, Page>();
  for (let i = 0; i < titles.length; i += BATCH) {
    const batch = titles.slice(i, i + BATCH);
    const renames = new Map<string, string>();
    const pages = new Map<string, Page>();
    let cont: Record<string, string> | undefined = {};
    while (cont) {
      const url = new URL(API);
      const all = { action: "query", format: "json", formatversion: "2", redirects: "1", titles: batch.join("|"), ...params, ...cont };
      for (const [k, v] of Object.entries(all)) url.searchParams.set(k, v);
      const res = await fetch(url, { headers: { "User-Agent": "represent-portal" }, signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`Fandom API returned ${res.status}`);
      const data = (await res.json()) as Reply;
      for (const r of [...(data.query?.normalized ?? []), ...(data.query?.redirects ?? [])]) renames.set(r.from, r.to);
      // Continued replies repeat each page with only the next slice of its
      // links, so merge them.
      for (const p of data.query?.pages ?? []) {
        const prev = pages.get(p.title);
        pages.set(p.title, prev ? { ...prev, ...p, links: [...(prev.links ?? []), ...(p.links ?? [])] } : p);
      }
      cont = data.continue;
    }
    for (const t of batch) {
      let title = t;
      for (let hops = 0; renames.has(title) && hops < 5; hops++) title = renames.get(title)!;
      const page = pages.get(title);
      if (page && !page.missing) out.set(t, page);
    }
  }
  return out;
}
