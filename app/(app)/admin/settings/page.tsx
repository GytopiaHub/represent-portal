import type { Metadata } from "next";
import { ActionButton } from "@/components/action-button";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { SectionTitle } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { runTickNow, syncYoutubeNow, updateSettings } from "@/lib/actions/admin";
import { getViewer } from "@/lib/dal";
import { getAdminSettings } from "@/lib/queries/admin";
import { isMockGoogle } from "@/lib/server/integrations";
import { ticksStalled } from "@/lib/server/settings";
import { fmtDateTime, fmtRelative } from "@/lib/time";

export const metadata: Metadata = { title: "Settings" };

function Field({ id, label, hint, ...rest }: { id: string; label: string; hint?: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} {...rest} />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export default async function SettingsPage() {
  const viewer = await getViewer();
  const { settings: s, runs } = await getAdminSettings();
  const lastRun = runs.find((r) => r.kind.startsWith("youtube"));
  const hhmm = (t: string) => t.slice(0, 5);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <Card>
        <CardContent>
          <ActionForm action={updateSettings} successMessage="Saved — changes apply immediately." className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field id="youtubeChannelId" label="YouTube channel ID" defaultValue={s.youtubeChannelId ?? ""} placeholder="UC…" hint="Must be set before the sync runs." />
            </div>
            <Field id="syncTimeSgt" label="Daily YouTube sync time (SGT)" type="time" defaultValue={hhmm(s.syncTimeSgt)} required />
            <Field id="defaultTimezone" label="Default time zone" defaultValue={s.defaultTimezone} required />
            <Field id="defaultPracticeMinutes" label="Default practice length (min)" type="number" min={15} defaultValue={s.defaultPracticeMinutes} required />
            <Field id="defaultFilmingMinutes" label="Default filming length (min)" type="number" min={15} defaultValue={s.defaultFilmingMinutes} required />
            <Field id="availWindowStart" label="Schedulable from" type="time" defaultValue={hhmm(s.availWindowStart)} required />
            <Field id="availWindowEnd" label="Schedulable until" type="time" defaultValue={hhmm(s.availWindowEnd)} required />
            <Field id="lookaheadWeeks" label="Availability look-ahead (weeks)" type="number" min={1} max={26} defaultValue={s.lookaheadWeeks} required />
            <div className="sm:col-span-2">
              <SubmitButton>Save settings</SubmitButton>
            </div>
          </ActionForm>
        </CardContent>
      </Card>

      <aside className="flex flex-col gap-4">
        {ticksStalled(s) ? (
          <Alert variant="destructive">
            <AlertTitle>Scheduled jobs look stalled — check GitHub Actions</AlertTitle>
            <AlertDescription>
              Last tick: {s.lastTickAt ? fmtRelative(s.lastTickAt) : "never"}. Make sure <code>cron.yml</code> and <code>keepalive.yml</code> are enabled.
            </AlertDescription>
          </Alert>
        ) : (
          <p className="text-sm text-emerald-400">✓ Scheduled jobs running · last tick {fmtRelative(s.lastTickAt!)}</p>
        )}

        <Card>
          <CardContent className="flex flex-col gap-3">
            <SectionTitle>YouTube sync</SectionTitle>
            {isMockGoogle ? <p className="text-xs text-amber-300">Demo mode: syncing from the simulated channel.</p> : null}
            {lastRun ? (
              <dl className="grid grid-cols-2 gap-1 text-sm">
                <dt className="text-muted-foreground">Last run</dt>
                <dd>{fmtDateTime(lastRun.startedAt, viewer.tz)}</dd>
                <dt className="text-muted-foreground">Result</dt>
                <dd className={lastRun.ok ? "text-emerald-400" : "text-rose-400"}>{lastRun.ok ? "✓ OK" : lastRun.ok === false ? "✕ Failed" : "Running…"}</dd>
                <dt className="text-muted-foreground">Videos added</dt>
                <dd>{lastRun.summary.added ?? 0}</dd>
                <dt className="text-muted-foreground">Updated</dt>
                <dd>{lastRun.summary.updated ?? 0}</dd>
                {lastRun.summary.errors?.length ? (
                  <>
                    <dt className="text-muted-foreground">Errors</dt>
                    <dd className="text-rose-400">{lastRun.summary.errors.join("; ")}</dd>
                  </>
                ) : null}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">Never run.</p>
            )}
            <ActionButton action={syncYoutubeNow} variant="default">Sync YouTube now</ActionButton>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3">
            <SectionTitle>Scheduled jobs</SectionTitle>
            <p className="text-sm text-muted-foreground">
              GitHub Actions calls <code>/api/cron/tick</code> hourly: YouTube sync when due, RSVP reminders, calendar retries and cache cleanup.
            </p>
            <ActionButton action={runTickNow}>Run tick now</ActionButton>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-2">
            <SectionTitle>Recent runs</SectionTitle>
            <ul className="flex flex-col gap-1 text-sm">
              {runs.map((r) => (
                <li key={r.id} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{r.kind}</span>
                  <span>{fmtRelative(r.startedAt)} {r.ok ? "✓" : r.ok === false ? "✕" : "…"}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
