import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getChannelData } from "@/server/youtube/queries";
import {
  daysSince,
  formatCompact,
  median,
  uploadsInYear,
  uploadsPerMonth,
} from "@/lib/channel-stats";
import { LocalTime } from "./local-time";
import { RecentUploads } from "./recent-uploads";
import { StatTile } from "./stat-tile";
import { UploadsChart } from "./uploads-chart";
import { VideoList } from "./video-list";
import { YearView } from "./year-view";

export async function Dashboard() {
  const data = await getChannelData();
  if (!data.ok) {
    return (
      <Card className="px-6" role="alert">
        <p className="font-medium">Channel data is unavailable</p>
        <p className="text-sm text-muted-foreground">{data.message}</p>
      </Card>
    );
  }

  const { channel, videos, fetchedAt } = data;
  // Measured from the fetch time so the figures match the cached data.
  const now = new Date(fetchedAt);
  const latest = videos[0];
  const sinceLast = latest ? daysSince(latest.publishedAt, now) : null;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        {channel.title} ({channel.handle}) · Updated <LocalTime iso={fetchedAt} />
      </p>
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview" className="px-4">Overview</TabsTrigger>
          <TabsTrigger value="videos" className="px-4">Videos</TabsTrigger>
          <TabsTrigger value="year" className="px-4">Year</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-2 flex flex-col gap-4">
          <Card className="gap-2 px-6">
            <p className="text-xs text-muted-foreground">Subscribers</p>
            <p className="text-5xl leading-none font-semibold tracking-tight">
              {channel.subscribers ? channel.subscribers.toLocaleString("en") : "Hidden"}
            </p>
            <p className="text-sm text-muted-foreground">
              {formatCompact(channel.views)} total views across {channel.videoCount.toLocaleString("en")} videos
            </p>
          </Card>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <StatTile
              label="Since last upload"
              value={sinceLast === null ? "None yet" : sinceLast === 0 ? "Today" : `${sinceLast} day${sinceLast === 1 ? "" : "s"}`}
            />
            <StatTile label="Uploads this year" value={uploadsInYear(videos, now).toLocaleString("en")} />
            <StatTile label="Median views" value={formatCompact(median(videos.map((v) => v.views)))} hint="per video" />
          </div>
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <UploadsChart months={uploadsPerMonth(videos, now)} />
            <RecentUploads videos={videos.slice(0, 5)} />
          </div>
        </TabsContent>
        <TabsContent value="videos" className="mt-2">
          <VideoList videos={videos} />
        </TabsContent>
        {/* Kept mounted so the default year is server-rendered and switching is instant. */}
        <TabsContent value="year" keepMounted className="mt-2">
          <YearView videos={videos} fetchedAt={fetchedAt} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
