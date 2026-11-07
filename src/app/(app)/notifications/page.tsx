import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  markAllNotificationsRead,
  markNotificationRead,
  openNotification,
} from "@/server/notifications/actions";
import { getViewer } from "@/server/auth-guards";
import { getMyNotifications } from "@/server/notifications/queries";
import { fmtDateTime, fmtRelative } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const [viewer, items] = await Promise.all([getViewer(), getMyNotifications()]);
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader
        title="Notifications"
        description={unread ? `${unread} unread` : "You're all caught up."}
        actions={
          unread ? (
            <form action={markAllNotificationsRead}>
              <Button type="submit" variant="outline">Mark all read</Button>
            </form>
          ) : null
        }
      />
      {items.length === 0 ? (
        <EmptyState title="No notifications yet" />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((n) => (
            <li key={n.id} className={cn("flex items-start gap-3 rounded-2xl border bg-card p-3", !n.readAt && "border-primary/40")}>
              <span aria-hidden className={cn("mt-2 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-primary")} />
              <form action={openNotification.bind(null, n.id)} className="min-w-0 flex-1">
                <button type="submit" className="w-full text-left">
                  <span className={cn("block", !n.readAt && "font-semibold")}>
                    {n.payload.title}
                    {!n.readAt ? <span className="sr-only"> (unread)</span> : null}
                  </span>
                  {n.payload.body ? <span className="block text-sm text-muted-foreground">{n.payload.body}</span> : null}
                  <span className="block text-xs text-muted-foreground" title={fmtDateTime(n.createdAt, viewer.tz)}>
                    {fmtRelative(n.createdAt)}
                  </span>
                </button>
              </form>
              {!n.readAt ? (
                <form action={markNotificationRead.bind(null, n.id)}>
                  <Button type="submit" size="xs" variant="ghost">Mark read</Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
