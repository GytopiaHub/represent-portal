import type { Metadata } from "next";
import { ActionButton } from "@/components/action-button";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { EmptyState, SectionTitle } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { createBackfillSong, setVideoIgnored } from "@/lib/actions/admin";
import { getViewer } from "@/lib/dal";
import { getBackfillQueue, searchMembers } from "@/lib/queries/admin";
import { listGroupsWithMembers } from "@/lib/queries/groups";
import { fmtCount, fmtDate } from "@/lib/time";

export const metadata: Metadata = { title: "Backfill queue" };

/** Guess "Song" from "Group (한글) 'Song' Dance Cover | RepresENT". */
function guessTitle(videoTitle: string) {
  return /'([^']+)'/.exec(videoTitle)?.[1] ?? videoTitle;
}

/** FR-YT-3: untagged channel uploads → song records, or "not a cover". */
export default async function BackfillPage() {
  const viewer = await getViewer();
  const [{ untagged, ignored }, groups, members] = await Promise.all([getBackfillQueue(), listGroupsWithMembers(), searchMembers("")]);
  const active = members.filter((m) => m.status === "active");

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <SectionTitle>Untagged videos ({untagged.length})</SectionTitle>
        <p className="text-sm text-muted-foreground">
          Create a song record for each past cover. You&apos;ll then assign crew directly (no invitations) on its Crew tab. Uploads for
          songs still in progress can also be linked from that song&apos;s Video tab.
        </p>
        {untagged.length === 0 ? (
          <EmptyState title="All caught up">New uploads land here after each YouTube sync.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-3">
            {untagged.map((v) => (
              <li key={v.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="min-w-0 flex-1 font-semibold">{v.title}</span>
                  <span className="text-sm text-muted-foreground">
                    {fmtDate(v.publishedAt, viewer.tz)} · {fmtCount(v.viewCount)} views
                  </span>
                </div>
                <ActionForm action={createBackfillSong.bind(null, v.id)} className="flex flex-wrap items-center gap-2">
                  <Input name="title" defaultValue={guessTitle(v.title)} required maxLength={120} aria-label="Song title" className="w-48" />
                  <NativeSelect name="groupId" required aria-label="Group" defaultValue={groups.find((g) => v.title.includes(g.name))?.id ?? ""}>
                    <NativeSelectOption value="">Group…</NativeSelectOption>
                    {groups.map((g) => (
                      <NativeSelectOption key={g.id} value={g.id}>{g.name}</NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <NativeSelect name="icUserId" required aria-label="IC" defaultValue={viewer.id}>
                    {active.map((m) => (
                      <NativeSelectOption key={m.id} value={m.id}>IC: {m.stageName || m.name}</NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <SubmitButton>Create song record</SubmitButton>
                  <ActionButton action={setVideoIgnored.bind(null, v.id, true)} variant="ghost">
                    Not a cover / ignore
                  </ActionButton>
                </ActionForm>
                {!groups.some((g) => v.title.includes(g.name)) ? (
                  <p className="text-xs text-amber-300">Group not found? Add it under Groups &amp; rosters first.</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {ignored.length > 0 ? (
        <section className="flex flex-col gap-3">
          <SectionTitle>Ignored ({ignored.length})</SectionTitle>
          <ul className="flex flex-col gap-2">
            {ignored.map((v) => (
              <li key={v.id} className="flex items-center gap-3 rounded-2xl border p-3 text-sm text-muted-foreground">
                <span className="flex-1">{v.title}</span>
                <ActionButton action={setVideoIgnored.bind(null, v.id, false)} variant="ghost">Restore</ActionButton>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
