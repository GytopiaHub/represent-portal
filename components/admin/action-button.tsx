"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/actions";

/**
 * Runs a bound admin Server Action and shows its error (e.g. the last-admin
 * rule) inline.
 */
export function ActionButton({
  action,
  children,
  variant = "outline",
  confirm,
}: {
  action: () => Promise<ActionResult>;
  children: React.ReactNode;
  variant?: React.ComponentProps<typeof Button>["variant"];
  confirm?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant={variant}
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          setError(null);
          startTransition(async () => {
            const result = await action();
            if (!result.ok) setError(result.error);
          });
        }}
      >
        {children}
      </Button>
      {error ? (
        <span role="alert" className="max-w-56 text-right text-xs text-destructive">
          {error}
        </span>
      ) : null}
    </span>
  );
}
