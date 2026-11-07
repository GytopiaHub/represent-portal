"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { completeOnboarding, type OnboardingState } from "@/server/account/actions";
import type { GoogleCalendar } from "@/server/google";

type Props = {
  defaults: {
    name: string;
    stageName: string;
    instagramHandle: string;
    busyCalendarIds: string[];
  };
  /** null = Google connection broken; availability will be "unknown". */
  calendars: GoogleCalendar[] | null;
  isReturning: boolean;
};

function Field({
  id,
  label,
  hint,
  error,
  ...input
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
} & React.ComponentProps<typeof Input>) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} aria-invalid={!!error} aria-describedby={`${id}-hint`} {...input} />
      <p id={`${id}-hint`} className={error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
        {error ?? hint}
      </p>
    </div>
  );
}

export function OnboardingForm({ defaults, calendars, isReturning }: Props) {
  const [state, formAction, pending] = useActionState<OnboardingState, FormData>(
    completeOnboarding,
    {},
  );
  const fe = state.fieldErrors ?? {};

  // First time through, pre-tick the primary calendar.
  const initiallyChecked = (c: GoogleCalendar) =>
    isReturning ? defaults.busyCalendarIds.includes(c.id) : c.primary;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <h2 className="font-medium">About you</h2>
        <Field
          id="name"
          label="Display name"
          defaultValue={defaults.name}
          required
          maxLength={80}
          autoComplete="name"
          error={fe.name}
          hint="How the crew will see you."
        />
        <Field
          id="stageName"
          label="Stage name (optional)"
          defaultValue={defaults.stageName}
          maxLength={80}
          error={fe.stageName}
        />
        <Field
          id="instagramHandle"
          label="Instagram handle (optional)"
          defaultValue={defaults.instagramHandle}
          placeholder="@yourhandle"
          maxLength={31}
          error={fe.instagramHandle}
        />
      </section>

      <Separator />

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-medium">Calendars that count as busy</h2>
          <p className="text-sm text-muted-foreground">
            We only look at <em>when</em> you&rsquo;re busy in these calendars, not what the events are, to
            work out your availability for rehearsals.
          </p>
        </div>

        {calendars === null ? (
          <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
            We couldn&rsquo;t load your calendars. Use the <strong>Reconnect</strong> button above, or carry
            on and pick them later — until then your availability shows as &ldquo;unknown&rdquo;.
          </p>
        ) : calendars.length === 0 ? (
          <p className="text-sm text-muted-foreground">No calendars found on your Google account.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {calendars.map((c) => (
              <li key={c.id}>
                <Label className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 font-normal">
                  <Checkbox name="calendarIds" value={c.id} defaultChecked={initiallyChecked(c)} />
                  <span
                    aria-hidden
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: c.backgroundColor ?? "var(--muted-foreground)" }}
                  />
                  <span className="min-w-0 flex-1 truncate">{c.summary}</span>
                  {c.primary ? <span className="text-xs text-muted-foreground">Primary</span> : null}
                </Label>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Separator />

      <section className="flex flex-col gap-2 text-sm text-muted-foreground">
        <h2 className="font-medium text-foreground">About Google access</h2>
        <p>
          <strong className="text-foreground">&ldquo;Google hasn&rsquo;t verified this app&rdquo;</strong> —
          you probably saw this when signing in. RepresENT is a small community app that hasn&rsquo;t been
          through Google&rsquo;s paid verification. It&rsquo;s safe to continue via{" "}
          <strong>Advanced → Go to RepresENT</strong>.
        </p>
        <p>
          <strong className="text-foreground">What we write to your calendar:</strong> when you join a
          rehearsal or shoot, RepresENT adds that event to your Google Calendar and keeps it up to date if
          the plan changes. We never edit or delete events we didn&rsquo;t create.
        </p>
      </section>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Saving…" : isReturning ? "Save" : "Finish setup"}
      </Button>
    </form>
  );
}
