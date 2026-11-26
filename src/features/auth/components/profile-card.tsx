import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ROLE_LABELS } from "@/lib/roles";
import { requireUser } from "@/server/auth/session";
import { SignOutButton } from "./auth-buttons";

export async function ProfileCard() {
  const user = await requireUser();
  return (
    <Card className="w-full max-w-sm items-center gap-3 px-6 text-center">
      {user.image ? (
        // Google profile photos load straight from Google, so skip the optimizer.
        <Image
          src={user.image}
          alt=""
          width={80}
          height={80}
          unoptimized
          referrerPolicy="no-referrer"
          className="size-20 rounded-full bg-muted object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex size-20 items-center justify-center rounded-full bg-muted text-2xl font-semibold text-muted-foreground"
        >
          {user.name.charAt(0).toUpperCase() || "?"}
        </div>
      )}
      <h1 className="text-xl font-bold tracking-tight">{user.name}</h1>
      <p className="break-all text-muted-foreground">{user.email}</p>
      <Badge variant="outline" aria-label={`Role: ${ROLE_LABELS[user.role]}`}>
        {ROLE_LABELS[user.role]}
      </Badge>
      <div className="mt-2">
        <SignOutButton />
      </div>
    </Card>
  );
}
