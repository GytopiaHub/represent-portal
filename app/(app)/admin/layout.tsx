import { AdminTabs } from "@/components/admin/admin-tabs";

// Access is enforced by proxy.ts and by requireAdmin() in every data function
// and action these pages use; this layout is presentation only.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Admin</h1>
        <AdminTabs />
      </div>
      {children}
    </div>
  );
}
