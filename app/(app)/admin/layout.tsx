import { NavLink } from "@/components/nav-link";

// Access is enforced by proxy.ts and by requireAdmin() in every data function
// and action these pages use; this layout is presentation only.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <nav className="flex gap-1">
          <NavLink href="/admin" exact>
            Approvals
          </NavLink>
          <NavLink href="/admin/members">Members</NavLink>
        </nav>
      </div>
      {children}
    </div>
  );
}
