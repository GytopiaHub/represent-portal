// Seeds a fresh database with fictional demo data (NFR-6, SEC-7):
// members, guests, idol groups & rosters, posted covers with YouTube stats
// history, in-progress crews with invitations, practices/filming, RSVPs,
// availability overrides and notifications.
//
//   npm run db:seed     (on an empty schema; db:reset runs it automatically)
//
// SEED_ADMIN_EMAIL (from .env, never committed) becomes an active admin who
// is already part of several crews, so the dashboard has data on first login.
import { eq as eqSql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { MOCK_CHANNEL_ID, MOCK_CALENDARS, seededRandom } from "./fixtures";
import * as s from "./schema";
import type { CrewRole, GroupType, SongStatus } from "./schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = PgDatabase<PgQueryResultHKT, any>;

const TZ_OFFSET_H = 8; // Asia/Singapore, no DST
const DAY = 86_400_000;

/** A Date for `daysFromNow` at hh:mm Singapore time. */
function sgt(daysFromNow: number, hh: number, mm = 0) {
  const now = new Date();
  const sgNow = new Date(now.getTime() + TZ_OFFSET_H * 3600_000);
  const d = Date.UTC(sgNow.getUTCFullYear(), sgNow.getUTCMonth(), sgNow.getUTCDate() + daysFromNow, hh - TZ_OFFSET_H, mm);
  return new Date(d);
}

const MEMBERS = [
  { key: "jamie", name: "Jamie Lim", stage: "Jamie", cals: ["primary", "work"] },
  { key: "pri", name: "Priya Nair", stage: "Pri", cals: ["primary", "school"] },
  { key: "ethan", name: "Ethan Wong", stage: "E.T.", cals: ["primary", "work"] },
  { key: "chloe", name: "Chloe Tan", stage: null, cals: ["primary", "school"] },
  { key: "daniel", name: "Daniel Goh", stage: "Dan", cals: ["primary", "work"] },
  { key: "mei", name: "Mei Ling Ong", stage: "Mei", cals: ["primary"] },
  { key: "aiden", name: "Aiden Koh", stage: null, cals: ["primary", "school"] },
  { key: "sarah", name: "Sarah Lee", stage: "Sae", cals: ["primary", "work"] },
  { key: "ryan", name: "Ryan Chua", stage: null, cals: ["primary", "work"] },
  { key: "hana", name: "Hana Yeo", stage: "Hana", cals: ["primary", "school"] },
  { key: "kai", name: "Kai Ng", stage: "Kai", cals: [] }, // no calendar → "unknown"
  { key: "zoe", name: "Zoe Teo", stage: "Zoe", cals: [], status: "removed" as const },
  { key: "lucas", name: "Lucas Ho", stage: null, cals: [], status: "pending" as const },
  { key: "nina", name: "Nina Sim", stage: null, cals: [], status: "pending" as const },
  { key: "tom", name: "Tom Phua", stage: null, cals: [], status: "rejected" as const },
];

const GUESTS = [
  { key: "rina", name: "Rina Koh", instagram: "rina.dances" },
  { key: "marcus", name: "Marcus Lee", instagram: "marcus.films" },
  { key: "sofia", name: "Sofia Reyes", instagram: null, note: "Friend of Pri, NUS dance club" },
];

const GROUPS: { key: string; name: string; kr: string; type: GroupType; members: string[] }[] = [
  { key: "nj", name: "NewJeans", kr: "뉴진스", type: "girl_group", members: ["Minji", "Hanni", "Danielle", "Haerin", "Hyein"] },
  { key: "ive", name: "IVE", kr: "아이브", type: "girl_group", members: ["Yujin", "Gaeul", "Rei", "Wonyoung", "Liz", "Leeseo"] },
  { key: "lsf", name: "LE SSERAFIM", kr: "르세라핌", type: "girl_group", members: ["Chaewon", "Sakura", "Yunjin", "Kazuha", "Eunchae"] },
  { key: "aespa", name: "aespa", kr: "에스파", type: "girl_group", members: ["Karina", "Giselle", "Winter", "Ningning"] },
  { key: "illit", name: "ILLIT", kr: "아일릿", type: "girl_group", members: ["Yunah", "Minju", "Moka", "Wonhee", "Iroha"] },
  { key: "twice", name: "TWICE", kr: "트와이스", type: "girl_group", members: ["Nayeon", "Jeongyeon", "Momo", "Sana", "Jihyo", "Mina", "Dahyun", "Chaeyoung", "Tzuyu"] },
  { key: "kol", name: "KISS OF LIFE", kr: "키스오브라이프", type: "girl_group", members: ["Julie", "Natty", "Belle", "Haneul"] },
  { key: "skz", name: "Stray Kids", kr: "스트레이 키즈", type: "boy_group", members: ["Bang Chan", "Lee Know", "Changbin", "Hyunjin", "Han", "Felix", "Seungmin", "I.N"] },
  { key: "riize", name: "RIIZE", kr: "라이즈", type: "boy_group", members: ["Shotaro", "Eunseok", "Sungchan", "Wonbin", "Sohee", "Anton"] },
  { key: "enh", name: "ENHYPEN", kr: "엔하이픈", type: "boy_group", members: ["Jungwon", "Heeseung", "Jay", "Jake", "Sunghoon", "Sunoo", "Ni-ki"] },
  { key: "kard", name: "KARD", kr: "카드", type: "co_ed", members: ["J.Seph", "BM", "Somin", "Jiwoo"] },
  { key: "jennie", name: "JENNIE", kr: "제니", type: "female_solo", members: ["Jennie"] },
  { key: "taemin", name: "TAEMIN", kr: "태민", type: "male_solo", members: ["Taemin"] },
];

/** Who: "admin", "m:<memberKey>", "g:<guestKey>", or null (unfilled). */
type Who = string | null;

type SongSpec = {
  title: string;
  group: string;
  status: SongStatus;
  /** One entry per position, in roster order (null = unfilled). */
  dancers: Who[];
  custom?: { label: string; who: Who }[];
  ic: Who[];
  videographers?: Who[];
  editors?: Who[];
  posted?: { daysAgo: number; views: number };
  target?: number; // target post date, days from now
  description?: string;
};

const POSTED: SongSpec[] = [
  { title: "Super Shy", group: "nj", status: "posted", dancers: ["m:pri", "admin", "m:chloe", "m:mei", "m:hana"], ic: ["m:pri"], videographers: ["g:marcus"], editors: ["m:ethan"], posted: { daysAgo: 470, views: 48200 } },
  { title: "Easy", group: "lsf", status: "posted", dancers: ["m:sarah", "admin", "m:chloe", "m:hana", "g:rina"], ic: ["m:sarah"], videographers: ["m:daniel"], editors: ["m:daniel"], posted: { daysAgo: 430, views: 22100 } },
  { title: "Baddie", group: "ive", status: "posted", dancers: ["m:mei", "m:pri", "m:hana", "admin", "m:sarah", "m:chloe"], ic: ["m:mei"], videographers: ["m:ryan"], editors: ["m:ryan"], posted: { daysAgo: 400, views: 31800 } },
  { title: "S-Class", group: "skz", status: "posted", dancers: ["m:ethan", "m:daniel", "m:aiden", "m:ryan", "m:kai", "m:jamie", "g:marcus", "m:zoe"], ic: ["m:ethan"], videographers: ["m:pri"], editors: ["admin"], posted: { daysAgo: 380, views: 27600 } },
  { title: "Supernova", group: "aespa", status: "posted", dancers: ["admin", "m:sarah", "m:mei", "m:zoe"], ic: ["admin"], videographers: ["g:marcus"], editors: ["m:jamie"], posted: { daysAgo: 350, views: 119400 } },
  { title: "ONE SPARK", group: "twice", status: "posted", dancers: ["m:pri", "m:chloe", "m:mei", "m:hana", "m:sarah", "m:zoe", "g:sofia", "g:rina", "m:kai"], ic: ["m:chloe"], videographers: ["m:daniel"], editors: ["m:daniel"], posted: { daysAgo: 330, views: 15400 } },
  { title: "Ring The Alarm", group: "kard", status: "posted", dancers: ["m:ethan", "m:aiden", "m:hana", "m:chloe"], ic: ["m:aiden"], videographers: ["m:ryan"], editors: ["m:aiden"], posted: { daysAgo: 300, views: 9800 } },
  { title: "How Sweet", group: "nj", status: "posted", dancers: ["m:hana", "admin", "m:mei", "m:pri", "m:chloe"], ic: ["m:hana"], videographers: ["m:ryan"], editors: ["m:ethan"], posted: { daysAgo: 270, views: 61300 } },
  { title: "HEYA", group: "ive", status: "posted", dancers: ["m:sarah", "m:chloe", "admin", "m:hana", "m:mei", "g:rina"], ic: ["admin"], videographers: ["m:daniel"], editors: ["m:jamie"], posted: { daysAgo: 230, views: 38700 } },
  { title: "Boom Boom Bass", group: "riize", status: "posted", dancers: ["m:jamie", "m:ethan", "m:aiden", "m:daniel", "m:ryan", "m:kai"], ic: ["m:jamie"], videographers: ["m:pri"], editors: ["m:jamie"], posted: { daysAgo: 200, views: 26100 } },
  { title: "CRAZY", group: "lsf", status: "posted", dancers: ["admin", "m:pri", "m:sarah", "m:mei", "m:chloe"], ic: ["m:pri"], videographers: ["g:marcus"], editors: ["m:ethan"], posted: { daysAgo: 160, views: 52900 } },
  { title: "XO (Only If You Say Yes)", group: "enh", status: "posted", dancers: ["m:ethan", "m:jamie", "m:aiden", "m:daniel", "m:ryan", "m:kai", "g:marcus"], ic: ["m:daniel"], videographers: ["m:hana"], editors: ["m:daniel"], posted: { daysAgo: 120, views: 17300 } },
  { title: "like JENNIE", group: "jennie", status: "posted", dancers: ["m:mei"], ic: ["m:mei"], videographers: ["m:ryan"], editors: ["m:mei"], posted: { daysAgo: 95, views: 44800 } },
  { title: "Whiplash", group: "aespa", status: "posted", dancers: ["admin", "m:hana", "m:sarah", "m:chloe"], ic: ["admin"], videographers: ["m:daniel"], editors: ["admin"], posted: { daysAgo: 70, views: 88100 } },
  { title: "Midas Touch", group: "kol", status: "posted", dancers: ["m:pri", "m:sarah", "admin", "m:mei"], ic: ["m:sarah"], videographers: ["g:marcus"], editors: ["m:ethan"], posted: { daysAgo: 40, views: 21500 } },
  { title: "Chk Chk Boom", group: "skz", status: "posted", dancers: ["m:jamie", "m:ethan", "m:aiden", "m:daniel", "m:ryan", "m:kai", "g:marcus", "m:hana"], ic: ["m:ethan"], videographers: ["admin"], editors: ["m:ethan"], posted: { daysAgo: 21, views: 12900 } },
  { title: "Guilty", group: "taemin", status: "posted", dancers: ["m:jamie"], ic: ["m:jamie"], videographers: ["m:aiden"], editors: ["m:jamie"], posted: { daysAgo: 9, views: 6400 } },
];

const ACTIVE: SongSpec[] = [
  { title: "Supernatural", group: "nj", status: "recruiting", dancers: ["admin", "m:hana", "g:rina", null, null], ic: ["admin"], target: 45, description: "Full-length cover, aiming for the outdoor shoot at Gardens by the Bay before the rainy season." },
  { title: "Accendio", group: "ive", status: "practising", dancers: ["m:sarah", "m:chloe", "m:mei", "admin", "m:pri", "m:hana"], ic: ["m:sarah"], videographers: ["g:marcus"], target: 30 },
  { title: "Sticky", group: "kol", status: "filming", dancers: ["m:pri", "m:mei", "m:chloe", "m:kai"], ic: ["m:pri"], videographers: ["m:daniel"], editors: ["m:ethan"], target: 10 },
  { title: "HOT", group: "lsf", status: "editing", dancers: ["m:sarah", "admin", "m:hana", "m:chloe", "m:mei"], ic: ["m:hana"], editors: ["admin"], videographers: ["m:ryan"], target: 3 },
  { title: "Bite Me", group: "enh", status: "cancelled", dancers: ["m:ethan", "admin", "m:aiden", null, null, null, null], ic: ["m:ethan"] },
  { title: "Armageddon", group: "aespa", status: "recruiting", dancers: [null, "m:mei", null, null], custom: [{ label: "Center", who: null }, { label: "Backup 1", who: "g:sofia" }], ic: ["m:jamie"], target: 60 },
];

function videoTitle(group: string, kr: string, title: string) {
  return `${group} (${kr}) '${title}' Dance Cover | RepresENT`;
}

export async function seedDatabase(db: AnyDb, adminEmail: string | undefined) {
  const rnd = seededRandom("represent-seed");
  const now = new Date();

  // --- Users ---------------------------------------------------------------
  const ids = new Map<string, string>();
  for (const m of MEMBERS) {
    const [row] = await db
      .insert(s.users)
      .values({
        name: m.name,
        email: `${m.key}@example.com`,
        stageName: m.stage,
        status: m.status ?? "active",
        role: m.key === "jamie" ? "admin" : "member",
        instagramHandle: m.status ? null : `${m.key}.represent`,
        onboardedAt: m.status ? null : new Date(now.getTime() - 500 * DAY),
        createdAt: new Date(now.getTime() - (m.status === "pending" ? 1 + rnd() * 3 : 500 + rnd() * 200) * DAY),
        reviewedAt: m.status === "pending" ? null : new Date(now.getTime() - 480 * DAY),
      })
      .returning({ id: s.users.id });
    ids.set(`m:${m.key}`, row.id);
    if (m.cals.length) {
      await db.insert(s.memberCalendars).values(
        m.cals.map((c) => ({ userId: row.id, googleCalendarId: c, summary: MOCK_CALENDARS.find((x) => x.id === c)!.summary })),
      );
    }
  }

  if (adminEmail) {
    const [admin] = await db
      .insert(s.users)
      .values({ email: adminEmail.toLowerCase(), status: "active", role: "admin", reviewedAt: now })
      .returning({ id: s.users.id });
    ids.set("admin", admin.id);
  } else {
    // No admin email: let Jamie stand in so the crews still make sense.
    ids.set("admin", ids.get("m:jamie")!);
  }

  // --- Guests ----------------------------------------------------------------
  for (const g of GUESTS) {
    const [row] = await db
      .insert(s.guests)
      .values({ name: g.name, instagram: g.instagram, contactNote: g.note ?? null, createdBy: ids.get("m:pri") })
      .returning({ id: s.guests.id });
    ids.set(`g:${g.key}`, row.id);
  }

  // --- Groups & rosters ------------------------------------------------------
  const groups = new Map<string, { id: string; name: string; kr: string; roster: string[] }>();
  for (const g of GROUPS) {
    const [row] = await db
      .insert(s.idolGroups)
      .values({ name: g.name, nameKr: g.kr, groupType: g.type })
      .returning({ id: s.idolGroups.id });
    const roster: string[] = [];
    for (const [i, name] of g.members.entries()) {
      const [m] = await db
        .insert(s.idolMembers)
        .values({ groupId: row.id, name, sortOrder: i })
        .returning({ id: s.idolMembers.id });
      roster.push(m.id);
    }
    groups.set(g.key, { id: row.id, name: g.name, kr: g.kr, roster });
  }

  // --- Songs -----------------------------------------------------------------
  const holder = (who: Who) =>
    who == null ? null : who.startsWith("g:") ? { guestId: ids.get(who)! } : { userId: ids.get(who)! };

  const songIds = new Map<string, string>();
  let vidSeq = 0;

  async function addSong(spec: SongSpec) {
    const g = groups.get(spec.group)!;
    let videoDbId: string | null = null;

    if (spec.posted) {
      const publishedAt = new Date(now.getTime() - spec.posted.daysAgo * DAY);
      const v = spec.posted.views;
      const likes = Math.round(v * (0.05 + rnd() * 0.03));
      const comments = Math.round(v * (0.004 + rnd() * 0.004));
      const [video] = await db
        .insert(s.youtubeVideos)
        .values({
          videoId: `mockVID${String(++vidSeq).padStart(4, "0")}`,
          title: videoTitle(g.name, g.kr, spec.title),
          publishedAt,
          duration: "PT3M30S",
          viewCount: v,
          likeCount: likes,
          commentCount: comments,
          statsUpdatedAt: now,
          backfillState: "tagged",
        })
        .returning({ id: s.youtubeVideos.id });
      videoDbId = video.id;

      // 30 days of daily snapshots growing towards today's numbers.
      const history = [];
      for (let d = 29; d >= 0; d--) {
        const day = new Date(now.getTime() - d * DAY);
        if (day < publishedAt) continue;
        const f = 1 - d * (0.004 + rnd() * 0.002);
        history.push({
          videoId: video.id,
          capturedOn: day.toISOString().slice(0, 10),
          viewCount: Math.round(v * f),
          likeCount: Math.round(likes * f),
          commentCount: Math.round(comments * f),
        });
      }
      if (history.length) await db.insert(s.videoStatsHistory).values(history);
    }

    const icId = holder(spec.ic[0])!;
    const [song] = await db
      .insert(s.songs)
      .values({
        title: spec.title,
        groupId: g.id,
        status: spec.status,
        targetPostDate: spec.target ? new Date(now.getTime() + spec.target * DAY).toISOString().slice(0, 10) : null,
        description: spec.description ?? null,
        referenceLinks: [{ label: "Original MV", url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${g.name} ${spec.title} MV`)}` }],
        youtubeVideoId: videoDbId,
        createdBy: "userId" in icId ? icId.userId : null,
        createdAt: spec.posted ? new Date(now.getTime() - (spec.posted.daysAgo + 40) * DAY) : new Date(now.getTime() - 20 * DAY),
      })
      .returning({ id: s.songs.id });
    songIds.set(spec.title, song.id);

    const assignments: { role: CrewRole; positionId: string | null; userId?: string; guestId?: string }[] = [];
    for (const [i, who] of spec.dancers.entries()) {
      const [pos] = await db
        .insert(s.songPositions)
        .values({ songId: song.id, idolMemberId: g.roster[i], sortOrder: i })
        .returning({ id: s.songPositions.id });
      const h = holder(who);
      if (h) assignments.push({ role: "dancer", positionId: pos.id, ...h });
    }
    for (const [j, c] of (spec.custom ?? []).entries()) {
      const [pos] = await db
        .insert(s.songPositions)
        .values({ songId: song.id, customLabel: c.label, sortOrder: spec.dancers.length + j })
        .returning({ id: s.songPositions.id });
      const h = holder(c.who);
      if (h) assignments.push({ role: "dancer", positionId: pos.id, ...h });
    }
    for (const who of spec.ic) assignments.push({ role: "ic", positionId: null, ...holder(who)! });
    for (const who of spec.videographers ?? []) assignments.push({ role: "videographer", positionId: null, ...holder(who)! });
    for (const who of spec.editors ?? []) assignments.push({ role: "editor", positionId: null, ...holder(who)! });
    if (assignments.length) await db.insert(s.songAssignments).values(assignments.map((a) => ({ songId: song.id, ...a })));
    return song.id;
  }

  for (const spec of [...POSTED, ...ACTIVE]) await addSong(spec);

  // --- Invitations (pending + history) ---------------------------------------
  const positionsOf = async (songTitle: string) =>
    db.select().from(s.songPositions).where(eqSql(s.songPositions.songId, songIds.get(songTitle)!));

  const supernatural = await positionsOf("Supernatural");
  const supIc = ids.get("admin")!;
  await db.insert(s.songInvitations).values([
    { songId: songIds.get("Supernatural")!, role: "dancer", positionId: supernatural[3].id, inviteeUserId: ids.get("m:chloe")!, invitedBy: supIc },
    { songId: songIds.get("Supernatural")!, role: "dancer", positionId: supernatural[4].id, inviteeUserId: ids.get("m:aiden")!, invitedBy: supIc, status: "declined", respondedAt: new Date(now.getTime() - 2 * DAY) },
    { songId: songIds.get("Supernatural")!, role: "videographer", inviteeUserId: ids.get("m:daniel")!, invitedBy: supIc },
    // The admin has an invitation waiting on their dashboard.
    { songId: songIds.get("Sticky")!, role: "videographer", inviteeUserId: ids.get("admin")!, invitedBy: ids.get("m:pri")! },
  ]);
  const armageddon = await positionsOf("Armageddon");
  await db.insert(s.songInvitations).values({
    songId: songIds.get("Armageddon")!,
    role: "dancer",
    positionId: armageddon[0].id,
    inviteeUserId: ids.get("admin")!,
    invitedBy: ids.get("m:jamie")!,
  });

  // --- Practices & filming ---------------------------------------------------
  type Sess = { at?: Date; song: string; kind: "practice" | "filming"; day: number; h: number; m?: number; hours: number; loc: string; booking?: "not_needed" | "to_book" | "booked"; ref?: string; notes?: string; status?: "scheduled" | "cancelled"; checklist?: string };
  const SESSIONS: Sess[] = [
    { song: "Accendio", kind: "practice", day: -6, h: 19, m: 30, hours: 2, loc: "Studio Fluid, Bugis", booking: "booked", ref: "SF-20811" },
    { at: new Date(Math.ceil((Date.now() + 20 * 3600_000) / 1_800_000) * 1_800_000), song: "Accendio", kind: "practice", day: 1, h: 19, m: 30, hours: 2, loc: "Studio Fluid, Bugis", booking: "booked", ref: "SF-21044", notes: "Run chorus 2 formations. Bring knee pads." },
    { song: "Accendio", kind: "practice", day: 5, h: 14, hours: 3, loc: "*SCAPE dance studio", booking: "to_book" },
    { song: "Accendio", kind: "filming", day: 12, h: 8, hours: 4, loc: "Marina Barrage", checklist: "White outfits\nPortable speaker\nSpare batteries" },
    { song: "Supernatural", kind: "practice", day: 6, h: 20, hours: 2, loc: "NUS UTown dance studio", booking: "to_book" },
    { song: "Sticky", kind: "filming", day: 3, h: 7, m: 30, hours: 3, loc: "Sentosa – Siloso Beach", checklist: "Summer outfits\nReflector\nWater" },
    { song: "Sticky", kind: "practice", day: -3, h: 19, hours: 2, loc: "Studio Fluid, Bugis", booking: "booked" },
    { song: "Bite Me", kind: "practice", day: 2, h: 19, hours: 2, loc: "TBD", status: "cancelled" },
  ];
  const sessionIds: { id: string; song: string; future: boolean; status: string }[] = [];
  for (const x of SESSIONS) {
    const start = x.at ?? sgt(x.day, x.h, x.m ?? 0); // `at`: within 24 h, so cron sends an RSVP reminder
    const [row] = await db
      .insert(s.sessionsSched)
      .values({
        songId: songIds.get(x.song)!,
        kind: x.kind,
        startsAt: start,
        endsAt: new Date(start.getTime() + x.hours * 3600_000),
        locationText: x.loc,
        locationUrl: `https://maps.google.com/?q=${encodeURIComponent(x.loc)}`,
        bookingStatus: x.booking ?? "not_needed",
        bookingRef: x.ref ?? null,
        notes: x.notes ?? null,
        checklist: x.checklist ?? null,
        status: x.status ?? "scheduled",
        createdBy: ids.get("m:sarah"),
      })
      .returning({ id: s.sessionsSched.id });
    sessionIds.push({ id: row.id, song: x.song, future: x.day >= 0, status: x.status ?? "scheduled" });
    if (x.kind === "filming") {
      await db.insert(s.filmingLocations).values([
        { sessionId: row.id, name: x.loc, mapUrl: `https://maps.google.com/?q=${encodeURIComponent(x.loc)}`, isFinal: true },
        { sessionId: row.id, name: "Backup: Esplanade Outdoor Theatre", mapUrl: "https://maps.google.com/?q=Esplanade+Outdoor+Theatre", notes: "If it rains, use the covered area" },
      ]);
    }
  }

  // RSVPs + calendar mappings for scheduled sessions
  const crewOf = async (songTitle: string) =>
    (await db.select().from(s.songAssignments).where(eqSql(s.songAssignments.songId, songIds.get(songTitle)!)))
      .filter((a) => a.userId)
      .map((a) => a.userId!);
  for (const sess of sessionIds.filter((x) => x.status === "scheduled")) {
    const crew = [...new Set(await crewOf(sess.song))];
    const rsvps = crew
      .filter((u) => u !== ids.get("admin") && rnd() < 0.7)
      .map((u) => ({ sessionId: sess.id, userId: u, response: rnd() < 0.8 ? ("going" as const) : ("not_going" as const), reason: null as string | null }));
    for (const r of rsvps) if (r.response === "not_going") r.reason = "Work shift, sorry!";
    if (rsvps.length) await db.insert(s.sessionRsvps).values(rsvps);
    if (sess.future) {
      await db.insert(s.calendarEvents).values(
        crew.map((u) => {
          const disconnected = u === ids.get("m:kai");
          return {
            sessionId: sess.id,
            userId: u,
            googleEventId: disconnected ? null : `mock_evt_${Math.floor(rnd() * 1e9).toString(36)}`,
            syncState: disconnected ? ("failed" as const) : ("ok" as const),
            attempts: disconnected ? 1 : 0,
            lastError: disconnected ? "Google Calendar not connected" : null,
            lastSyncedAt: disconnected ? null : now,
          };
        }),
      );
    }
  }

  // --- Backfill queue & linkable videos ---------------------------------------
  await db.insert(s.youtubeVideos).values([
    { videoId: "mockOLD0001", title: "TWICE (트와이스) 'SET ME FREE' Dance Cover | RepresENT", publishedAt: new Date(now.getTime() - 720 * DAY), viewCount: 8400, likeCount: 610, commentCount: 44, backfillState: "untagged", statsUpdatedAt: now },
    { videoId: "mockOLD0002", title: "LE SSERAFIM (르세라핌) 'UNFORGIVEN' Dance Cover | RepresENT", publishedAt: new Date(now.getTime() - 690 * DAY), viewCount: 12200, likeCount: 940, commentCount: 71, backfillState: "untagged", statsUpdatedAt: now },
    { videoId: "mockOLD0003", title: "BTS (방탄소년단) 'Dynamite' Dance Cover | RepresENT", publishedAt: new Date(now.getTime() - 900 * DAY), viewCount: 30500, likeCount: 2100, commentCount: 190, backfillState: "untagged", statsUpdatedAt: now },
    { videoId: "mockOLD0004", title: "Behind the scenes: our first showcase 🎬", publishedAt: new Date(now.getTime() - 650 * DAY), viewCount: 1300, likeCount: 120, commentCount: 15, backfillState: "untagged", statsUpdatedAt: now },
    { videoId: "mockOLD0005", title: "RepresENT Recruitment 2025 — auditions open!", publishedAt: new Date(now.getTime() - 300 * DAY), viewCount: 2100, likeCount: 150, commentCount: 33, backfillState: "ignored", statsUpdatedAt: now },
    // Uploaded for the in-progress "HOT" song — ready to be linked (FR-YT-2).
    { videoId: "mockHOT0001", title: "LE SSERAFIM (르세라핌) 'HOT' Dance Cover | RepresENT", publishedAt: new Date(now.getTime() - 1 * DAY), viewCount: 2300, likeCount: 260, commentCount: 31, backfillState: "untagged", statsUpdatedAt: now },
  ]);

  // --- Availability overrides ------------------------------------------------
  await db.insert(s.availOverrides).values([
    { userId: ids.get("m:sarah")!, kind: "busy", startsAt: sgt(2, 18), endsAt: sgt(2, 23), note: "Family dinner" },
    { userId: ids.get("m:pri")!, kind: "busy", startsAt: sgt(-1, 19), endsAt: sgt(-1, 21), recurrence: "weekly", note: "Tuition" },
    { userId: ids.get("m:chloe")!, kind: "free", startsAt: sgt(4, 14), endsAt: sgt(4, 18), note: "Lecture cancelled" },
  ]);

  // --- Group request, notifications, settings --------------------------------
  await db.insert(s.groupRequests).values({ requestedBy: ids.get("m:aiden")!, name: "BTS", note: "For tagging our old Dynamite cover" });

  const adminId = ids.get("admin")!;
  await db.insert(s.notifications).values([
    { userId: adminId, type: "invited", payload: { title: "You're invited to Sticky", body: "as Videographer", href: `/songs/${songIds.get("Sticky")}` }, createdAt: new Date(now.getTime() - 3 * 3600_000) },
    { userId: adminId, type: "invited", payload: { title: "You're invited to Armageddon", body: "as Dancer (Karina)", href: `/songs/${songIds.get("Armageddon")}` }, createdAt: new Date(now.getTime() - 26 * 3600_000) },
    { userId: adminId, type: "group_requested", payload: { title: "Group requested: BTS", body: "Aiden Koh — For tagging our old Dynamite cover", href: "/admin/groups" }, createdAt: new Date(now.getTime() - 2 * DAY) },
    { userId: adminId, type: "signup_pending", payload: { title: "Lucas Ho is waiting for approval", href: "/admin/approvals" }, createdAt: new Date(now.getTime() - 1 * DAY) },
    { userId: adminId, type: "invite_response", payload: { title: "Aiden Koh declined your invite", body: "Supernatural · Dancer", href: `/songs/${songIds.get("Supernatural")}?tab=crew` }, createdAt: new Date(now.getTime() - 2 * DAY), readAt: new Date(now.getTime() - DAY) },
  ]);

  await db.insert(s.appSettings).values({
    id: 1,
    youtubeChannelId: MOCK_CHANNEL_ID,
    lastYoutubeSyncAt: new Date(now.getTime() - DAY),
  });
  await db.insert(s.syncRuns).values({
    kind: "youtube:cron",
    startedAt: new Date(now.getTime() - DAY),
    finishedAt: new Date(now.getTime() - DAY + 4000),
    ok: true,
    summary: { added: 0, updated: POSTED.length + 6, snapshots: POSTED.length + 6, errors: [] },
  });

  return { members: MEMBERS.length, songs: songIds.size, sessions: sessionIds.length };
}

// `npm run db:seed` — seed an already-migrated, empty database.
if (/[\\/]seed\.ts$/.test(process.argv[1] ?? "")) {
  (async () => {
    await import("dotenv/config");
    const { neon } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-http");
    const result = await seedDatabase(drizzle(neon(process.env.DATABASE_URL!)), process.env.SEED_ADMIN_EMAIL);
    console.log("Seeded:", result);
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
