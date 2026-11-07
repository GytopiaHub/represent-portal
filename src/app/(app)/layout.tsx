import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Notifications } from "@/features/notifications/components/notification-banners";
import { ReconnectGoogleBanner } from "@/features/account/components/reconnect-google-banner";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AppShell
      banners={
        <Suspense>
          <ReconnectGoogleBanner />
          <Notifications />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}
