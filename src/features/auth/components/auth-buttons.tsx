"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "../auth-client";

export function SignInButton() {
  const [pending, setPending] = useState(false);
  return (
    <Button
      className="h-11 w-full"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        // On success the browser leaves for Google, so only a failure lands here.
        const { error } = await authClient.signIn.social({
          provider: "google",
          callbackURL: "/profile",
          errorCallbackURL: "/login",
        });
        if (error) setPending(false);
      }}
    >
      <GoogleMark />
      {pending ? "Opening Google..." : "Sign in with Google"}
    </Button>
  );
}

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="outline"
      className="h-11"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await authClient.signOut();
        router.replace("/login");
        router.refresh();
      }}
    >
      {pending ? "Signing out..." : "Sign out"}
    </Button>
  );
}

function GoogleMark() {
  return (
    <span
      aria-hidden="true"
      className="flex size-4.5 items-center justify-center rounded-full border-2 border-current text-[10px] font-bold"
    >
      G
    </span>
  );
}
