import "server-only";
import { eq, sql } from "drizzle-orm";
import { appSettings, db, syncRuns, videoStatsHistory, youtubeVideos, type SyncSummary } from "@/db";
import { MOCK_NEW_UPLOADS } from "@/server/mock/fixtures";
import { seededRandom } from "@/lib/hash";
import { DAY, dateKey } from "@/lib/time";
import { isMockGoogle } from "@/server/integrations";
import { getSettings } from "@/server/settings/internal";

// YouTube channel sync (FR-YT-1). Imports new uploads as "untagged",
// refreshes stats for every video, writes one snapshot per video per day
// (idempotent), and logs the run in sync_runs.

type Upload = { videoId: string; title: string; publishedAt: Date; thumbnailUrl: string | null; duration: string | null };
type Stats = { views: number; likes: number; comments: number };

interface YoutubeSource {
  listUploads(channelId: string): Promise<Upload[]>;
  getStats(videoIds: string[]): Promise<Map<string, Stats>>;
}

// --- Mock: the channel is "whatever is in the DB" + MOCK_NEW_UPLOADS -------

const mockSource: YoutubeSource = {
  async listUploads() {
    const existing = await db
      .select({
        videoId: youtubeVideos.videoId,
        title: youtubeVideos.title,
        publishedAt: youtubeVideos.publishedAt,
        thumbnailUrl: youtubeVideos.thumbnailUrl,
        duration: youtubeVideos.duration,
      })
      .from(youtubeVideos);
    const fresh = MOCK_NEW_UPLOADS.map((u) => ({
      videoId: u.videoId,
      title: u.title,
      publishedAt: new Date(Date.now() - u.daysAgo * DAY),
      thumbnailUrl: null,
      duration: "PT3M45S",
    }));
    const known = new Set(existing.map((e) => e.videoId));
    return [...existing, ...fresh.filter((f) => !known.has(f.videoId))];
  },
  async getStats(ids) {
    const rows = await db
      .select({ videoId: youtubeVideos.videoId, v: youtubeVideos.viewCount, l: youtubeVideos.likeCount, c: youtubeVideos.commentCount })
      .from(youtubeVideos);
    const byId = new Map(rows.map((r) => [r.videoId, r]));
    const today = new Date().toISOString().slice(0, 10);
    const out = new Map<string, Stats>();
    for (const id of ids) {
      const r = byId.get(id);
      const seed = MOCK_NEW_UPLOADS.find((u) => u.videoId === id);
      const rnd = seededRandom(`${id}:${today}`);
      if (!r) {
        out.set(id, { views: seed?.views ?? 100, likes: seed?.likes ?? 10, comments: seed?.comments ?? 1 });
        continue;
      }
      // Gentle organic growth, deterministic per day.
      out.set(id, {
        views: r.v + Math.round(r.v * 0.003 + rnd() * 40),
        likes: r.l + Math.round(r.l * 0.002 + rnd() * 3),
        comments: r.c + (rnd() < 0.4 ? 1 : 0),
      });
    }
    return out;
  },
};

// --- Live: YouTube Data API v3 with an API key ------------------------------

const YT = "https://www.googleapis.com/youtube/v3";

const liveSource: YoutubeSource = {
  async listUploads(channelId) {
    const key = process.env.YOUTUBE_API_KEY;
    if (!key) throw new Error("YOUTUBE_API_KEY is not set");
    // The uploads playlist is the channel id with UC → UU.
    const playlistId = channelId.replace(/^UC/, "UU");
    const out: Upload[] = [];
    let pageToken = "";
    for (let page = 0; page < 40; page++) {
      const url = `${YT}/playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=${playlistId}&key=${key}${pageToken ? `&pageToken=${pageToken}` : ""}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`playlistItems.list failed: HTTP ${res.status}`);
      const data = (await res.json()) as {
        nextPageToken?: string;
        items: { contentDetails: { videoId: string; videoPublishedAt?: string }; snippet: { title: string; publishedAt: string; thumbnails?: Record<string, { url: string }> } }[];
      };
      for (const it of data.items) {
        out.push({
          videoId: it.contentDetails.videoId,
          title: it.snippet.title,
          publishedAt: new Date(it.contentDetails.videoPublishedAt ?? it.snippet.publishedAt),
          thumbnailUrl: it.snippet.thumbnails?.high?.url ?? it.snippet.thumbnails?.default?.url ?? null,
          duration: null,
        });
      }
      if (!data.nextPageToken) break;
      pageToken = data.nextPageToken;
    }
    return out;
  },
  async getStats(ids) {
    const key = process.env.YOUTUBE_API_KEY!;
    const out = new Map<string, Stats>();
    for (let i = 0; i < ids.length; i += 50) {
      const batch = ids.slice(i, i + 50);
      const res = await fetch(`${YT}/videos?part=statistics&id=${batch.join(",")}&key=${key}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`videos.list failed: HTTP ${res.status}`);
      const data = (await res.json()) as { items: { id: string; statistics: { viewCount?: string; likeCount?: string; commentCount?: string } }[] };
      for (const it of data.items) {
        out.set(it.id, {
          views: Number(it.statistics.viewCount ?? 0),
          likes: Number(it.statistics.likeCount ?? 0),
          comments: Number(it.statistics.commentCount ?? 0),
        });
      }
    }
    return out;
  },
};

export async function runYoutubeSync(trigger: "cron" | "manual"): Promise<{ ok: boolean; summary: SyncSummary }> {
  const settings = await getSettings();
  const [run] = await db.insert(syncRuns).values({ kind: `youtube:${trigger}` }).returning({ id: syncRuns.id });
  const summary: SyncSummary = { added: 0, updated: 0, snapshots: 0, errors: [] };

  try {
    if (!settings.youtubeChannelId) throw new Error("Set the YouTube channel ID in admin settings first.");
    const source = isMockGoogle ? mockSource : liveSource;
    const uploads = await source.listUploads(settings.youtubeChannelId);
    const stats = await source.getStats(uploads.map((u) => u.videoId));
    const today = dateKey(new Date(), settings.defaultTimezone);
    const now = new Date();

    for (const u of uploads) {
      const s = stats.get(u.videoId) ?? { views: 0, likes: 0, comments: 0 };
      const [row] = await db
        .insert(youtubeVideos)
        .values({
          videoId: u.videoId,
          title: u.title,
          publishedAt: u.publishedAt,
          thumbnailUrl: u.thumbnailUrl,
          duration: u.duration,
          viewCount: s.views,
          likeCount: s.likes,
          commentCount: s.comments,
          statsUpdatedAt: now,
          backfillState: "untagged",
        })
        .onConflictDoUpdate({
          target: youtubeVideos.videoId,
          set: { title: u.title, viewCount: s.views, likeCount: s.likes, commentCount: s.comments, statsUpdatedAt: now },
        })
        .returning({ id: youtubeVideos.id, inserted: sql<boolean>`(xmax = 0)` });
      if (row.inserted) summary.added!++;
      else summary.updated!++;

      await db
        .insert(videoStatsHistory)
        .values({ videoId: row.id, capturedOn: today, viewCount: s.views, likeCount: s.likes, commentCount: s.comments })
        .onConflictDoUpdate({
          target: [videoStatsHistory.videoId, videoStatsHistory.capturedOn],
          set: { viewCount: s.views, likeCount: s.likes, commentCount: s.comments },
        });
      summary.snapshots!++;
    }

    await db.update(appSettings).set({ lastYoutubeSyncAt: now }).where(eq(appSettings.id, 1));
    await db.update(syncRuns).set({ finishedAt: new Date(), ok: true, summary }).where(eq(syncRuns.id, run.id));
    return { ok: true, summary };
  } catch (err) {
    summary.errors!.push(err instanceof Error ? err.message : String(err));
    await db.update(syncRuns).set({ finishedAt: new Date(), ok: false, summary }).where(eq(syncRuns.id, run.id));
    return { ok: false, summary };
  }
}
