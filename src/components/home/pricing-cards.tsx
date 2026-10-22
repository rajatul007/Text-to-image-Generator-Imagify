import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "../ui/button";
import { cn, formatInr } from "@/lib/utils";

export interface PackageCard {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  credits: number;
  pricePaise: number;
  highlight: boolean;
}

export function PricingCards({ packages, ctaHref = (slug: string) => `/credits?package=${slug}` }: { packages: PackageCard[]; ctaHref?: (slug: string) => string }) {
  const base = packages.length ? Math.max(...packages.map((p) => p.pricePaise / p.credits)) : 0;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {packages.map((p) => {
        const perCredit = p.pricePaise / p.credits;
        const saving = base > 0 ? Math.round((1 - perCredit / base) * 100) : 0;
        return (
          <div key={p.id} className={cn("relative flex flex-col rounded-[var(--radius-panel)] border bg-panel p-5", p.highlight ? "border-violet/70 shadow-[0_0_0_1px_var(--violet)]" : "border-line")}>
            {p.highlight && <span className="spectrum absolute -top-3 left-5 rounded-full px-2.5 py-0.5 text-xs font-medium text-on-accent">Most popular</span>}
            <h3 className="font-display text-lg font-semibold">{p.name}</h3>
            {p.description && <p className="text-sm text-muted">{p.description}</p>}
            <div className="mt-4 flex items-baseline gap-1">
              <span className="font-display text-3xl font-semibold">{formatInr(p.pricePaise)}</span>
              <span className="text-sm text-muted">one-time</span>
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              <li className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-ok" /> {p.credits.toLocaleString("en-IN")} credits
              </li>
              <li className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-ok" /> {formatInr(Math.round(perCredit))} per credit{saving > 0 ? ` · save ${saving}%` : ""}
              </li>
              <li className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-ok" /> Credits never expire
              </li>
            </ul>
            <Button asChild variant={p.highlight ? "primary" : "secondary"} className="mt-6">
              <Link href={ctaHref(p.slug)}>Buy {p.name}</Link>
            </Button>
          </div>
        );
      })}
    </div>
  );
}
