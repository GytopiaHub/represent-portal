import "server-only";
import type { RoleLists } from "@/lib/roles";

// Real emails can't be committed (SRS SEC-4), so the lists live in env vars.
export function roleLists(): RoleLists {
  return { admin: process.env.ADMIN_EMAILS, member: process.env.MEMBER_EMAILS };
}
