import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/action-button";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { WeekView } from "@/components/avails/week-view";
import { PageHeader, SectionTitle } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { addOverride, deleteOverride, refreshFromGoogle } from "@/lib/actions/avails";
import { getViewer } from "@/lib/dal";
import { getMyOverrides } from "@/lib/queries/me";
import { getAvailability } from "@/lib/server/avails";
import { isMockGoogle } from "@/lib/server/integrations";
import { addDaysKey, fmtDate, fmtRange, startOfDayKey, toLocalInputValue, weekStartKey } from "@/lib/time";

export const metadata: Metadata = { title: "My availability" };

export default async function AvailabilityPage(props: PageProps<"/availability">) {
  const viewer = await getViewer();
  const sp = await props.searchParams;
  const week = typeof sp.week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? sp.week : weekStartKey(new Date(), viewer.tz);
  const from = startOfDayKey(week, viewer.tz);
  const to = startOfDayKey(addDaysKey(week, 7), viewer.tz);

  const [avails, { overrides }] = await Promise.all([getAvailability([viewer.id], from, to), getMyOverrides()]);
  const mine = avails.get(viewer.id)!;
  const defaultStart = toLocalInputValue(new Date(Math.ceil(Date.now() / 3_600_000) * 3_600_000), viewer.tz);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My availability"
        description="What the crew sees when planning. Only busy/free times are shared — never event details."
        actions={<ActionButton action={refreshFromGoogle}>Refresh from Google</ActionButton>}
      />

      {!mine.connected ? (
        <Alert>
          <AlertTitle>No calendars selected</AlertTitle>
          <AlertDescription>
            Your availability shows as &ldquo;unknown&rdquo; to ICs. <Link href="/onboarding">Pick calendars</Link> that count as busy.
          </AlertDescription>
        </Alert>
      ) : isMockGoogle ? (
        <p className="text-xs text-muted-foreground">Demo mode: Google busy blocks are simulated.</p>
      ) : null}

      <div className="flex items-center justify-between">
        <SectionTitle>Week of {fmtDate(from, viewer.tz)}</SectionTitle>
        <div className="flex gap-1">
          <Link href={`/availability?week=${addDaysKey(week, -7)}`} className="rounded-full px-3 py-1.5 text-sm hover:bg-muted">← Prev</Link>
          <Link href="/availability" className="rounded-full px-3 py-1.5 text-sm hover:bg-muted">This week</Link>
          <Link href={`/availability?week=${addDaysKey(week, 7)}`} className="rounded-full px-3 py-1.5 text-sm hover:bg-muted">Next →</Link>
        </div>
      </div>
      <WeekView avail={mine} weekKey={week} tz={viewer.tz} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-4">
            <div>
              <h2 className="font-bold">Add a manual block</h2>
              <p className="text-sm text-muted-foreground">Manual blocks override Google. Mark yourself free over a calendar event you can skip, or busy for things not in your calendar.</p>
            </div>
            <ActionForm action={addOverride} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="kind">Type</Label>
                <NativeSelect id="kind" name="kind" defaultValue="busy" className="w-full">
                  <NativeSelectOption value="busy">Busy</NativeSelectOption>
                  <NativeSelectOption value="free">Free</NativeSelectOption>
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="recurrence">Repeats</Label>
                <NativeSelect id="recurrence" name="recurrence" defaultValue="none" className="w-full">
                  <NativeSelectOption value="none">One-off</NativeSelectOption>
                  <NativeSelectOption value="weekly">Weekly</NativeSelectOption>
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="startsAt">From</Label>
                <Input id="startsAt" name="startsAt" type="datetime-local" required defaultValue={defaultStart} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="endsAt">To</Label>
                <Input id="endsAt" name="endsAt" type="datetime-local" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="recurrenceUntil">Weekly until (optional)</Label>
                <Input id="recurrenceUntil" name="recurrenceUntil" type="date" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="note">Note (optional)</Label>
                <Input id="note" name="note" maxLength={200} />
              </div>
              <SubmitButton className="self-start">Add block</SubmitButton>
            </ActionForm>
          </CardContent>
        </Card>

        <section className="flex flex-col gap-3">
          <SectionTitle>My manual blocks</SectionTitle>
          {overrides.length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {overrides.map((o) => (
                <li key={o.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3 text-sm">
                  <span className={o.kind === "busy" ? "font-semibold text-rose-300" : "font-semibold text-emerald-300"}>{o.kind === "busy" ? "Busy" : "Free"}</span>
                  <span className="min-w-0 flex-1">
                    {fmtRange(o.startsAt, o.endsAt, viewer.tz)}
                    {o.recurrence === "weekly" ? <span className="text-muted-foreground"> · weekly{o.recurrenceUntil ? ` until ${fmtDate(o.recurrenceUntil, viewer.tz)}` : ""}</span> : null}
                    {o.note ? <span className="block text-muted-foreground">{o.note}</span> : null}
                  </span>
                  <ActionButton action={deleteOverride.bind(null, o.id)} variant="ghost">Delete</ActionButton>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
