import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { Notifications } from "@/components/notifications";
import { ReconnectGoogleBanner } from "@/components/reconnect-google-banner";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-4 sm:p-6">
        <Suspense>
          <ReconnectGoogleBanner />
          <Notifications />
        </Suspense>
        {children}
      </main>
    </>
  );
}
