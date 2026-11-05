import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { reconnectGoogle } from "@/lib/actions/account";
import { getMyGoogleTokenError } from "@/lib/queries/me";

/**
 * Shown when the stored refresh token is missing or revoked (FR-AUTH-4).
 * Reconnecting re-runs Google sign-in with consent.
 */
export async function ReconnectGoogleBanner({ returnTo = "/" }: { returnTo?: string }) {
  const error = await getMyGoogleTokenError();
  if (!error) return null;

  return (
    <Alert variant="destructive" className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex-1">
        <AlertTitle>Reconnect Google Calendar</AlertTitle>
        <AlertDescription>
          We lost access to your Google Calendar, so your availability shows as &ldquo;unknown&rdquo; to the
          crew. Reconnect to fix it.
        </AlertDescription>
      </div>
      <form action={reconnectGoogle}>
        <input type="hidden" name="returnTo" value={returnTo} />
        <Button type="submit" variant="outline">
          Reconnect
        </Button>
      </form>
    </Alert>
  );
}
