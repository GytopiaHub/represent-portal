"use client";

import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/common/user-avatar";
import { ADMIN_NAV } from "@/components/layout/nav-items";
import { signOutAction } from "@/server/account/actions";

export function UserMenu({
  user,
  isAdmin,
}: {
  user: { id: string; name?: string | null; email?: string | null; image?: string | null };
  isAdmin: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex size-11 items-center justify-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        aria-label="Account menu"
      >
        <UserAvatar name={user.name} email={user.email} image={user.image} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col">
            <span className="truncate font-medium text-foreground">{user.name}</span>
            <span className="truncate text-xs font-normal">{user.email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href={`/members/${user.id}`} />}>My profile</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/onboarding" />}>Profile &amp; calendars</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/notifications" />}>Notifications</DropdownMenuItem>
        {/* Secondary nav for mobile, where the sidebar is hidden */}
        <div className="lg:hidden">
          <DropdownMenuItem render={<Link href="/groups" />}>Idol groups</DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/guests" />}>Guests</DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/songs/new" />}>Start a song crew</DropdownMenuItem>
          {isAdmin ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Admin</DropdownMenuLabel>
                {ADMIN_NAV.map((i) => (
                  <DropdownMenuItem key={i.href} render={<Link href={i.href} />}>
                    {i.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </>
          ) : null}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => signOutAction()}>
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
