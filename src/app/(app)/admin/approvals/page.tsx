import { Suspense } from "react";
import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionButton } from "@/components/common/action-button";
import { MemberRow, formatDate } from "@/features/members/components/member-row";
import { approveUser, rejectUser } from "@/server/members/actions";
import { getApprovalQueue } from "@/server/members/queries";

export const metadata: Metadata = { title: "Approvals" };

async function ApprovalLists() {
  const { pending, rejected } = await getApprovalQueue();

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Pending approval</CardTitle>
          <CardDescription>
            {pending.length === 0
              ? "Nobody is waiting. New sign-ins will show up here."
              : `${pending.length} ${pending.length === 1 ? "person is" : "people are"} waiting to join.`}
          </CardDescription>
        </CardHeader>
        {pending.length > 0 ? (
          <CardContent className="px-0">
            <ul className="divide-y">
              {pending.map((u) => (
                <MemberRow
                  key={u.id}
                  member={u}
                  meta={<>Signed up {formatDate(u.createdAt)}</>}
                  actions={
                    <>
                      <ActionButton action={approveUser.bind(null, u.id)} variant="default">
                        Approve
                      </ActionButton>
                      <ActionButton action={rejectUser.bind(null, u.id)} variant="destructive">
                        Reject
                      </ActionButton>
                    </>
                  }
                />
              ))}
            </ul>
          </CardContent>
        ) : null}
      </Card>

      {rejected.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Rejected</CardTitle>
            <CardDescription>These people were turned down. You can still let them in.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <ul className="divide-y">
              {rejected.map((u) => (
                <MemberRow
                  key={u.id}
                  member={u}
                  meta={
                    <>
                      Signed up {formatDate(u.createdAt)} · rejected {formatDate(u.reviewedAt)}
                    </>
                  }
                  actions={
                    <ActionButton action={approveUser.bind(null, u.id)}>Approve</ActionButton>
                  }
                />
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}

export default function ApprovalsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-48 w-full rounded-2xl" />}>
      <ApprovalLists />
    </Suspense>
  );
}
