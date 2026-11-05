import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { PageHeader, SectionTitle } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requestGroup } from "@/lib/actions/community";
import { GROUP_TYPE_LABEL } from "@/lib/labels";
import { listGroupRequests, listGroupsWithMembers } from "@/lib/queries/groups";

export const metadata: Metadata = { title: "Idol groups" };

/** Members can view groups & rosters and request missing ones (FR-GRP-4). */
export default async function GroupsPage() {
  const [groups, myRequests] = await Promise.all([listGroupsWithMembers(), listGroupRequests(true)]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Idol groups" description="Rosters used to prefill dance positions. Admins manage these." />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <li key={g.id} className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-bold">
                {g.name} {g.nameKr ? <span className="font-normal text-muted-foreground">{g.nameKr}</span> : null}
              </p>
              <span className="text-xs text-muted-foreground">{g.songCount} songs</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {GROUP_TYPE_LABEL[g.groupType]}
              {g.isActive ? "" : " · disbanded"}
            </p>
            <p className="text-sm">
              {g.members.filter((m) => m.isActive).map((m) => m.name).join(" · ") || "No roster"}
            </p>
          </li>
        ))}
      </ul>

      <Card id="request" className="max-w-xl">
        <CardContent className="flex flex-col gap-3">
          <SectionTitle>Request a group</SectionTitle>
          <p className="text-sm text-muted-foreground">Admins get notified. Meanwhile you can still start a song with custom positions.</p>
          <ActionForm action={requestGroup} resetOnSuccess successMessage="Request sent to the admins." className="flex flex-col gap-2">
            <Input name="name" placeholder="Group name" required maxLength={80} aria-label="Group name" />
            <Input name="note" placeholder="Note (optional)" maxLength={300} aria-label="Note" />
            <SubmitButton className="self-start">Send request</SubmitButton>
          </ActionForm>
          {myRequests.length ? (
            <ul className="text-sm text-muted-foreground">
              {myRequests.map((r) => (
                <li key={r.id}>
                  {r.name} — {r.status === "open" ? "waiting" : r.status}
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
