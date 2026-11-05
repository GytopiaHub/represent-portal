import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StatusScreen } from "@/components/status-screen";
import { requireUser } from "@/lib/dal";
import { homePathFor } from "@/lib/access";

export const metadata: Metadata = { title: "Not approved" };

// Renders nothing; just bounces the user if their status has changed.
async function StatusGuard() {
  const user = await requireUser();
  if (user.status !== "rejected") redirect(homePathFor(user));
  return null;
}

export default function NotApprovedPage() {
  return (
    <StatusScreen
      title="Not approved"
      description="Your request to join Represent wasn't approved. If you think this is a mistake, reach out to one of the admins — they can approve you later."
    >
      <Suspense>
        <StatusGuard />
      </Suspense>
    </StatusScreen>
  );
}
