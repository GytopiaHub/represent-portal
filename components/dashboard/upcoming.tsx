import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Clock01Icon, Location01Icon } from "@hugeicons/core-free-icons";
import { ActionButton } from "@/components/action-button";
import { EmptyState, SectionTitle } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { respondToInvite } from "@/lib/actions/songs";
import { CREW_ROLE_LABEL, SESSION_KIND_LABEL } from "@/lib/labels";
import { getUpcoming } from "@/lib/queries/songs";
import { fmtRange, fmtRelative } from "@/lib/time";

/** FR-DB-4: next sessions, pending invitations and RSVPs needed (all crews). */
export async function UpcomingPanel() {
  const { tz, sessions, invites, rsvpNeeded } = await getUpcoming();

  return (
    <section className="flex flex-col gap-3" aria-labelledby="upcoming">
      <SectionTitle>
        <span id="upcoming">Upcoming</span>
      </SectionTitle>

      {invites.length > 0 ? (
        <Card className="border-primary/40">
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm font-semibold">Invitations ({invites.length})</p>
            {invites.map((i) => (
              <div key={i.id} className="flex flex-col gap-2 rounded-xl bg-muted/50 p-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <Link href={`/songs/${i.songId}`} className="font-medium hover:underline">
                    {i.groupName} – {i.songTitle}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {CREW_ROLE_LABEL[i.role]}
                    {i.positionLabel ? ` as ${i.positionLabel}` : ""} · from {i.invitedByName ?? "an IC"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <ActionButton action={respondToInvite.bind(null, i.id, true)} variant="default">
                    Accept
                  </ActionButton>
                  <ActionButton action={respondToInvite.bind(null, i.id, false)} variant="ghost">
                    Decline
                  </ActionButton>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {rsvpNeeded.length > 0 ? (
        <p className="text-sm text-amber-300">
          ⚠ {rsvpNeeded.length} session{rsvpNeeded.length === 1 ? " needs" : "s need"} your RSVP
        </p>
      ) : null}

      {sessions.length === 0 ? (
        <EmptyState title="Nothing scheduled">Practices and filming for your crews will show up here.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link
                href={`/songs/${s.songId}/sessions/${s.id}`}
                className="flex items-center gap-3 rounded-2xl border bg-card p-3 transition-colors hover:border-primary/50"
              >
                <div
                  className={
                    s.kind === "filming"
                      ? "flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-amber-400/15 text-amber-300"
                      : "flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-violet-400/15 text-violet-300"
                  }
                >
                  <span className="text-[10px] font-semibold uppercase">{SESSION_KIND_LABEL[s.kind]}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{s.songTitle}</p>
                  <p className="flex items-center gap-1 text-sm text-muted-foreground">
                    <HugeiconsIcon icon={Clock01Icon} className="size-3.5" aria-hidden />
                    {fmtRange(s.startsAt, s.endsAt, tz)}
                  </p>
                  {s.locationText ? (
                    <p className="flex items-center gap-1 truncate text-sm text-muted-foreground">
                      <HugeiconsIcon icon={Location01Icon} className="size-3.5" aria-hidden />
                      {s.locationText}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
                  <span className="text-muted-foreground">{fmtRelative(s.startsAt)}</span>
                  {s.rsvp === "going" ? (
                    <span className="text-emerald-400">✓ Going</span>
                  ) : s.rsvp === "not_going" ? (
                    <span className="text-rose-400">✕ Can&apos;t make it</span>
                  ) : (
                    <span className="font-semibold text-amber-300">RSVP needed</span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
