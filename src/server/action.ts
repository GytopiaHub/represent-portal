import "server-only";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { ForbiddenError } from "@/server/auth-guards";

// Shared plumbing for Server Actions (not itself a "use server" module).

/** An error whose message is safe to show the user. */
export class UserError extends Error {}

/**
 * Runs an action body. UserError/ForbiddenError become `{ ok: false }`;
 * anything else (including redirect()) is rethrown.
 */
export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (err) {
    if (err instanceof UserError || err instanceof ForbiddenError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }
}

/** Validate with Zod; the first issue becomes a UserError. */
export function parse<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue.path.join(".");
    throw new UserError(field ? `${field}: ${issue.message}` : issue.message);
  }
  return result.data;
}

/** FormData → plain object (repeated keys become arrays). */
export function formObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of new Set(formData.keys())) {
    if (key.startsWith("$ACTION")) continue;
    const all = formData.getAll(key);
    out[key] = all.length > 1 ? all : all[0];
  }
  return out;
}

// Common field schemas
export const zId = z.string().uuid();
export const zUserId = z.string().min(1).max(100);
export const zOptText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));
export const zOptUrl = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null))
  .pipe(z.string().url().nullable());
