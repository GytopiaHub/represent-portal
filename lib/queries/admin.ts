import "server-only";
import { and, asc, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { db, syncRuns, users, youtubeVideos } from "@/db";
import { requireAdmin } from "@/lib/dal";
import { getSettings } from "@/lib/server/settings";

const memberColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  image: users.image,
  status: users.status,
  role: users.role,
  stageName: users.stageName,
  createdAt: users.createdAt,
  reviewedAt: users.reviewedAt,
};

export type MemberRow = Awaited<ReturnType<typeof searchMembers>>[number];

export async function getPendingApprovalCount(): Promise<number> {
  await requireAdmin();
  return db.$count(users, eq(users.status, "pending"));
}

export async function getApprovalQueue() {
  await requireAdmin();
  const rows = await db
    .select(memberColumns)
    .from(users)
    .where(inArray(users.status, ["pending", "rejected"]))
    .orderBy(asc(users.createdAt));
  return {
    pending: rows.filter((r) => r.status === "pending"),
    rejected: rows.filter((r) => r.status === "rejected"),
  };
}

export async function searchMembers(query: string) {
  await requireAdmin();
  const q = query.trim();
  const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return db
    .select(memberColumns)
    .from(users)
    .where(
      and(
        inArray(users.status, ["active", "removed"]),
        q ? or(ilike(users.name, pattern), ilike(users.email, pattern), ilike(users.stageName, pattern)) : undefined,
      ),
    )
    .orderBy(asc(users.status), desc(users.role), asc(users.name));
}

/** Untagged videos for the backfill queue (FR-YT-3). */
export async function getBackfillQueue() {
  await requireAdmin();
  const [untagged, ignored] = await Promise.all([
    db.select().from(youtubeVideos).where(eq(youtubeVideos.backfillState, "untagged")).orderBy(desc(youtubeVideos.publishedAt)),
    db.select().from(youtubeVideos).where(eq(youtubeVideos.backfillState, "ignored")).orderBy(desc(youtubeVideos.publishedAt)),
  ]);
  return { untagged, ignored };
}

export async function getAdminSettings() {
  await requireAdmin();
  const [settings, runs] = await Promise.all([
    getSettings(),
    db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt)).limit(5),
  ]);
  return { settings, runs };
}
