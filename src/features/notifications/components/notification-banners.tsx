import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { markNotificationRead } from "@/server/notifications/actions";
import { getMyBannerNotifications } from "@/server/notifications/queries";

/** "You've been approved" banner on the next visit (FR-ADM-4). */
export async function Notifications() {
  const items = await getMyBannerNotifications();
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {items.map((n) => (
        <Alert key={n.id} className="border-primary/40">
          <AlertTitle>{n.payload.title}</AlertTitle>
          {n.payload.body ? <AlertDescription>{n.payload.body}</AlertDescription> : null}
          <AlertAction>
            <form action={markNotificationRead.bind(null, n.id)}>
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
