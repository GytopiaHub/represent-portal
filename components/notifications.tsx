import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { dismissNotification } from "@/lib/actions";
import { getMyUnreadNotifications } from "@/lib/data";

const TITLES: Record<string, string> = {
  approved: "You're in",
};

/** Unread in-app notifications, e.g. "You've been approved" (FR-ADM-4). */
export async function Notifications() {
  const items = await getMyUnreadNotifications();
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {items.map((n) => (
        <Alert key={n.id}>
          <AlertTitle>{TITLES[n.kind] ?? "Notification"}</AlertTitle>
          <AlertDescription>{n.message}</AlertDescription>
          <AlertAction>
            <form action={dismissNotification.bind(null, n.id)}>
              <Button type="submit" size="xs" variant="ghost">
                Dismiss
              </Button>
            </form>
          </AlertAction>
        </Alert>
      ))}
    </div>
  );
}
