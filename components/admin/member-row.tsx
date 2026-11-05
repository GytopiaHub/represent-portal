import type { ReactNode } from "react";
import { UserAvatar } from "@/components/user-avatar";

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(d: Date | null | undefined) {
  return d ? dateFormat.format(d) : "—";
}

export function MemberRow({
  member,
  meta,
  badges,
  actions,
}: {
  member: { name: string | null; email: string | null; image: string | null };
  meta?: ReactNode;
  badges?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <UserAvatar name={member.name} email={member.email} image={member.image} size="lg" />
        <div className="min-w-0">
          <p className="flex items-center gap-2 truncate font-medium">
            {member.name ?? member.email}
            {badges}
          </p>
          <p className="truncate text-sm text-muted-foreground">{member.email}</p>
          {meta ? <p className="text-xs text-muted-foreground">{meta}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-start gap-2 sm:justify-end">{actions}</div> : null}
    </li>
  );
}
