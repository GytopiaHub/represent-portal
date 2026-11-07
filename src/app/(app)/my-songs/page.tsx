import type { Metadata } from "next";
import Link from "next/link";
import { RoleChip, StatusChip } from "@/components/common/chips";
import { EmptyState, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { CrewRole, SongStatus } from "@/db/schema";
import { CREW_ROLES, CREW_ROLE_LABEL, SONG_STATUSES, SONG_STATUS_LABEL } from "@/lib/labels";
import { listMySongs } from "@/server/songs/queries";
import { fmtDate } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "My songs" };

export default async function MySongsPage(props: PageProps<"/my-songs">) {
  const sp = await props.searchParams;
  const role = CREW_ROLES.includes(sp.role as CrewRole) ? (sp.role as CrewRole) : undefined;
  const status = SONG_STATUSES.includes(sp.status as SongStatus) ? (sp.status as SongStatus) : undefined;
  const { tz, songs } = await listMySongs({ role, status });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="My songs" description="Every song you've accepted a role in." />
      <form className="flex flex-wrap gap-2">
        <NativeSelect name="role" defaultValue={role ?? ""} aria-label="Role">
          <NativeSelectOption value="">All roles</NativeSelectOption>
          {CREW_ROLES.map((r) => (
            <NativeSelectOption key={r} value={r}>{CREW_ROLE_LABEL[r]}</NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect name="status" defaultValue={status ?? ""} aria-label="Status">
          <NativeSelectOption value="">All statuses</NativeSelectOption>
          {SONG_STATUSES.map((s) => (
            <NativeSelectOption key={s} value={s}>{SONG_STATUS_LABEL[s]}</NativeSelectOption>
          ))}
        </NativeSelect>
        <Button type="submit" variant="outline">Filter</Button>
      </form>

      {songs.length === 0 ? (
        <EmptyState title="No songs yet">
          <Link href="/songs" className="underline">Find a crew</Link> or start one.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {songs.map((s) => (
            <li key={s.id}>
              <Link
                href={`/songs/${s.id}`}
                className={cn(
                  "flex flex-col gap-2 rounded-2xl border bg-card p-4 transition-colors hover:border-primary/50 sm:flex-row sm:items-center",
                  s.status === "cancelled" && "opacity-50", // FR-HIS-1: greyed out
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-muted-foreground">{s.groupName}</p>
                  <p className="truncate font-semibold">{s.title}</p>
                  {s.positions.length ? <p className="text-sm text-muted-foreground">as {s.positions.join(", ")}</p> : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {s.roles.map((r) => (
                    <RoleChip key={r} role={r} />
                  ))}
                  <StatusChip status={s.status} />
                  <span className="w-24 text-right text-sm text-muted-foreground">{s.postedAt ? fmtDate(s.postedAt, tz) : "—"}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
