import { Card } from "@/components/ui/card";
import { getGroups } from "@/server/groups/queries";
import { GroupBrowser } from "./group-browser";

export async function Groups() {
  const data = await getGroups();
  if (!data.ok) {
    return (
      <Card className="px-6" role="alert">
        <p className="font-medium">Groups are unavailable</p>
        <p className="text-sm text-muted-foreground">{data.message}</p>
      </Card>
    );
  }
  if (data.groups.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No groups have been added yet.</p>;
  }
  return <GroupBrowser groups={data.groups} />;
}
