import Image from "next/image";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/server/auth/session";
import { SignInButton } from "./auth-buttons";

const ERRORS: Record<string, string> = {
  not_on_list: "This Google account isn't on the crew list. Ask a crew leader to add you.",
};
const FALLBACK_ERROR = "Sign-in didn't work. Try again.";

export async function LoginCard({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  if (await getCurrentUser()) redirect("/profile");
  const raw = (await searchParams).error;
  const code = Array.isArray(raw) ? raw[0] : raw;
  const error = code ? (ERRORS[code] ?? FALLBACK_ERROR) : null;

  return (
    <Card className="w-full max-w-sm items-center gap-4 px-6 text-center">
      <Image src="/logo.svg" alt="" width={56} height={56} />
      <h1 className="text-xl font-bold tracking-tight">Sign in to RepresENT</h1>
      <p className="text-muted-foreground">Use the Google account your crew leader added.</p>
      {error && (
        <div role="alert" className="w-full rounded-xl border border-destructive px-3 py-2 text-left">
          <span className="font-semibold text-destructive">Can&apos;t sign in.</span> {error}
        </div>
      )}
      <SignInButton />
    </Card>
  );
}
