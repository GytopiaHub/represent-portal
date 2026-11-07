import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, Location01Icon } from "@hugeicons/core-free-icons";
import { ActionButton } from "@/components/common/action-button";
import { ActionForm, SubmitButton } from "@/components/common/action-form";
import { AvailFlag } from "@/components/common/chips";
import { PageHeader, SectionTitle } from "@/components/layout/page-header";
import { SessionForm } from "@/features/schedule/components/session-form";
import { UserAvatar } from "@/components/common/user-avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  addFilmingLocation,
  removeFilmingLocation,
  rsvp,
  setFinalLocation,
  setSessionCancelled,
  setVideographers,
  updateSession,
} from "@/server/schedule/actions";
import { BOOKING_LABEL, CREW_ROLE_LABEL, SESSION_KIND_LABEL } from "@/lib/labels";
import { getSessionDetail } from "@/server/schedule/queries";
import { fmtRange, toLocalInputValue } from "@/lib/time";

export const metadata: Metadata = { title: "Session" };

export default async function SessionPage(props: PageProps<"/songs/[id]/sessions/[sid]">) {
  const { id, sid } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(sid)) notFound();
  const data = await getSessionDetail(id, sid);
  if (!data) notFound();
  const { session: s, song, crew, locations, videographerAssignments, canEdit, viewerId, tz, settings } = data;
  const me = crew.find((c) => c.userId === viewerId);
  const cancelled = s.status === "cancelled";
  const calendarFailures = crew.filter((c) => c.calendar?.state === "failed");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={
          <Link href={`/songs/${song.id}?tab=schedule`} className="hover:underline">
            ← {song.groupName} – {song.title}
          </Link>
        }
        title={
          <span className={cancelled ? "text-muted-foreground line-through" : undefined}>
            {SESSION_KIND_LABEL[s.kind]} · {fmtRange(s.startsAt, s.endsAt, tz)}
          </span>
        }
        description={
          s.locationText ? (
            <span className="inline-flex items-center gap-1">
              <HugeiconsIcon icon={Location01Icon} className="size-4" aria-hidden />
              {s.locationUrl ? (
                <a href={s.locationUrl} target="_blank" rel="noreferrer" className="underline">
                  {s.locationText}
                </a>
              ) : (
                s.locationText
              )}
              {s.kind === "practice" ? ` · ${BOOKING_LABEL[s.bookingStatus]}${s.bookingRef ? ` (${s.bookingRef})` : ""}` : ""}
            </span>
          ) : undefined
        }
        actions={
          canEdit ? (
            <ActionButton
              action={setSessionCancelled.bind(null, s.id, !cancelled)}
              variant={cancelled ? "outline" : "destructive"}
              confirm={cancelled ? undefined : "Cancel this session? Everyone's calendar event will be removed."}
            >
              {cancelled ? "Restore session" : "Cancel session"}
            </ActionButton>
          ) : null
        }
      />

      {cancelled ? (
        <Alert variant="destructive">
          <AlertTitle>This session is cancelled</AlertTitle>
        </Alert>
      ) : null}

      {canEdit && calendarFailures.length > 0 ? (
        // FR-CAL-5: "Calendar not updated for X"
        <Alert>
          <HugeiconsIcon icon={Alert02Icon} aria-hidden />
          <AlertTitle>Calendar not updated for {calendarFailures.map((c) => c.name).join(", ")}</AlertTitle>
          <AlertDescription>
            {calendarFailures[0].calendar?.error}. It&apos;ll retry automatically; they may need to reconnect Google Calendar.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          {me && !cancelled ? (
            <Card className="border-primary/40">
              <CardContent className="flex flex-col gap-3">
                <p className="font-semibold">Can you make it?</p>
                <ActionForm action={rsvp.bind(null, s.id)} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="flex gap-2">
                    <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 has-checked:border-emerald-400 has-checked:bg-emerald-400/10">
                      <input type="radio" name="response" value="going" defaultChecked={me.rsvp?.response === "going"} required className="accent-emerald-400" />
                      Going
                    </label>
                    <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 has-checked:border-rose-400 has-checked:bg-rose-400/10">
                      <input type="radio" name="response" value="not_going" defaultChecked={me.rsvp?.response === "not_going"} className="accent-rose-400" />
                      Can&apos;t make it
                    </label>
                  </div>
                  <Input name="reason" placeholder="Reason (optional)" defaultValue={me.rsvp?.reason ?? ""} maxLength={300} className="flex-1" />
                  <SubmitButton>Save</SubmitButton>
                </ActionForm>
              </CardContent>
            </Card>
          ) : null}

          {/* FR-PR-2/3: availability flag and RSVP side by side */}
          <section className="flex flex-col gap-3">
            <SectionTitle>Crew</SectionTitle>
            <div className="overflow-x-auto rounded-2xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-muted-foreground">
                  <tr>
                    <th className="p-3 font-medium">Member</th>
                    <th className="p-3 font-medium">Availability</th>
                    <th className="p-3 font-medium">RSVP</th>
                    {canEdit ? <th className="p-3 font-medium">Calendar</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {crew.map((c) => (
                    <tr key={c.userId} className="border-t">
                      <td className="p-3">
                        <span className="flex items-center gap-2">
                          <UserAvatar name={c.name} image={c.image} size="sm" />
                          <span>
                            {c.name}
                            <span className="block text-xs text-muted-foreground">{c.roles.map((r) => CREW_ROLE_LABEL[r]).join(", ")}</span>
                          </span>
                        </span>
                      </td>
                      <td className="p-3">
                        <AvailFlag flag={c.flag} />
                      </td>
                      <td className="p-3">
                        {c.rsvp?.response === "going" ? (
                          <span className="text-emerald-400">✓ Going</span>
                        ) : c.rsvp?.response === "not_going" ? (
                          <span className="text-rose-400">
                            ✕ Can&apos;t make it{c.rsvp.reason ? <span className="block text-xs text-muted-foreground">{c.rsvp.reason}</span> : null}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">No reply</span>
                        )}
                      </td>
                      {canEdit ? (
                        <td className="p-3 text-xs">
                          {c.calendar?.state === "ok" ? (
                            <span className="text-emerald-400">✓ Added</span>
                          ) : c.calendar?.state === "failed" ? (
                            <span className="text-rose-400">✕ Failed</span>
                          ) : (
                            <span className="text-muted-foreground">Pending</span>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">Guests aren&apos;t listed — they don&apos;t get calendar events or RSVPs.</p>
          </section>

          {s.notes ? (
            <section className="flex flex-col gap-2">
              <SectionTitle>Notes</SectionTitle>
              <p className="whitespace-pre-line">{s.notes}</p>
            </section>
          ) : null}

          {s.kind === "filming" ? (
            <section className="flex flex-col gap-3">
              <SectionTitle>Candidate locations</SectionTitle>
              <ul className="flex flex-col gap-2">
                {locations.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {l.mapUrl ? <a href={l.mapUrl} target="_blank" rel="noreferrer" className="hover:underline">{l.name}</a> : l.name}
                        {l.isFinal ? <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">Final</span> : null}
                      </p>
                      {l.notes ? <p className="text-sm text-muted-foreground">{l.notes}</p> : null}
                    </div>
                    {canEdit ? (
                      <div className="flex gap-1">
                        {!l.isFinal ? <ActionButton action={setFinalLocation.bind(null, s.id, l.id)}>Mark final</ActionButton> : null}
                        <ActionButton action={removeFilmingLocation.bind(null, s.id, l.id)} variant="ghost">Remove</ActionButton>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
              {canEdit ? (
                <ActionForm action={addFilmingLocation.bind(null, s.id)} resetOnSuccess className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <Input name="name" placeholder="Location name" required maxLength={120} aria-label="Location name" />
                  <Input name="mapUrl" type="url" placeholder="Map link (optional)" aria-label="Map link" />
                  <SubmitButton variant="outline">Add</SubmitButton>
                </ActionForm>
              ) : null}
              {s.checklist ? (
                <Card>
                  <CardHeader><CardTitle className="text-base">Outfit / props</CardTitle></CardHeader>
                  <CardContent><p className="whitespace-pre-line text-sm">{s.checklist}</p></CardContent>
                </Card>
              ) : null}
            </section>
          ) : null}
        </div>

        {canEdit ? (
          <aside className="flex flex-col gap-4">
            {s.kind === "filming" ? (
              <Card>
                <CardHeader><CardTitle className="text-base">Videographers</CardTitle></CardHeader>
                <CardContent>
                  {videographerAssignments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Add videographers on the Crew tab first.</p>
                  ) : (
                    <ActionForm action={setVideographers.bind(null, s.id)} className="flex flex-col gap-2">
                      {videographerAssignments.map((v) => (
                        <label key={v.id} className="flex min-h-9 items-center gap-2">
                          <input type="checkbox" name="assignmentId" value={v.id} defaultChecked={v.selected} className="size-4 accent-[var(--primary)]" />
                          {v.name}
                        </label>
                      ))}
                      <SubmitButton variant="outline" className="self-start">Save</SubmitButton>
                    </ActionForm>
                  )}
                </CardContent>
              </Card>
            ) : null}
            <details className="rounded-2xl border bg-card p-4" open={false}>
              <summary className="cursor-pointer font-semibold">Edit session</summary>
              <div className="mt-4">
                <SessionForm
                  action={updateSession.bind(null, s.id)}
                  kindLocked
                  defaults={{
                    kind: s.kind,
                    startsAt: toLocalInputValue(s.startsAt, tz),
                    endsAt: toLocalInputValue(s.endsAt, tz),
                    locationText: s.locationText,
                    locationUrl: s.locationUrl,
                    bookingStatus: s.bookingStatus,
                    bookingRef: s.bookingRef,
                    notes: s.notes,
                    checklist: s.checklist,
                    refUrl: s.referenceLinks[0]?.url ?? null,
                  }}
                  durations={{ practice: settings.defaultPracticeMinutes, filming: settings.defaultFilmingMinutes }}
                  submitLabel="Save changes"
                />
              </div>
            </details>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
