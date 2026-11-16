import { Card } from "@/components/ui/card";
import { getChannelData } from "@/server/youtube/queries";
import { daysSince, formatCompact } from "@/lib/channel-stats";
import { ChannelExplorer } from "./channel-explorer";
import { LocalTime } from "./local-time";

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

  const { channel, covers, fetchedAt } = data;
  // Measured from the fetch time so the figures match the cached data.
  const latest = covers[0];
  const sinceLast = latest ? daysSince(latest.publishedAt, new Date(fetchedAt)) : null;
  const lastCover =
    sinceLast === null
      ? "No covers yet"
      : sinceLast === 0
        ? "Last cover today"
        : `Last cover ${sinceLast} day${sinceLast === 1 ? "" : "s"} ago`;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        {channel.title} ({channel.handle}) · Updated <LocalTime iso={fetchedAt} />
      </p>
      <Card className="flex-row flex-wrap items-end gap-x-6 gap-y-2 px-6">
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">Subscribers</p>
          <p className="text-5xl leading-none font-semibold tracking-tight">
            {channel.subscribers ? channel.subscribers.toLocaleString("en") : "Hidden"}
          </p>
        </div>
        <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
          <span>{formatCompact(channel.views)} channel views</span>
          <span>
            {covers.length.toLocaleString("en")} cover{covers.length === 1 ? "" : "s"}
          </span>
          <span>{lastCover}</span>
        </p>
      </Card>
      <ChannelExplorer covers={covers} fetchedAt={fetchedAt} />
    </div>
  );
}
