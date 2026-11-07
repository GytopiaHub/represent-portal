import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { LinkSquare02Icon } from "@hugeicons/core-free-icons";
import { ActionForm, SubmitButton } from "@/components/common/action-form";
import { GuestTag } from "@/components/common/chips";
import { Sparkline } from "@/components/charts/lazy";
import { SectionTitle } from "@/components/layout/page-header";
import { StatTile } from "@/components/common/stat-tile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { setSongStatus, updateSongDetails } from "@/server/songs/actions";
import { CREW_ROLE_LABEL, SONG_STATUSES, SONG_STATUS_LABEL } from "@/lib/labels";
import { getVideoHistory, type SongDetail } from "@/server/songs/queries";
import { fmtCount, fmtDate } from "@/lib/time";

/** Full credit list (FR-CAT-3): ICs, dancers as positions, videographers, editors. */
function Credits({ song }: { song: SongDetail }) {
  const roleRows = (["ic", "videographer", "editor"] as const).map((role) => ({
    role,
    people: song.crew.filter((c) => c.role === role),
  }));
  return (
    <dl className="flex flex-col gap-4">
      <div>
        <dt className="mb-1 text-sm text-muted-foreground">Dancers</dt>
        <dd className="flex flex-col gap-1">
          {song.positions.map((p) => (
            <span key={p.id}>
              {p.assignment ? (
                <>
                  {p.assignment.holder.kind === "member" ? (
                    <Link href={`/members/${p.assignment.holder.userId}`} className="font-medium hover:underline">
                      {p.assignment.holder.name}
                    </Link>
                  ) : (
                    <span className="font-medium">{p.assignment.holder.name}</span>
                  )}{" "}
                  <span className="text-muted-foreground">as {p.label}</span>{" "}
                  {p.assignment.holder.kind === "guest" ? <GuestTag /> : null}
                </>
              ) : (
                <span className="text-muted-foreground">
                  {p.label} — <span className="text-cyan-300">Unfilled</span>
                </span>
              )}
            </span>
          ))}
        </dd>
      </div>
      {roleRows.map(({ role, people }) => (
        <div key={role}>
          <dt className="mb-1 text-sm text-muted-foreground">{CREW_ROLE_LABEL[role]}s</dt>
          <dd className="flex flex-wrap gap-x-3 gap-y-1">
            {people.length === 0 ? <span className="text-muted-foreground">—</span> : null}
            {people.map((p) =>
              p.holder.kind === "member" ? (
                <Link key={p.id} href={`/members/${p.holder.userId}`} className="font-medium hover:underline">
                  {p.holder.name}
                </Link>
              ) : (
                <span key={p.id} className="inline-flex items-center gap-1 font-medium">
                  {p.holder.name} <GuestTag />
                </span>
              ),
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export async function OverviewTab({ song }: { song: SongDetail }) {
  const history = song.video ? await getVideoHistory(song.video.id) : [];
  const mv = song.referenceLinks.find((l) => l.label === "Original MV")?.url ?? "";
  const practice = song.referenceLinks.find((l) => l.label === "Dance practice")?.url ?? "";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="flex min-w-0 flex-col gap-6">
        {song.video ? (
          <div className="grid grid-cols-3 gap-3">
            <StatTile label="Views" value={fmtCount(song.video.viewCount)} />
            <StatTile label="Likes" value={fmtCount(song.video.likeCount)} />
            <StatTile label="Comments" value={fmtCount(song.video.commentCount)} />
          </div>
        ) : null}
        {history.length > 1 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Views, last {history.length} days</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-16" role="img" aria-label={`Views grew from ${history[0].views.toLocaleString()} to ${history.at(-1)!.views.toLocaleString()}`}>
                <Sparkline data={history} />
              </div>
            </CardContent>
          </Card>
        ) : null}

        {song.description ? <p className="whitespace-pre-line">{song.description}</p> : null}

        <section className="flex flex-col gap-3">
          <SectionTitle>Credits</SectionTitle>
          <Credits song={song} />
        </section>

        {song.referenceLinks.length > 0 ? (
          <section className="flex flex-col gap-2">
            <SectionTitle>References</SectionTitle>
            {song.referenceLinks.map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                <HugeiconsIcon icon={LinkSquare02Icon} className="size-4" aria-hidden />
                {l.label}
              </a>
            ))}
          </section>
        ) : null}
      </div>

      <aside className="flex flex-col gap-4">
        <Card>
          <CardContent className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Artist</span><span>{song.group.name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Target post</span><span>{fmtDate(song.targetPostDate, song.tz)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Posted</span><span>{song.video ? fmtDate(song.video.publishedAt, song.tz) : "—"}</span></div>
            {song.isBackfill ? <p className="text-xs text-muted-foreground">Backfilled from an existing upload.</p> : null}
          </CardContent>
        </Card>

        {song.canEdit ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Status</CardTitle>
              </CardHeader>
              <CardContent>
                <ActionForm action={setSongStatus.bind(null, song.id)} className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <NativeSelect name="status" defaultValue={song.status} aria-label="Song status" className="flex-1">
                      {SONG_STATUSES.map((s) => (
                        <NativeSelectOption key={s} value={s}>
                          {SONG_STATUS_LABEL[s]}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                    <SubmitButton variant="outline">Update</SubmitButton>
                  </div>
                  <p className="text-xs text-muted-foreground">Any change is allowed. Posted needs a linked video (Video tab).</p>
                </ActionForm>
              </CardContent>
            </Card>
            <details className="rounded-2xl border bg-card p-4">
              <summary className="cursor-pointer font-semibold">Edit details</summary>
              <ActionForm action={updateSongDetails.bind(null, song.id)} className="mt-4 flex flex-col gap-3">
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" defaultValue={song.title} required maxLength={120} />
                <Label htmlFor="targetPostDate">Target post date</Label>
                <Input id="targetPostDate" name="targetPostDate" type="date" defaultValue={song.targetPostDate ?? ""} />
                <Label htmlFor="mvUrl">Original MV</Label>
                <Input id="mvUrl" name="mvUrl" type="url" defaultValue={mv} />
                <Label htmlFor="practiceUrl">Dance practice</Label>
                <Input id="practiceUrl" name="practiceUrl" type="url" defaultValue={practice} />
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" rows={3} defaultValue={song.description ?? ""} />
                <SubmitButton className="self-start">Save</SubmitButton>
              </ActionForm>
            </details>
          </>
        ) : null}
      </aside>
    </div>
  );
}
