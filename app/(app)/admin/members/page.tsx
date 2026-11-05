import { Suspense } from "react";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionButton } from "@/components/admin/action-button";
import { MemberRow, formatDate } from "@/components/admin/member-row";
import {
  demoteToMember,
  promoteToAdmin,
  removeMember,
  restoreMember,
} from "@/lib/actions";
import { requireActiveUser } from "@/lib/dal";
import { searchMembers, type MemberRow as Member } from "@/lib/data";

export const metadata: Metadata = { title: "Members" };

type SearchParams = PageProps<"/admin/members">["searchParams"];

function memberActions(m: Member, myId: string) {
  if (m.status === "removed") {
    return <ActionButton action={restoreMember.bind(null, m.id)}>Restore</ActionButton>;
  }
  const isMe = m.id === myId;
  return (
    <>
      {m.role === "admin" ? (
        <ActionButton
          action={demoteToMember.bind(null, m.id)}
          confirm={isMe ? "Demote yourself? You'll lose access to admin pages." : undefined}
        >
          Demote to member
        </ActionButton>
      ) : (
        <ActionButton action={promoteToAdmin.bind(null, m.id)}>Make admin</ActionButton>
      )}
      <ActionButton
        action={removeMember.bind(null, m.id)}
        variant="destructive"
        confirm={`Remove ${m.name ?? m.email}? They'll be signed out and won't be able to sign in. Their history stays.`}
      >
        Remove
      </ActionButton>
    </>
  );
}

async function MemberList({ searchParams }: { searchParams: SearchParams }) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const [me, members] = await Promise.all([requireActiveUser(), searchMembers(query)]);

  return (
    <>
      <form className="flex gap-2" role="search">
        <Input
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Search by name, stage name or email"
          aria-label="Search members"
          className="max-w-sm"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      <Card>
        <CardContent className="px-0">
          {members.length === 0 ? (
            <p className="px-4 text-sm text-muted-foreground">
              {query ? `No members match “${query}”.` : "No members yet."}
            </p>
          ) : (
            <ul className="divide-y">
              {members.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  badges={
                    <>
                      {m.role === "admin" ? <Badge variant="secondary">Admin</Badge> : null}
                      {m.status === "removed" ? <Badge variant="destructive">Removed</Badge> : null}
                      {m.id === me.id ? <Badge variant="outline">You</Badge> : null}
                    </>
                  }
                  meta={
                    <>
                      {m.stageName ? <>“{m.stageName}” · </> : null}
                      Signed up {formatDate(m.createdAt)}
                    </>
                  }
                  actions={memberActions(m, me.id)}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export default function MembersPage(props: PageProps<"/admin/members">) {
  return (
    <div className="flex flex-col gap-4">
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
        <MemberList searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
