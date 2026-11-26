export const ROLES = ["admin", "member"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  member: "Member",
};

export type RoleLists = { admin?: string; member?: string };

function parseList(list: string | undefined): Set<string> {
  return new Set(
    (list ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

// Returns null for anyone on neither list, which means they may not sign in.
// Admin wins when an email is on both lists.
export function roleForEmail(email: string | null | undefined, lists: RoleLists): Role | null {
  if (!email) return null;
  const e = email.trim().toLowerCase();
  if (parseList(lists.admin).has(e)) return "admin";
  if (parseList(lists.member).has(e)) return "member";
  return null;
}
