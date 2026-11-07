import {
  Album02Icon,
  Calendar03Icon,
  DashboardSquare01Icon,
  MusicNote03Icon,
  Settings02Icon,
  Shield01Icon,
  StarIcon,
  UserAdd01Icon,
  UserGroupIcon,
  UserMultipleIcon,
  Video01Icon,
} from "@hugeicons/core-free-icons";

export const MAIN_NAV = [
  { href: "/", label: "Dashboard", icon: DashboardSquare01Icon, exact: true },
  { href: "/catalogue", label: "Catalogue", icon: Album02Icon },
  { href: "/songs", label: "Songs", icon: MusicNote03Icon },
  { href: "/my-songs", label: "My songs", icon: StarIcon },
  { href: "/availability", label: "Availability", icon: Calendar03Icon },
  { href: "/groups", label: "Idol groups", icon: UserGroupIcon },
  { href: "/guests", label: "Guests", icon: UserMultipleIcon },
];

export const ADMIN_NAV = [
  { href: "/admin/approvals", label: "Approvals", icon: UserAdd01Icon, badge: true },
  { href: "/admin/members", label: "Members", icon: Shield01Icon },
  { href: "/admin/groups", label: "Groups & rosters", icon: UserGroupIcon },
  { href: "/admin/backfill", label: "Backfill queue", icon: Video01Icon },
  { href: "/admin/settings", label: "Settings", icon: Settings02Icon },
];

/** Bottom tab bar on mobile (NFR-1). */
export const MOBILE_TABS = [
  { href: "/", label: "Home", icon: DashboardSquare01Icon, exact: true },
  { href: "/catalogue", label: "Catalogue", icon: Album02Icon },
  { href: "/songs", label: "Songs", icon: MusicNote03Icon },
  { href: "/availability", label: "Avails", icon: Calendar03Icon },
  { href: "/my-songs", label: "Mine", icon: StarIcon },
];
