import "server-only";
import { cacheLife } from "next/cache";

// YouTube Data API v3. Quota per refresh: 1 (handle lookup) + 1 per 50
// uploads (playlistItems) + 1 per 50 videos (videos.list).
const API = "https://www.googleapis.com/youtube/v3";

export type Video = {
  id: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  durationSeconds: number;
  views: number;
  likes: number;
  comments: number;
};

export type Channel = {
  title: string;
  handle: string;
  subscribers: number;
  views: number;
  videoCount: number;
};

export type VideosResult =
  | { ok: true; channel: Channel; videos: Video[]; fetchedAt: string }
  | { ok: false; message: string };

type Thumbs = Record<string, { url: string } | undefined>;

class YouTubeError extends Error {}

async function call<T>(path: string, params: Record<string, string>, key: string): Promise<T> {
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  // Key goes in a header so it never appears in a URL, a log line or the
  // fetch cache. "use cache" on getChannelData already caches the result.
  const res = await fetch(url, { headers: { "X-goog-api-key": key }, cache: "no-store" });
  if (!res.ok) {
    // The error body can echo the request, so log only the status and reason.
    const body = (await res.json().catch(() => null)) as
      | { error?: { errors?: { reason?: string }[] } }
      | null;
    const reason = body?.error?.errors?.[0]?.reason ?? "unknown";
    throw new YouTubeError(`YouTube ${path} failed: ${res.status} ${reason}`);
  }
  return res.json() as Promise<T>;
}

async function resolveChannel(handle: string, key: string) {
  const forHandle = handle.startsWith("@") ? handle : `@${handle}`;
  const data = await call<{
    items?: {
      snippet: { title: string; customUrl?: string };
      contentDetails: { relatedPlaylists: { uploads: string } };
      statistics: { subscriberCount?: string; viewCount?: string; videoCount?: string };
    }[];
  }>("channels", { part: "snippet,contentDetails,statistics", forHandle }, key);
  const c = data.items?.[0];
  if (!c) throw new YouTubeError(`No YouTube channel found for ${forHandle}.`);
  const channel: Channel = {
    title: c.snippet.title,
    handle: c.snippet.customUrl ?? forHandle,
    // Hidden or rounded by YouTube for some channels; 0 means not available.
    subscribers: Number(c.statistics.subscriberCount ?? 0),
    views: Number(c.statistics.viewCount ?? 0),
    videoCount: Number(c.statistics.videoCount ?? 0),
  };
  return { channel, uploads: c.contentDetails.relatedPlaylists.uploads };
}

async function listUploadIds(playlistId: string, key: string) {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const data = await call<{ items: { contentDetails: { videoId: string } }[]; nextPageToken?: string }>(
      "playlistItems",
      { part: "contentDetails", playlistId, maxResults: "50", ...(pageToken && { pageToken }) },
      key,
    );
    ids.push(...data.items.map((i) => i.contentDetails.videoId));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return ids;
}

function parseDuration(iso: string) {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return 0;
  const [, d, h, min, s] = m.map((x) => Number(x ?? 0));
  return ((d * 24 + h) * 60 + min) * 60 + s;
}

// Private and deleted uploads stay in the playlist but videos.list omits
// them, so they drop out here.
async function getDetails(ids: string[], key: string): Promise<Video[]> {
  const videos: Video[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const data = await call<{
      items: {
        id: string;
        snippet: { title: string; publishedAt: string; thumbnails: Thumbs };
        contentDetails: { duration: string };
        statistics: { viewCount?: string; likeCount?: string; commentCount?: string };
      }[];
    }>("videos", { part: "snippet,contentDetails,statistics", id: ids.slice(i, i + 50).join(",") }, key);
    for (const v of data.items) {
      const t = v.snippet.thumbnails;
      videos.push({
        id: v.id,
        title: v.snippet.title,
        thumbnail: (t.medium ?? t.high ?? t.default)?.url ?? "",
        publishedAt: v.snippet.publishedAt,
        durationSeconds: parseDuration(v.contentDetails.duration),
        views: Number(v.statistics.viewCount ?? 0),
        likes: Number(v.statistics.likeCount ?? 0),
        comments: Number(v.statistics.commentCount ?? 0),
      });
    }
  }
  return videos.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export async function getChannelData(): Promise<VideosResult> {
  const handle = process.env.YOUTUBE_CHANNEL_HANDLE?.trim();
  if (!process.env.YOUTUBE_API_KEY || !handle) {
    return { ok: false, message: "YouTube is not configured. Set YOUTUBE_API_KEY and YOUTUBE_CHANNEL_HANDLE." };
  }
  return loadChannel(handle);
}

// The handle is an argument so it is part of the cache key: changing the env
// var gets a fresh entry instead of serving the old channel's data.
async function loadChannel(handle: string): Promise<VideosResult> {
  "use cache";
  const key = process.env.YOUTUBE_API_KEY ?? "";
  try {
    const { channel, uploads } = await resolveChannel(handle, key);
    const videos = await getDetails(await listUploadIds(uploads, key), key);
    cacheLife("hours");
    return { ok: true, channel, videos, fetchedAt: new Date().toISOString() };
  } catch (err) {
    // A short lifetime so an outage clears within minutes, not an hour.
    cacheLife("minutes");
    console.error(err instanceof Error ? err.message : err);
    return {
      ok: false,
      message: err instanceof YouTubeError && err.message.startsWith("No YouTube channel")
        ? err.message
        : "Couldn't load videos from YouTube. Try again in a few minutes.",
    };
  }
}
