"use server";

import { eq, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { db, memberCalendars, users } from "@/db";
import { safeCallbackUrl } from "@/lib/access";
import type { ActionResult } from "@/lib/action-result";
import { formObject, run } from "@/server/action";
import { requireActiveUser } from "@/server/auth-guards";
import { listCalendars, revokeGoogle } from "@/server/google";
import { isMockGoogle } from "@/server/integrations";

// ---------------------------------------------------------------------------
// Sign in / out
// ---------------------------------------------------------------------------

export async function signInWithGoogle(formData: FormData) {
  await signIn("google", { redirectTo: safeCallbackUrl(formData.get("callbackUrl")) });
}

/** FR-AUTH-4: re-run Google sign-in with consent to get a fresh refresh token. */
export async function reconnectGoogle(formData: FormData) {
  await requireActiveUser();
  await signIn("google", { redirectTo: safeCallbackUrl(formData.get("returnTo")) });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

// ---------------------------------------------------------------------------
// Onboarding / profile (FR-AUTH-5)
// ---------------------------------------------------------------------------

export type OnboardingState = { error?: string; fieldErrors?: Record<string, string> };

const profileSchema = z.object({
  name: z.string().trim().min(1, "Display name is required.").max(80, "Keep it under 80 characters."),
  stageName: z.string().trim().max(80, "Keep it under 80 characters.").optional().default(""),
  instagramHandle: z
    .string()
    .trim()
    .transform((v) => v.replace(/^@/, ""))
    .pipe(z.string().regex(/^[A-Za-z0-9._]{0,30}$/, "Letters, numbers, dots and underscores only (max 30)."))
    .optional()
    .default(""),
  calendarIds: z.union([z.string(), z.array(z.string())]).optional().transform((v) => (v == null ? [] : Array.isArray(v) ? v : [v])),
});

export async function completeOnboarding(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const me = await requireActiveUser();

  const parsed = profileSchema.safeParse(formObject(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { fieldErrors };
  }
  const { name, stageName, instagramHandle, calendarIds } = parsed.data;

  // Only accept calendar ids that belong to this user's Google account.
  const calendars = (await listCalendars(me.id)) ?? [];
  const chosen = calendars.filter((c) => calendarIds.includes(c.id));

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        name,
        stageName: stageName || null,
        instagramHandle: instagramHandle || null,
        onboardedAt: sql`coalesce(${users.onboardedAt}, now())`,
      })
      .where(eq(users.id, me.id));
    await tx.delete(memberCalendars).where(eq(memberCalendars.userId, me.id));
    if (chosen.length > 0) {
      await tx.insert(memberCalendars).values(
        chosen.map((c) => ({ userId: me.id, googleCalendarId: c.id, summary: c.summary, includeInBusy: true })),
      );
    }
  });

  redirect("/");
}

/**
 * SEC-5: disconnect Google Calendar. Revokes the token with Google (live
 * mode), clears token columns and calendar selections, so calendar writes stop.
 */
export async function disconnectGoogle(): Promise<ActionResult> {
  return run(async () => {
    const me = await requireActiveUser();
    if (!isMockGoogle) await revokeGoogle(me.id);
    await db.delete(memberCalendars).where(eq(memberCalendars.userId, me.id));
    refresh();
  });
}
