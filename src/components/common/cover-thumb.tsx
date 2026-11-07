import Image from "next/image";
import { hashString } from "@/lib/hash";
import { cn } from "@/lib/utils";

const GRADIENTS = [
  "from-pink-500/70 via-fuchsia-600/50 to-violet-700/60",
  "from-violet-500/70 via-indigo-600/50 to-cyan-600/60",
  "from-cyan-400/60 via-sky-600/50 to-violet-700/60",
  "from-rose-500/70 via-pink-600/50 to-amber-500/50",
  "from-fuchsia-500/70 via-purple-600/50 to-pink-500/60",
];

/**
 * YouTube thumbnail, or a gradient placeholder for seeded (mock) videos that
 * have no real thumbnail.
 */
export function CoverThumb({
  src,
  title,
  subtitle,
  className,
}: {
  src: string | null;
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative aspect-video overflow-hidden rounded-xl bg-muted", className)}>
      {src ? (
        <Image src={src} alt="" fill sizes="(max-width: 640px) 100vw, 320px" className="object-cover" />
      ) : (
        <div className={cn("absolute inset-0 bg-gradient-to-br", GRADIENTS[hashString(title) % GRADIENTS.length])}>
          <div className="absolute inset-0 flex flex-col justify-end p-3">
            {subtitle ? <span className="text-[11px] font-medium uppercase tracking-widest text-white/70">{subtitle}</span> : null}
            <span className="font-display line-clamp-2 text-lg font-bold leading-tight text-white drop-shadow">{title}</span>
          </div>
        </div>
      )}
    </div>
  );
}
