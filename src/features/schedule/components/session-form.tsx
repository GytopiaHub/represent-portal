"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/common/action-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";

type Defaults = {
  kind: "practice" | "filming";
  startsAt: string; // datetime-local
  endsAt: string;
  locationText?: string | null;
  locationUrl?: string | null;
  bookingStatus?: "not_needed" | "to_book" | "booked";
  bookingRef?: string | null;
  notes?: string | null;
  checklist?: string | null;
  refUrl?: string | null;
};

function addMinutes(local: string, minutes: number) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) return local;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5] + minutes));
  return d.toISOString().slice(0, 16);
}

/** Create/edit form for a practice or filming session (FR-PR-1, FR-FM-1). */
export function SessionForm({
  action,
  defaults,
  durations,
  kindLocked = false,
  submitLabel,
}: {
  action: (fd: FormData) => Promise<ActionResult | void>;
  defaults: Defaults;
  durations: { practice: number; filming: number };
  kindLocked?: boolean;
  submitLabel: string;
}) {
  const [kind, setKind] = useState(defaults.kind);
  const [start, setStart] = useState(defaults.startsAt);
  const [end, setEnd] = useState(defaults.endsAt);

  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2">
      {kindLocked ? (
        <input type="hidden" name="kind" value={kind} />
      ) : (
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="kind">Type</Label>
          <NativeSelect
            id="kind"
            name="kind"
            value={kind}
            onChange={(e) => {
              const k = e.target.value as Defaults["kind"];
              setKind(k);
              setEnd(addMinutes(start, durations[k]));
            }}
          >
            <NativeSelectOption value="practice">Practice</NativeSelectOption>
            <NativeSelectOption value="filming">Filming</NativeSelectOption>
          </NativeSelect>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="startsAt">Starts</Label>
        <Input
          id="startsAt"
          name="startsAt"
          type="datetime-local"
          required
          value={start}
          onChange={(e) => {
            setStart(e.target.value);
            setEnd(addMinutes(e.target.value, durations[kind]));
          }}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="endsAt">Ends</Label>
        <Input id="endsAt" name="endsAt" type="datetime-local" required value={end} onChange={(e) => setEnd(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="locationText">{kind === "filming" ? "Location (first candidate)" : "Location"}</Label>
        <Input id="locationText" name="locationText" defaultValue={defaults.locationText ?? ""} maxLength={200} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="locationUrl">Map link (optional)</Label>
        <Input id="locationUrl" name="locationUrl" type="url" defaultValue={defaults.locationUrl ?? ""} />
      </div>
      {kind === "practice" ? (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bookingStatus">Studio booking</Label>
            <NativeSelect id="bookingStatus" name="bookingStatus" defaultValue={defaults.bookingStatus ?? "not_needed"} className="w-full">
              <NativeSelectOption value="not_needed">Not needed</NativeSelectOption>
              <NativeSelectOption value="to_book">To book</NativeSelectOption>
              <NativeSelectOption value="booked">Booked</NativeSelectOption>
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bookingRef">Booking ref (optional)</Label>
            <Input id="bookingRef" name="bookingRef" defaultValue={defaults.bookingRef ?? ""} maxLength={100} />
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="checklist">Outfit / props checklist (optional)</Label>
          <Textarea id="checklist" name="checklist" rows={3} defaultValue={defaults.checklist ?? ""} />
        </div>
      )}
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea id="notes" name="notes" rows={2} defaultValue={defaults.notes ?? ""} />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="refUrl">Reference link (optional)</Label>
        <Input id="refUrl" name="refUrl" type="url" defaultValue={defaults.refUrl ?? ""} />
      </div>
      <div className="sm:col-span-2">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
