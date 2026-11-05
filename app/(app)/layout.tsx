import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { Notifications } from "@/components/notifications";
import { ReconnectGoogleBanner } from "@/components/reconnect-google-banner";

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
