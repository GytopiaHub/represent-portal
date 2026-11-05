import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/actions";

/** Centered card used by login, pending and not-approved screens. */
export function CenteredCard({ children }: { children: ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-md">{children}</Card>
    </main>
  );
}

export function StatusScreen({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <CenteredCard>
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {children ? <CardContent className="flex flex-col gap-4">{children}</CardContent> : null}
      <CardFooter className="flex gap-2">
        {actions}
        <form action={signOutAction} className="ml-auto">
          <Button type="submit" variant="ghost">
            Sign out
          </Button>
        </form>
      </CardFooter>
    </CenteredCard>
  );
}
