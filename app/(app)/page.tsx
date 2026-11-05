import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyProfile } from "@/lib/data";

async function Welcome() {
  const me = await getMyProfile();
  const name = me.stageName || me.name || "there";
  return <h1 className="text-2xl font-semibold tracking-tight">Hey {name} 👋</h1>;
}

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-2">
      <Suspense fallback={<Skeleton className="h-8 w-48" />}>
        <Welcome />
      </Suspense>
      <p className="text-muted-foreground">
        The catalogue, your history and song crews will show up here.
      </p>
    </div>
  );
}
