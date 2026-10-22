"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Bell, BookOpen, ChevronsLeft, ChevronsRight, Clock, Coins, Compass, CreditCard, Heart, Images, LayoutDashboard, LifeBuoy, LogOut, Menu as MenuIcon, PenTool, Settings, Shield, Sparkles, User, X,
} from "lucide-react";
import { Logo, LogoMark } from "../logo";
import { ThemeToggle } from "./theme-toggle";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "../ui/menu";
import { Tooltip } from "../ui/tooltip";
import { cn } from "@/lib/utils";
import { api } from "@/lib/client/api";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/generate", label: "Generate", icon: Sparkles },
  { href: "/prompt-library", label: "Prompt Library", icon: BookOpen },
  { href: "/creations", label: "My Creations", icon: Images },
  { href: "/history", label: "Generation History", icon: Clock },
  { href: "/favorites", label: "Favorites", icon: Heart },
  { href: "/editor", label: "Image Editor", icon: PenTool },
  { href: "/explore", label: "Public Explore", icon: Compass },
  { href: "/credits", label: "Credits & Pricing", icon: Coins },
  { href: "/transactions", label: "Transactions", icon: CreditCard },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/help", label: "Help & Support", icon: LifeBuoy },
];

export interface ShellUser {
  name: string;
  email: string;
  role: "USER" | "ADMIN";
  avatarUrl: string | null;
}

export function AppShell({ user, balance, unread, lowCredits, children }: { user: ShellUser; balance: number; unread: number; lowCredits: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
       
      setCollapsed(localStorage.getItem("pf_sidebar") === "collapsed");
    } catch {
      /* storage unavailable */
    }
  }, []);
   
  useEffect(() => setMobileOpen(false), [pathname]);

  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("pf_sidebar", c ? "expanded" : "collapsed");
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  };

  const nav = (compact: boolean) => (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3 scrollbar-thin" aria-label="Dashboard">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
        const link = (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors",
              active ? "bg-violet/14 text-text" : "text-muted hover:bg-panel-2 hover:text-text",
              compact && "justify-center px-0",
            )}
          >
            <Icon className={cn("size-[18px] shrink-0", active && "text-violet")} aria-hidden />
            {!compact && <span className="truncate">{label}</span>}
            {compact && <span className="sr-only">{label}</span>}
          </Link>
        );
        return compact ? (
          <Tooltip key={href} content={label} side="right">
            {link}
          </Tooltip>
        ) : (
          link
        );
      })}
      {user.role === "ADMIN" && (
        <Link href="/admin" className={cn("mt-3 flex items-center gap-3 rounded-lg border border-dashed border-line px-2.5 py-2 text-sm text-muted hover:text-text", compact && "justify-center px-0")}>
          <Shield className="size-[18px]" aria-hidden />
          {!compact ? "Admin console" : <span className="sr-only">Admin console</span>}
        </Link>
      )}
    </nav>
  );

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className={cn("sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-panel transition-[width] duration-200 lg:flex", collapsed ? "w-[68px]" : "w-60")}>
        <div className={cn("flex h-16 items-center border-b border-line px-4", collapsed && "justify-center px-0")}>{collapsed ? <Link href="/dashboard" aria-label="Dashboard"><LogoMark /></Link> : <Logo href="/dashboard" />}</div>
        {nav(collapsed)}
        <button onClick={toggle} className="m-2 flex items-center justify-center gap-2 rounded-lg py-2 text-xs text-faint hover:bg-panel-2 hover:text-text" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <ChevronsRight className="size-4" /> : <><ChevronsLeft className="size-4" /> Collapse</>}
        </button>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-line bg-panel">
            <div className="flex h-16 items-center justify-between border-b border-line px-4">
              <Logo href="/dashboard" />
              <button onClick={() => setMobileOpen(false)} className="rounded-lg p-2 text-muted" aria-label="Close menu">
                <X className="size-5" />
              </button>
            </div>
            {nav(false)}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-line px-3 sm:px-5">
          <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-muted hover:text-text lg:hidden" aria-label="Open menu">
            <MenuIcon className="size-5" />
          </button>
          <div className="flex-1" />
          <Link
            href="/credits"
            className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm tabular-nums", lowCredits ? "border-warn/50 text-warn" : "border-line text-text hover:border-violet/50")}
            title={lowCredits ? "Low credit balance – top up" : "Your credit balance"}
          >
            <Coins className="size-4" aria-hidden />
            <span>
              {balance.toLocaleString("en-IN")} <span className="sr-only sm:not-sr-only">credits</span>
            </span>
          </Link>
          <Link href="/notifications" className="relative grid size-9 place-items-center rounded-lg text-muted hover:bg-panel-2 hover:text-text" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
            <Bell className="size-[18px]" />
            {unread > 0 && <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-violet px-1 text-[10px] font-semibold leading-4 text-on-accent">{unread > 9 ? "9+" : unread}</span>}
          </Link>
          <ThemeToggle />
          <Menu>
            <MenuTrigger className="flex items-center gap-2 rounded-full p-0.5 hover:ring-2 hover:ring-line" aria-label="Account menu">
              <Avatar name={user.name} url={user.avatarUrl} />
            </MenuTrigger>
            <MenuContent>
              <MenuLabel>
                <span className="block text-sm text-text">{user.name}</span>
                <span className="block truncate">{user.email}</span>
              </MenuLabel>
              <MenuSeparator />
              <MenuItem onSelect={() => router.push("/profile")}>
                <User className="size-4" /> Profile
              </MenuItem>
              <MenuItem onSelect={() => router.push("/settings")}>
                <Settings className="size-4" /> Settings
              </MenuItem>
              {user.role === "ADMIN" && (
                <MenuItem onSelect={() => router.push("/admin")}>
                  <Shield className="size-4" /> Admin console
                </MenuItem>
              )}
              <MenuSeparator />
              <MenuItem onSelect={logout}>
                <LogOut className="size-4" /> Log out
              </MenuItem>
            </MenuContent>
          </Menu>
        </header>
        <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export function Avatar({ name, url, size = 32 }: { name: string; url: string | null; size?: number }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="spectrum grid place-items-center rounded-full text-xs font-semibold text-on-accent" style={{ width: size, height: size }} aria-hidden>
      {initials || "?"}
    </span>
  );
}
