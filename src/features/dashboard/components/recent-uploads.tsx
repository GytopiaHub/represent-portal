import type { Video } from "@/server/youtube/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/channel-stats";

export function RecentUploads({ videos }: { videos: Video[] }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Recent uploads</CardTitle>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="py-2 pr-2 text-left font-medium">Video</th>
              <th className="px-2 py-2 text-right font-medium">Views</th>
              <th className="px-2 py-2 text-right font-medium">Likes</th>
              <th className="hidden py-2 pl-2 text-right font-medium sm:table-cell">Comments</th>
            </tr>
          </thead>
          <tbody>
            {videos.map((v) => (
              <tr key={v.id} className="border-t border-border">
                <td className="py-2 pr-2">
                  <a
                    href={`https://www.youtube.com/watch?v=${v.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="line-clamp-2 font-medium hover:underline"
                  >
                    {v.title}
                  </a>
                  <p className="text-xs text-muted-foreground">{formatDate(v.publishedAt)}</p>
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{v.views.toLocaleString("en")}</td>
                <td className="px-2 py-2 text-right tabular-nums">{v.likes.toLocaleString("en")}</td>
                <td className="hidden py-2 pl-2 text-right tabular-nums sm:table-cell">
                  {v.comments.toLocaleString("en")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
