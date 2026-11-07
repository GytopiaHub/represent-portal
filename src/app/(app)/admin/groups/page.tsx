import type { Metadata } from "next";
import { ActionButton } from "@/components/common/action-button";
import { ActionForm, SubmitButton } from "@/components/common/action-form";
import { EmptyState, SectionTitle } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  addIdolMember,
  resolveGroupRequest,
  saveGroup,
  setIdolMemberActive,
  updateIdolMember,
} from "@/server/groups/actions";
import { requireAdmin } from "@/server/auth-guards";
import { GROUP_TYPES, GROUP_TYPE_LABEL } from "@/lib/labels";
import { listGroupRequests, listGroupsWithMembers } from "@/server/groups/queries";
import type { GroupType } from "@/db/schema";

export const metadata: Metadata = { title: "Groups & rosters" };

function GroupFields({ g }: { g?: { name: string; nameKr: string | null; groupType: GroupType; imageUrl: string | null; isActive: boolean } }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Input name="name" defaultValue={g?.name} placeholder="Name" required maxLength={80} aria-label="Name" />
      <Input name="nameKr" defaultValue={g?.nameKr ?? ""} placeholder="Korean name (optional)" maxLength={80} aria-label="Korean name" />
      <NativeSelect name="groupType" defaultValue={g?.groupType ?? "girl_group"} aria-label="Type" className="w-full">
        {GROUP_TYPES.map((t) => (
          <NativeSelectOption key={t} value={t}>{GROUP_TYPE_LABEL[t]}</NativeSelectOption>
        ))}
      </NativeSelect>
      <Input name="imageUrl" type="url" defaultValue={g?.imageUrl ?? ""} placeholder="Image URL (optional)" aria-label="Image URL" />
      <label className="flex min-h-9 items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={g?.isActive ?? true} className="size-4 accent-[var(--primary)]" />
        Active (untick if disbanded)
      </label>
    </div>
  );
}

export default async function AdminGroupsPage() {
  await requireAdmin();
  const [groups, requests] = await Promise.all([listGroupsWithMembers(), listGroupRequests()]);
  const open = requests.filter((r) => r.status === "open");

  return (
    <div className="flex flex-col gap-8">
      {open.length > 0 ? (
        <section className="flex flex-col gap-3">
          <SectionTitle>Requests ({open.length})</SectionTitle>
          <ul className="flex flex-col gap-2">
            {open.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/40 bg-card p-3">
                <span className="flex-1">
                  <strong>{r.name}</strong> <span className="text-sm text-muted-foreground">from {r.requestedByName}{r.note ? ` — ${r.note}` : ""}</span>
                </span>
                <ActionButton action={resolveGroupRequest.bind(null, r.id, "done")} variant="default">Mark added</ActionButton>
                <ActionButton action={resolveGroupRequest.bind(null, r.id, "rejected")} variant="ghost">Decline</ActionButton>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Card>
        <CardContent className="flex flex-col gap-3">
          <h2 className="font-bold">Add a group</h2>
          <ActionForm action={saveGroup.bind(null, null)} resetOnSuccess className="flex flex-col gap-3">
            <GroupFields />
            <SubmitButton className="self-start">Create group</SubmitButton>
          </ActionForm>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <SectionTitle>Groups ({groups.length})</SectionTitle>
        <p className="text-sm text-muted-foreground">Roster changes only affect new songs — existing songs keep their positions. Deactivate members instead of deleting them.</p>
        {groups.length === 0 ? <EmptyState title="No groups yet" /> : null}
        {groups.map((g) => (
          <details key={g.id} className="rounded-2xl border bg-card p-4">
            <summary className="flex cursor-pointer flex-wrap items-baseline gap-2">
              <span className="font-bold">{g.name}</span>
              <span className="text-sm text-muted-foreground">
                {GROUP_TYPE_LABEL[g.groupType]} · {g.members.filter((m) => m.isActive).length} active members · {g.songCount} songs
                {g.isActive ? "" : " · disbanded"}
              </span>
            </summary>
            <div className="mt-4 flex flex-col gap-4">
              <ActionForm action={saveGroup.bind(null, g.id)} className="flex flex-col gap-2">
                <GroupFields g={g} />
                <SubmitButton variant="outline" className="self-start">Save group</SubmitButton>
              </ActionForm>
              <ul className="flex flex-col gap-1.5">
                {g.members.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-2">
                    <ActionForm action={updateIdolMember.bind(null, m.id)} className="flex flex-1 flex-wrap gap-2">
                      <Input name="name" defaultValue={m.name} required maxLength={80} aria-label="Name" className={m.isActive ? "w-40" : "w-40 opacity-50"} />
                      <Input name="romanisation" defaultValue={m.romanisation ?? ""} placeholder="Romanisation" maxLength={80} aria-label="Romanisation" className="w-40" />
                      <Input name="imageUrl" type="url" defaultValue={m.imageUrl ?? ""} placeholder="Image URL" aria-label="Image URL" className="w-48" />
                      <SubmitButton variant="ghost" size="sm">Save</SubmitButton>
                    </ActionForm>
                    <ActionButton action={setIdolMemberActive.bind(null, m.id, !m.isActive)} variant="ghost">
                      {m.isActive ? "Deactivate" : "Reactivate"}
                    </ActionButton>
                  </li>
                ))}
              </ul>
              <ActionForm action={addIdolMember.bind(null, g.id)} resetOnSuccess className="flex flex-wrap gap-2">
                <Input name="name" placeholder="New member name" required maxLength={80} aria-label="New member name" className="w-48" />
                <Input name="romanisation" placeholder="Romanisation (optional)" maxLength={80} aria-label="Romanisation" className="w-48" />
                <SubmitButton variant="outline">Add member</SubmitButton>
              </ActionForm>
            </div>
          </details>
        ))}
      </section>
    </div>
  );
}
