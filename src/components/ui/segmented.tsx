"use client";

import { cn } from "@/lib/utils";

export function Segmented<T extends string>({ value, onChange, options, label, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string; className?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-xl border border-line bg-panel-2 p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn("rounded-[10px] px-3 py-1.5 text-sm transition-colors", value === o.value ? "bg-panel text-text shadow-sm" : "text-muted hover:text-text")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
