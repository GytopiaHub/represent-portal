"use client";

import { useMemo, useState } from "react";
import type { Video } from "@/server/youtube/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatCompact,
  previousYearSamePeriod,
  summariseYear,
  topBy,
  uploadsPerMonthOfYear,
  yearOf,
  yearsWithUploads,
} from "@/lib/channel-stats";
import { StatTile } from "./stat-tile";
import { UploadsChart } from "./uploads-chart";
import { VideoList } from "./video-list";

// Figures cover videos published in the chosen year, with their lifetime
// counts. The Data API has no per-year view or subscriber totals.
export function YearView({ videos, fetchedAt }: { videos: Video[]; fetchedAt: string }) {
  const now = useMemo(() => new Date(fetchedAt), [fetchedAt]);
  const years = useMemo(() => yearsWithUploads(videos, now), [videos, now]);
  const [year, setYear] = useState(() => yearOf(now));

  const summary = useMemo(() => summariseYear(videos, year), [videos, year]);
  const months = useMemo(() => uploadsPerMonthOfYear(videos, year), [videos, year]);
  const top = useMemo(() => topBy(summary.videos, 5, (v) => v.views), [summary]);
  const prev = previousYearSamePeriod(videos, year, now);
  const hasPrevYear = years.includes(year - 1);
  const shortDate = now.toLocaleDateString("en-SG", { day: "numeric", month: "short", timeZone: "Asia/Singapore" });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="year-picker" className="text-sm text-muted-foreground">
          Year
        </label>
        <select
          id="year-picker"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="h-10 rounded-4xl border border-input bg-input/30 px-3 text-sm"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">Videos published in {year}, with their views to date.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label="Uploads"
          value={summary.uploads.toLocaleString("en")}
          hint={hasPrevYear ? `${year - 1}${prev.partial ? ` to ${shortDate}` : ""}: ${prev.count}` : undefined}
        />
        <StatTile label="Views" value={formatCompact(summary.views)} hint={`on ${year} uploads`} />
        <StatTile label="Likes" value={formatCompact(summary.likes)} hint={`${formatCompact(summary.comments)} comments`} />
        <StatTile label="Median views" value={formatCompact(summary.medianViews)} hint="per video" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <UploadsChart
          months={months}
          title={`Uploads per month, ${year}`}
          description={`${summary.uploads} upload${summary.uploads === 1 ? "" : "s"} in ${year}`}
        />
        <Card size="sm">
          <CardHeader>
            <CardTitle>Top 5 of {year}</CardTitle>
          </CardHeader>
          <CardContent>
            {top.length === 0 ? (
              <p className="text-sm text-muted-foreground">No uploads in {year} yet.</p>
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
        <h2 className="text-base font-medium">{year} videos</h2>
        <VideoList key={year} videos={summary.videos} />
      </section>
    </div>
  );
}
