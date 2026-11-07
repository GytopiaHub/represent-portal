import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function initials(name: string | null | undefined, email?: string | null) {
  const source = name?.trim() || email || "?";
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function UserAvatar({
  name,
  email,
  image,
  size,
}: {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  size?: "default" | "sm" | "lg";
}) {
  return (
    <Avatar size={size}>
      {image ? <AvatarImage src={image} alt="" referrerPolicy="no-referrer" /> : null}
      <AvatarFallback>{initials(name, email)}</AvatarFallback>
    </Avatar>
  );
}
