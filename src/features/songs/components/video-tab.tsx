import { ActionButton } from "@/components/common/action-button";
import { CoverThumb } from "@/components/common/cover-thumb";
import { EmptyState, SectionTitle } from "@/components/layout/page-header";
import { linkVideo, unlinkVideo } from "@/server/songs/actions";
import { getLinkableVideos, type SongDetail } from "@/server/songs/queries";
import { fmtCount, fmtDate } from "@/lib/time";

/** FR-YT-2: link the song to a synced video; fuzzy-match suggestions first. */
export async function VideoTab({ song }: { song: SongDetail }) {
  if (song.video) {
    return (
      <div className="flex max-w-xl flex-col gap-4">
        <CoverThumb src={song.video.thumbnailUrl} title={song.title} subtitle={song.group.name} />
        <div>
          <p className="font-semibold">{song.video.title}</p>
          <p className="text-sm text-muted-foreground">
            Published {fmtDate(song.video.publishedAt, song.tz)} · {fmtCount(song.video.viewCount)} views ·{" "}
            {fmtCount(song.video.likeCount)} likes · {fmtCount(song.video.commentCount)} comments
          </p>
        </div>
        <div className="flex gap-2">
          <a href={`https://www.youtube.com/watch?v=${song.video.videoId}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">
            Open on YouTube
          </a>
          {song.canEdit ? (
            <ActionButton action={unlinkVideo.bind(null, song.id)} variant="ghost" confirm="Unlink this video? A posted song goes back to Editing.">
              Unlink
            </ActionButton>
          ) : null}
        </div>
      </div>
    );
  }

  if (!song.canEdit) {
    return <EmptyState title="No video yet">The IC links the YouTube upload here once it&apos;s posted.</EmptyState>;
  }

  const videos = await getLinkableVideos(song.title, song.group.name);
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>Link the YouTube upload</SectionTitle>
      <p className="text-sm text-muted-foreground">
        Unlinked videos from the channel sync, best title matches first. Linking sets the posted date and lets you mark the song Posted.
      </p>
      {videos.length === 0 ? (
        <EmptyState title="No unlinked videos">New uploads appear here after the next YouTube sync.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {videos.map((v, i) => (
            <li key={v.id} className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{v.title}</p>
                <p className="text-sm text-muted-foreground">
                  {fmtDate(v.publishedAt, song.tz)}
                  {i === 0 && v.score > 0.3 ? <span className="ml-2 text-primary">★ Suggested match</span> : null}
                </p>
              </div>
              <ActionButton action={linkVideo.bind(null, song.id, v.id)} variant={i === 0 && v.score > 0.3 ? "default" : "outline"}>
                Link
              </ActionButton>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
