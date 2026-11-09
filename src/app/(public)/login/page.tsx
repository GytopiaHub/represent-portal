import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CenteredCard } from "@/components/layout/status-screen";
import { GoogleSignInButton } from "@/features/account/components/google-sign-in-button";
import { signInWithGoogle } from "@/server/account/actions";
import { EXPLORE_PATH, safeCallbackUrl } from "@/lib/access";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, { title: string; body: string }> = {
  removed: {
    title: "Access removed",
    body: "Your account has been removed from RepresENT. Contact an admin if you think this is a mistake.",
  },
  AccessDenied: {
    title: "Sign-in blocked",
    body: "You don't have access to RepresENT. Contact an admin if you think this is a mistake.",
  },
  Configuration: {
    title: "Sign-in is misconfigured",
    body: "The server's Google sign-in settings are incomplete. Let an admin know.",
  },
};
const FALLBACK_ERROR = {
  title: "Couldn't sign you in",
  body: "Something went wrong talking to Google. Please try again.",
};

async function SignInForm({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;
  const callbackUrl = safeCallbackUrl(params.callbackUrl);
  const message = error ? (ERRORS[error] ?? FALLBACK_ERROR) : null;

  return (
    <>
      {message ? (
        <Alert variant="destructive">
          <AlertTitle>{message.title}</AlertTitle>
          <AlertDescription>{message.body}</AlertDescription>
        </Alert>
      ) : null}
      <form action={signInWithGoogle}>
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <GoogleSignInButton />
      </form>
    </>
  );
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <CenteredCard>
      <CardHeader>
        <CardTitle className="text-2xl">RepresENT</CardTitle>
        <CardDescription>Sign in with your Google account to continue.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Suspense fallback={<GoogleSignInButtonStatic />}>
          <SignInForm searchParams={props.searchParams} />
        </Suspense>
        <p className="text-center text-sm text-muted-foreground">
          Not a member?{" "}
          <Link href={EXPLORE_PATH} className="font-medium text-primary hover:underline">
            Browse our covers
          </Link>
        </p>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-xs text-muted-foreground">
        <p>
          RepresENT asks for access to your Google Calendar so it can find times when the crew is free
          and add rehearsals to your calendar.
        </p>
        <p>
          Google may warn that the app &ldquo;hasn&rsquo;t been verified&rdquo;. That&rsquo;s expected for a
          small community app — choose <strong>Advanced</strong>, then <strong>Go to RepresENT</strong>.
        </p>
      </CardFooter>
    </CenteredCard>
  );
}

function GoogleSignInButtonStatic() {
  return <div className="h-10 w-full rounded-4xl border bg-input/30" />;
}
