"use client";

import { useMemo, useState } from "react";
import type { Video } from "@/server/youtube/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatCompact,
  formatDate,
  inPeriod,
  type Period,
  periodLabel,
  periodsFor,
  previousPeriod,
  summarise,
  topBy,
  uploadBuckets,
} from "@/lib/channel-stats";
import { cn } from "@/lib/utils";
import { StatTile } from "./stat-tile";
import { UploadsChart } from "./uploads-chart";
import { VideoList } from "./video-list";

// "in the last 12 months", "in 2025", or the fallback for All time.
const within = (p: Period, all: string) => (p === "12m" ? "in the last 12 months" : p === "all" ? all : `in ${p}`);

// Figures cover videos published in the chosen period, with their lifetime
// counts. The Data API has no per-period view or subscriber totals.
export function ChannelExplorer({ videos, fetchedAt }: { videos: Video[]; fetchedAt: string }) {
  const now = useMemo(() => new Date(fetchedAt), [fetchedAt]);
  const periods = useMemo(() => periodsFor(videos, now), [videos, now]);
  const [period, setPeriod] = useState<Period>("12m");

  const list = useMemo(() => videos.filter((v) => inPeriod(v.publishedAt, period, now)), [videos, period, now]);
  const summary = useMemo(() => summarise(list), [list]);
  const buckets = useMemo(() => uploadBuckets(videos, period, now), [videos, period, now]);
  const top = useMemo(() => topBy(list, 5, (v) => v.views), [list]);
  const prev = previousPeriod(videos, period, now);
  const shortDate = now.toLocaleDateString("en-SG", { day: "numeric", month: "short", timeZone: "Asia/Singapore" });
  const first = videos.at(-1);

  const uploadsHint =
    period === "all"
      ? first && `since ${formatDate(first.publishedAt)}`
      : prev?.kind === "12m"
        ? `previous 12 months: ${prev.count}`
        : prev && `${prev.year}${prev.partial ? ` to ${shortDate}` : ""}: ${prev.count}`;

  const isAll = period === "all";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {/* Scrolls sideways on phones rather than wrapping into several rows. */}
        <div
          role="group"
          aria-label="Period"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
        >
          {periods.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={p === period}
              onClick={() => setPeriod(p)}
              className={cn(
                "h-11 shrink-0 rounded-4xl border px-4 text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                p === period
                  ? "border-foreground bg-foreground text-background"
                  : "border-input text-muted-foreground hover:text-foreground",
              )}
            >
              {periodLabel(p)}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Videos published {within(period, "since the channel started")}, with their views to date.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Uploads" value={summary.uploads.toLocaleString("en")} hint={uploadsHint || undefined} />
        <StatTile label="Views on these uploads" value={formatCompact(summary.views)} />
        <StatTile label="Likes" value={formatCompact(summary.likes)} hint={`${formatCompact(summary.comments)} comments`} />
        <StatTile label="Median views" value={formatCompact(summary.medianViews)} hint="per video" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <UploadsChart
          months={buckets}
          title={isAll ? "Uploads per year" : "Uploads per month"}
          bucketLabel={isAll ? "Year" : "Month"}
          description={`${summary.uploads} upload${summary.uploads === 1 ? "" : "s"} ${within(period, "in total")}`}
        />
        <Card size="sm">
          <CardHeader>
            <CardTitle>Top 5 {period === "12m" ? "in the last 12 months" : isAll ? "of all time" : `of ${period}`}</CardTitle>
          </CardHeader>
          <CardContent>
            {top.length === 0 ? (
              <p className="text-sm text-muted-foreground">No uploads in this period yet.</p>
            ) : (
              <ol className="flex flex-col">
                {top.map((v, i) => (
                  <li key={v.id} className="flex min-h-11 items-center gap-3 border-t border-border py-2 first:border-t-0">
                    <span className="w-4 text-sm text-muted-foreground tabular-nums">{i + 1}</span>
                    <a
                      href={`https://www.youtube.com/watch?v=${v.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="line-clamp-2 flex-1 text-sm font-medium hover:underline"
                    >
                      {v.title}
                    </a>
                    <span className="text-sm tabular-nums">{formatCompact(v.views)}</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-medium">{isAll ? "All videos" : `Videos ${within(period, "")}`}</h2>
        <VideoList key={String(period)} videos={list} />
      </section>
    </div>
  );
}
