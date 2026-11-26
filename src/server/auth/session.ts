import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { roleForEmail, type Role } from "@/lib/roles";
import { auth } from "./auth";
import { roleLists } from "./role-lists";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: Role;
};

// Reads the request's cookies, so callers must sit behind <Suspense>
// (Cache Components). The role is looked up on every call, so someone
// removed from the lists counts as signed out straight away.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const data = await auth.api.getSession({ headers: await headers() });
  if (!data) return null;
  const role = roleForEmail(data.user.email, roleLists());
  if (!role) return null;
  const { id, name, email, image } = data.user;
  return { id, name, email, image: image ?? null, role };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
