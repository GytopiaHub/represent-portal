"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/actions/result";

/** Runs a bound Server Action on click and shows its error inline. */
export function ActionButton({
  action,
  children,
  variant = "outline",
  size = "sm",
  confirm,
  className,
  "aria-label": ariaLabel,
}: {
  action: () => Promise<ActionResult<unknown> | void>;
  children: React.ReactNode;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  confirm?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        size={size}
        variant={variant}
        disabled={pending}
        className={className}
        aria-label={ariaLabel}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          setError(null);
          startTransition(async () => {
            const result = await action();
            if (result && !result.ok) setError(result.error);
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
