"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/actions/result";
import { cn } from "@/lib/utils";

type Props = {
  action: (formData: FormData) => Promise<ActionResult<unknown> | void>;
  children: ReactNode;
  className?: string;
  /** Clear the inputs after a successful submit. */
  resetOnSuccess?: boolean;
  successMessage?: string;
  onSuccess?: () => void;
};

/**
 * A form wired to a Server Action that returns ActionResult. Shows the error
 * inline and disables inputs while pending.
 */
export function ActionForm({ action, children, className, resetOnSuccess, successMessage, onSuccess }: Props) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState<{ result: ActionResult<unknown> | null; n: number }, FormData>(
    async (prev, fd) => ({ result: (await action(fd)) ?? { ok: true }, n: prev.n + 1 }),
    { result: null, n: 0 },
  );

  useEffect(() => {
    if (state.result?.ok) {
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.n]);

  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      {state.result && !state.result.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {state.result.error}
        </p>
      ) : null}
      {state.result?.ok && successMessage ? (
        <p role="status" className="text-sm text-emerald-400">
          {successMessage}
        </p>
      ) : null}
    </form>
  );
}

export function SubmitButton({
  children,
  pendingLabel,
  className,
  variant,
  size,
}: {
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant={variant} size={size} className={cn(className)}>
      {pending ? (pendingLabel ?? "Saving…") : children}
    </Button>
  );
}
