import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-8 shrink-0", className)} aria-hidden>
      <defs>
        <linearGradient id="tti-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--violet)" />
          <stop offset="1" stopColor="var(--blue)" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="var(--panel-2)" />
      {/* "T" for text, resting on an image frame */}
      <path d="M17 15h30v8H36v26h-8V23H17z" fill="url(#tti-logo)" />
      <circle cx="47" cy="46" r="4" fill="var(--blue)" />
    </svg>
  );
}

export function Logo({ href = "/", compact }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 rounded-lg" aria-label="Text to Image Generator home">
      <LogoMark />
      {!compact && <span className="font-display max-w-[9.5rem] text-[15px] font-semibold leading-[1.1] tracking-tight">Text to Image Generator</span>}
    </Link>
  );
}
