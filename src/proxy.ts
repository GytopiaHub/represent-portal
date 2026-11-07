import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  LOGIN_PATH,
  NOT_APPROVED_PATH,
  ONBOARDING_PATH,
  PENDING_PATH,
  gatePathFor,
  homePathFor,
} from "@/lib/access";

// First line of defence (R-ROLE-1). Every data-access function and Server
// Action re-checks the session itself (src/server/auth-guards.ts), so this is not the only
// guard — it just keeps people on the right screen.
export const proxy = auth((req) => {
  const { pathname, search } = req.nextUrl;
  const user = req.auth?.user;
  const redirect = (path: string) => NextResponse.redirect(new URL(path, req.nextUrl));

  // Signed out (or removed): only the login page.
  if (!user || user.status === "removed") {
    if (pathname === LOGIN_PATH) return NextResponse.next();
    const url = new URL(LOGIN_PATH, req.nextUrl);
    if (pathname !== "/") url.searchParams.set("callbackUrl", pathname + search);
    return NextResponse.redirect(url);
  }

  // Pending / rejected: only their status screen.
  const gate = gatePathFor(user);
  if (gate) return pathname === gate ? NextResponse.next() : redirect(gate);

  // Active from here on.
  if (pathname === LOGIN_PATH || pathname === PENDING_PATH || pathname === NOT_APPROVED_PATH) {
    return redirect(homePathFor(user));
  }
  if (!user.onboarded && pathname !== ONBOARDING_PATH) {
    return redirect(ONBOARDING_PATH);
  }
  if (pathname.startsWith("/admin") && user.role !== "admin") {
    return redirect("/");
  }
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Everything except API routes (they return 401/403 themselves, and
    // /api/cron uses a bearer token), Next internals and static files.
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
