"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { Video } from "@/server/youtube/queries";
import { Input } from "@/components/ui/input";
import { formatCompact, formatDate, formatDuration } from "@/lib/channel-stats";

const SORTS = {
  newest: { label: "Newest first", fn: (a: Video, b: Video) => b.publishedAt.localeCompare(a.publishedAt) },
  oldest: { label: "Oldest first", fn: (a: Video, b: Video) => a.publishedAt.localeCompare(b.publishedAt) },
  views: { label: "Most viewed", fn: (a: Video, b: Video) => b.views - a.views },
  likes: { label: "Most liked", fn: (a: Video, b: Video) => b.likes - a.likes },
} as const;
type SortKey = keyof typeof SORTS;

export function VideoList({ videos }: { videos: Video[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? videos.filter((v) => v.title.toLowerCase().includes(q)) : [...videos];
    return list.sort(SORTS[sort].fn);
  }, [videos, query, sort]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Input
          type="search"
          placeholder="Search videos"
          aria-label="Search videos"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-10 min-w-40 flex-1"
        />
        <select
          aria-label="Sort videos"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="h-10 rounded-4xl border border-input bg-input/30 px-3 text-sm"
        >
          {Object.entries(SORTS).map(([key, s]) => (
            <option key={key} value={key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {shown.length === videos.length ? `${videos.length} videos` : `${shown.length} of ${videos.length} videos`}
      </p>
      {shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No videos match &quot;{query}&quot;.</p>
      ) : (
        <ul className="grid gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((v) => (
            <li key={v.id}>
              <a
                href={`https://www.youtube.com/watch?v=${v.id}`}
                target="_blank"
                rel="noreferrer"
                className="group flex flex-col gap-2"
              >
                <div className="relative aspect-video overflow-hidden rounded-xl bg-muted">
                  {v.thumbnail && (
                    <Image
                      src={v.thumbnail}
                      alt=""
                      fill
                      sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover"
                    />
                  )}
                  <span className="absolute right-1.5 bottom-1.5 rounded bg-black/75 px-1.5 text-[11px] font-semibold text-white">
                    {formatDuration(v.durationSeconds)}
                  </span>
                </div>
                <p className="line-clamp-2 text-sm font-medium group-hover:underline">{v.title}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(v.publishedAt)} · {formatCompact(v.views)} views · {formatCompact(v.likes)} likes
                </p>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
