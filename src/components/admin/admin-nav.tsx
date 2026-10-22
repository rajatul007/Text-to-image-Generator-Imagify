"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, CreditCard, Flag, ScrollText, Settings, Sparkles, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Overview", icon: BarChart3 },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/generations", label: "Generations", icon: Sparkles },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/prompts", label: "Prompt templates", icon: BookOpen },
  { href: "/admin/reports", label: "Reports", icon: Flag },
  { href: "/admin/settings", label: "Configuration", icon: Settings },
  { href: "/admin/logs", label: "Logs & audit", icon: ScrollText },
];

export function AdminNav({ openReports }: { openReports: number }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto p-2 scrollbar-thin lg:flex-col lg:overflow-visible" aria-label="Admin">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm", active ? "bg-violet/14 text-text" : "text-muted hover:bg-panel-2 hover:text-text")}>
            <Icon className={cn("size-4", active && "text-violet")} /> {label}
            {href === "/admin/reports" && openReports > 0 && <span className="ml-auto rounded-full bg-danger px-1.5 text-[11px] font-semibold text-white">{openReports}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
