import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, ArrowUp01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { ActionButton } from "@/components/common/action-button";
import { ActionForm, SubmitButton } from "@/components/common/action-form";
import { GuestTag } from "@/components/common/chips";
import { SectionTitle } from "@/components/layout/page-header";
import { UserAvatar } from "@/components/common/user-avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption, NativeSelectOptGroup } from "@/components/ui/native-select";
import { addCustomPosition, movePosition, removePosition } from "@/server/songs/actions";
import {
  assignGuest,
  assignMemberDirect,
  cancelInvite,
  inviteMember,
  removeAssignment,
} from "@/server/crew/actions";
import { CREW_ROLE_LABEL } from "@/lib/labels";
import { getInviteCandidates } from "@/server/crew/queries";
import { listGuests } from "@/server/guests/queries";
import type { Holder, SongDetail } from "@/server/songs/queries";
import { fmtDate } from "@/lib/time";
import type { CrewRole } from "@/db/schema";

function HolderView({ holder }: { holder: Holder }) {
  if (holder.kind === "guest") {
    return (
      <span className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full border border-dashed text-xs">G</span>
        <span>{holder.name}</span>
        <GuestTag />
      </span>
    );
  }
  return (
    <Link href={`/members/${holder.userId}`} className="flex items-center gap-2 hover:underline">
      <UserAvatar name={holder.name} image={holder.image} size="sm" />
      {holder.name}
    </Link>
  );
}

function SlotPicker({ song, roles }: { song: SongDetail; roles: CrewRole[] }) {
  const open = song.positions.filter((p) => !p.assignment && !p.invite);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Role / slot</span>
        <NativeSelect name="slot" required className="w-full" aria-label="Slot">
          {open.length > 0 ? (
            <NativeSelectOptGroup label="Dance positions">
              {open.map((p) => (
                <NativeSelectOption key={p.id} value={`dancer:${p.id}`}>
                  Dancer — {p.label}
                </NativeSelectOption>
              ))}
            </NativeSelectOptGroup>
          ) : null}
          <NativeSelectOptGroup label="Other roles">
            {roles.map((r) => (
              <NativeSelectOption key={r} value={`${r}:`}>
                {CREW_ROLE_LABEL[r]}
              </NativeSelectOption>
            ))}
          </NativeSelectOptGroup>
        </NativeSelect>
      </div>
    </div>
  );
}

async function RecruitPanel({ song }: { song: SongDetail }) {
  const [{ members, from, to }, guests] = await Promise.all([
    getInviteCandidates(song.id, song.targetPostDate),
    listGuests(),
  ]);
  const roles: CrewRole[] = ["ic", "videographer", "editor"];
  const memberAction = song.isBackfill ? assignMemberDirect : inviteMember;

  return (
    <Card>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <h3 className="font-semibold">{song.isBackfill ? "Assign a member" : "Invite a member"}</h3>
          <p className="text-sm text-muted-foreground">
            {song.isBackfill
              ? "Backfilled songs record crew directly — no invitations."
              : `Free hours are within the availability window, ${fmtDate(from, song.tz)} – ${fmtDate(to, song.tz)}.`}{" "}
            <Link href={`/songs/${song.id}?tab=avails&members=all`} className="underline">
              See everyone&apos;s avails
            </Link>
          </p>
          <ActionForm action={memberAction.bind(null, song.id)} resetOnSuccess className="flex flex-col gap-3">
            <SlotPicker song={song} roles={roles} />
            <NativeSelect name="userId" required className="w-full" aria-label="Member">
              <NativeSelectOption value="">Pick a member…</NativeSelectOption>
              {members.map((m) => (
                <NativeSelectOption key={m.id} value={m.id}>
                  {m.name} — {m.connected ? `${m.freeHours}h free` : "avails unknown"} · {m.activeCrews} active crew{m.activeCrews === 1 ? "" : "s"}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <SubmitButton className="self-start">{song.isBackfill ? "Assign" : "Send invite"}</SubmitButton>
          </ActionForm>
        </div>

        <div className="flex flex-col gap-3 border-t pt-6">
          <h3 className="font-semibold">Assign a guest</h3>
          <p className="text-sm text-muted-foreground">Guests are credited by name and need no acceptance. Pick one or add a new guest.</p>
          <ActionForm action={assignGuest.bind(null, song.id)} resetOnSuccess className="flex flex-col gap-3">
            <SlotPicker song={song} roles={roles.filter((r) => r !== "ic")} />
            <NativeSelect name="guestId" className="w-full" aria-label="Existing guest">
              <NativeSelectOption value="">New guest…</NativeSelectOption>
              {guests.map((g) => (
                <NativeSelectOption key={g.id} value={g.id}>
                  {g.name}
                  {g.instagram ? ` (@${g.instagram})` : ""}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input name="newGuestName" placeholder="New guest name" maxLength={80} aria-label="New guest name" />
              <Input name="newGuestInstagram" placeholder="@instagram (optional)" maxLength={40} aria-label="New guest Instagram" />
            </div>
            <SubmitButton variant="outline" className="self-start">Assign guest</SubmitButton>
          </ActionForm>
        </div>
      </CardContent>
    </Card>
  );
}

export async function CrewTab({ song }: { song: SongDetail }) {
  const roleSections: CrewRole[] = ["ic", "videographer", "editor"];
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="flex min-w-0 flex-col gap-6">
        <section className="flex flex-col gap-3">
          <SectionTitle>Dance positions</SectionTitle>
          <ul className="flex flex-col gap-2">
            {song.positions.map((p, i) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-3">
                <span className="w-28 shrink-0 font-semibold">
                  {p.label}
                  {p.isCustom ? <span className="block text-xs font-normal text-muted-foreground">custom</span> : null}
                </span>
                <div className="min-w-0 flex-1">
                  {p.assignment ? (
                    <HolderView holder={p.assignment.holder} />
                  ) : p.invite ? (
                    <span className="text-sm text-amber-300">Invited {p.invite.name} · pending</span>
                  ) : (
                    // FR-SONG-9
                    <span className="rounded-full border border-dashed border-cyan-400/50 px-2.5 py-0.5 text-sm text-cyan-300">Unfilled</span>
                  )}
                </div>
                {song.canEdit ? (
                  <div className="flex items-center gap-1">
                    {p.assignment ? (
                      <ActionButton action={removeAssignment.bind(null, song.id, p.assignment.id)} variant="ghost" confirm={`Remove ${p.assignment.holder.name} from ${p.label}?`}>
                        Remove
                      </ActionButton>
                    ) : null}
                    {p.invite ? (
                      <ActionButton action={cancelInvite.bind(null, song.id, p.invite.id)} variant="ghost">
                        Cancel invite
                      </ActionButton>
                    ) : null}
                    <ActionButton action={movePosition.bind(null, song.id, p.id, -1)} variant="ghost" size="icon-sm" aria-label={`Move ${p.label} up`}>
                      <HugeiconsIcon icon={ArrowUp01Icon} />
                    </ActionButton>
                    <ActionButton action={movePosition.bind(null, song.id, p.id, 1)} variant="ghost" size="icon-sm" aria-label={`Move ${p.label} down`}>
                      <HugeiconsIcon icon={ArrowDown01Icon} />
                    </ActionButton>
                    {!p.assignment && i >= 0 ? (
                      <ActionButton action={removePosition.bind(null, song.id, p.id)} variant="ghost" size="icon-sm" aria-label={`Delete position ${p.label}`} confirm={`Delete the ${p.label} position?`}>
                        <HugeiconsIcon icon={Delete02Icon} />
                      </ActionButton>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          {song.canEdit ? (
            <ActionForm action={addCustomPosition.bind(null, song.id)} resetOnSuccess className="flex gap-2">
              <Input name="label" placeholder='Add custom position, e.g. "Center"' maxLength={40} aria-label="Custom position" />
              <SubmitButton variant="outline">Add</SubmitButton>
            </ActionForm>
          ) : null}
        </section>

        {roleSections.map((role) => {
          const holders = song.crew.filter((c) => c.role === role);
          const invites = song.pendingInvites.filter((i) => i.role === role);
          return (
            <section key={role} className="flex flex-col gap-3">
              <SectionTitle>{CREW_ROLE_LABEL[role]}s</SectionTitle>
              {holders.length === 0 && invites.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nobody yet.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {holders.map((h) => (
                    <li key={h.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
                      <div className="flex-1">
                        <HolderView holder={h.holder} />
                      </div>
                      {song.canEdit ? (
                        <ActionButton action={removeAssignment.bind(null, song.id, h.id)} variant="ghost" confirm={`Remove ${h.holder.name} as ${CREW_ROLE_LABEL[role]}?`}>
                          Remove
                        </ActionButton>
                      ) : null}
                    </li>
                  ))}
                  {invites.map((i) => (
                    <li key={i.id} className="flex items-center gap-3 rounded-2xl border border-dashed p-3 text-sm">
                      <span className="flex-1 text-amber-300">Invited {i.name} · pending</span>
                      {song.canEdit ? (
                        <ActionButton action={cancelInvite.bind(null, song.id, i.id)} variant="ghost">
                          Cancel
                        </ActionButton>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {song.canEdit ? (
        <aside>
          <RecruitPanel song={song} />
        </aside>
      ) : null}
    </div>
  );
}
