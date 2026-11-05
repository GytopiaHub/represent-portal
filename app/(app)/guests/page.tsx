import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { EmptyState, PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createGuest, updateGuest } from "@/lib/actions/community";
import { listGuests } from "@/lib/queries/songs";

export const metadata: Metadata = { title: "Guests" };

/** Reusable guest list (FR-GST-1). Edit your own guests; admins edit all. */
export default async function GuestsPage() {
  const guests = await listGuests();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Guests" description="People outside RepresENT who can be credited on songs." />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {guests.length === 0 ? (
          <EmptyState title="No guests yet" />
        ) : (
          <ul className="flex flex-col gap-2">
            {guests.map((g) => (
              <li key={g.id} className="rounded-2xl border bg-card p-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-semibold">{g.name}</span>
                  {g.instagram ? <span className="text-sm text-muted-foreground">@{g.instagram}</span> : null}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {g.credits} credit{g.credits === 1 ? "" : "s"} · added by {g.creatorName ?? "—"}
                  </span>
                </div>
                {g.contactNote ? <p className="text-sm text-muted-foreground">{g.contactNote}</p> : null}
                {g.canEdit ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-primary">Edit</summary>
                    <ActionForm action={updateGuest.bind(null, g.id)} className="mt-2 grid gap-2 sm:grid-cols-3">
                      <Input name="name" defaultValue={g.name} required maxLength={80} aria-label="Name" />
                      <Input name="instagram" defaultValue={g.instagram ?? ""} placeholder="@instagram" maxLength={40} aria-label="Instagram" />
                      <Input name="contactNote" defaultValue={g.contactNote ?? ""} placeholder="Contact note" maxLength={300} aria-label="Contact note" />
                      <SubmitButton variant="outline" className="self-start">Save</SubmitButton>
                    </ActionForm>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <Card className="self-start">
          <CardContent>
            <ActionForm action={createGuest} resetOnSuccess successMessage="Guest added." className="flex flex-col gap-2">
              <h2 className="font-bold">Add a guest</h2>
              <Input name="name" placeholder="Name" required maxLength={80} aria-label="Name" />
              <Input name="instagram" placeholder="@instagram (optional)" maxLength={40} aria-label="Instagram" />
              <Input name="contactNote" placeholder="Contact note (optional)" maxLength={300} aria-label="Contact note" />
              <SubmitButton className="self-start">Add guest</SubmitButton>
            </ActionForm>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
