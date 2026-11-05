import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { db, type GroupType } from "@/db";

// Personal dashboard (§4.10). Counting rule: only POSTED songs where the
// member held a DANCER role. Year = video published_at in Asia/Singapore.
// All aggregation happens in SQL.

const YEAR_SQL = sql`extract(year from (v.published_at at time zone 'Asia/Singapore'))::int`;

/** The member's dancer covers, one row per song, as a reusable CTE. */
function coversCte(userId: string, year: number | null): SQL {
  return sql`
    with covers as (
      select distinct s.id, s.title, g.id as group_id, g.name as group_name, g.group_type,
             v.video_id, v.published_at, v.view_count, v.like_count, v.comment_count
      from songs s
      join youtube_videos v on v.id = s.youtube_video_id
      join idol_groups g on g.id = s.group_id
      join song_assignments a on a.song_id = s.id and a.role = 'dancer' and a.user_id = ${userId}
      where s.status = 'posted'
      ${year != null ? sql`and ${YEAR_SQL} = ${year}` : sql``}
    )`;
}

type Row = Record<string, unknown>;
async function rows<T extends Row>(q: SQL): Promise<T[]> {
  const res = await db.execute(q);
  return res.rows as T[];
}

export type Top = { label: string; count: number; extra?: string }[];
export type CoverRef = { id: string; title: string; groupName: string; value: number };

export type MemberDashboard = {
  year: number | null;
  years: number[];
  songs: number;
  byType: Record<GroupType, number>;
  totals: { views: number; likes: number; comments: number };
  topGroups: { names: string[]; count: number } | null;
  topIdols: { names: string[]; count: number } | null;
  mostViewed: CoverRef[];
  mostLiked: CoverRef[];
  mostCommented: CoverRef[];
  perPeriod: { label: string; count: number }[];
  groupBreakdown: { name: string; count: number }[];
};

async function topCover(userId: string, year: number | null, col: "view_count" | "like_count" | "comment_count") {
  const c = sql.raw(col);
  const r = await rows<{ id: string; title: string; group_name: string; value: string }>(sql`
    ${coversCte(userId, year)}
    select id, title, group_name, ${c} as value from covers
    where ${c} = (select max(${c}) from covers) and ${c} > 0
    order by published_at`);
  return r.map((x) => ({ id: x.id, title: x.title, groupName: x.group_name, value: Number(x.value) }));
}

export async function getMemberDashboard(userId: string, year: number | null): Promise<MemberDashboard> {
  const [years, totals, byType, groups, idols, mostViewed, mostLiked, mostCommented, perPeriod] = await Promise.all([
    rows<{ y: number }>(sql`
      ${coversCte(userId, null)}
      select distinct extract(year from (published_at at time zone 'Asia/Singapore'))::int as y from covers order by y desc`),
    rows<{ n: string; views: string; likes: string; comments: string }>(sql`
      ${coversCte(userId, year)}
      select count(*) as n, coalesce(sum(view_count),0) as views,
             coalesce(sum(like_count),0) as likes, coalesce(sum(comment_count),0) as comments
      from covers`),
    rows<{ group_type: GroupType; n: string }>(sql`
      ${coversCte(userId, year)}
      select group_type, count(*) as n from covers group by group_type`),
    rows<{ name: string; n: string }>(sql`
      ${coversCte(userId, year)}
      select group_name as name, count(*) as n from covers group by group_name order by n desc, name`),
    // Most covered idol member: positions mapped to an idol member only (A4).
    rows<{ name: string; group_name: string; n: string }>(sql`
      ${coversCte(userId, year)}
      select im.name, g.name as group_name, count(distinct c.id) as n
      from covers c
      join song_assignments a on a.song_id = c.id and a.role = 'dancer' and a.user_id = ${userId}
      join song_positions p on p.id = a.position_id
      join idol_members im on im.id = p.idol_member_id
      join idol_groups g on g.id = im.group_id
      group by im.name, g.name
      order by n desc, im.name`),
    topCover(userId, year, "view_count"),
    topCover(userId, year, "like_count"),
    topCover(userId, year, "comment_count"),
    year != null
      ? rows<{ k: number; n: string }>(sql`
          ${coversCte(userId, year)}
          select m.k, count(c.id) as n
          from generate_series(1, 12) as m(k)
          left join covers c on extract(month from (c.published_at at time zone 'Asia/Singapore'))::int = m.k
          group by m.k order by m.k`)
      : rows<{ k: number; n: string }>(sql`
          ${coversCte(userId, null)}
          select extract(year from (published_at at time zone 'Asia/Singapore'))::int as k, count(*) as n
          from covers group by k order by k`),
  ]);

  const typeCounts: Record<GroupType, number> = { boy_group: 0, girl_group: 0, co_ed: 0, male_solo: 0, female_solo: 0 };
  for (const t of byType) typeCounts[t.group_type] = Number(t.n);

  // FR-DB-3: ties are shown together.
  const ties = (list: { name: string; n: string }[], fmt: (r: { name: string }) => string = (r) => r.name) => {
    if (list.length === 0) return null;
    const max = Number(list[0].n);
    return { names: list.filter((r) => Number(r.n) === max).map(fmt), count: max };
  };

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return {
    year,
    years: years.map((y) => y.y),
    songs: Number(totals[0]?.n ?? 0),
    byType: typeCounts,
    totals: {
      views: Number(totals[0]?.views ?? 0),
      likes: Number(totals[0]?.likes ?? 0),
      comments: Number(totals[0]?.comments ?? 0),
    },
    topGroups: ties(groups),
    topIdols: ties(
      idols.map((i) => ({ name: `${i.name} (${i.group_name})`, n: i.n })),
    ),
    mostViewed,
    mostLiked,
    mostCommented,
    perPeriod: perPeriod.map((p) => ({ label: year != null ? MONTHS[p.k - 1] : String(p.k), count: Number(p.n) })),
    groupBreakdown: groups.map((g) => ({ name: g.name, count: Number(g.n) })),
  };
}

/** Crew-wide totals (FR-DB-5, optional). */
export async function getCrewStats() {
  const [totals, topGroups, perYear] = await Promise.all([
    rows<{ n: string; views: string }>(sql`
      select count(*) as n, coalesce(sum(v.view_count),0) as views
      from songs s join youtube_videos v on v.id = s.youtube_video_id where s.status = 'posted'`),
    rows<{ name: string; n: string }>(sql`
      select g.name, count(*) as n from songs s join idol_groups g on g.id = s.group_id
      where s.status = 'posted' group by g.name order by n desc, g.name limit 5`),
    rows<{ y: number; n: string }>(sql`
      select ${YEAR_SQL} as y, count(*) as n
      from songs s join youtube_videos v on v.id = s.youtube_video_id
      where s.status = 'posted' group by y order by y`),
  ]);
  return {
    covers: Number(totals[0]?.n ?? 0),
    views: Number(totals[0]?.views ?? 0),
    topGroups: topGroups.map((g) => ({ name: g.name, count: Number(g.n) })),
    perYear: perYear.map((p) => ({ label: String(p.y), count: Number(p.n) })),
  };
}
