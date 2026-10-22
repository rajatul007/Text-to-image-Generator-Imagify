import Link from "next/link";
import type { PublicImage } from "@/lib/images/access";
import { cn } from "@/lib/utils";
import { Heart } from "lucide-react";

/** Masonry grid for public images. Uses thumbnails served through the access-controlled image route. */
export function PublicImageGrid({ images, className }: { images: PublicImage[]; className?: string }) {
  return (
    <ul className={cn("columns-2 gap-3 sm:columns-3 lg:columns-4 [&>li]:mb-3", className)}>
      {images.map((img) => (
        <li key={img.id} className="break-inside-avoid">
          <Link href={`/image/${img.id}`} className="group relative block overflow-hidden rounded-xl border border-line bg-panel-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- access-controlled API route, not a static asset */}
            <img src={img.thumbUrl} alt={img.prompt ? img.prompt.slice(0, 120) : "Community artwork"} width={img.width} height={img.height} loading="lazy" className="h-auto w-full transition-transform duration-500 group-hover:scale-[1.03]" style={{ aspectRatio: `${img.width}/${img.height}` }} />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              <p className="line-clamp-2 text-xs text-white/90">{img.prompt ?? "Prompt hidden by creator"}</p>
              <span className="flex shrink-0 items-center gap-1 text-xs text-white/90">
                <Heart className="size-3.5" /> {img.likeCount}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
