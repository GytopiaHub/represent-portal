import { Suspense } from "react";
import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Notifications } from "@/features/notifications/components/notification-banners";
import { OnboardingForm } from "@/features/account/components/onboarding-form";
import { ReconnectGoogleBanner } from "@/features/account/components/reconnect-google-banner";
import { getMyCalendars, getMyProfile } from "@/server/account/queries";
import { isMockGoogle } from "@/server/integrations";

export const metadata: Metadata = { title: "Set up your profile" };

async function OnboardingContent() {
  const [profile, calendars] = await Promise.all([getMyProfile(), getMyCalendars()]);
  const isReturning = profile.onboardedAt != null;

  return (
    <>
      <Notifications />
      <ReconnectGoogleBanner returnTo="/onboarding" />
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{isReturning ? "Your profile" : "Welcome to RepresENT"}</CardTitle>
          <CardDescription>
            {isReturning
              ? "Update your details and which calendars count toward your busy time."
              : "A couple of things before you start."}
            {isMockGoogle ? (
              <span className="mt-1 block text-amber-300">Demo mode: these calendars are simulated, not read from your Google account.</span>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OnboardingForm
            isReturning={isReturning}
            calendars={calendars}
            defaults={{
              name: profile.name ?? "",
              stageName: profile.stageName ?? "",
              instagramHandle: profile.instagramHandle ?? "",
              busyCalendarIds: profile.busyCalendarIds,
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}

export default function OnboardingPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 p-6">
      <Suspense fallback={<Skeleton className="h-150 w-full rounded-2xl" />}>
        <OnboardingContent />
      </Suspense>
    </main>
  );
}
