import Link from "next/link";
import { requirePageAdmin } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { AdminNav } from "@/components/admin/admin-nav";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export const metadata = { title: { default: "Admin", template: "%s · Admin · Text to Image Generator" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requirePageAdmin();
  const openReports = await db.contentReport.count({ where: { status: "OPEN" } });
  return (
    <div className="min-h-dvh lg:flex">
      <aside className="border-b border-line bg-panel lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex h-16 items-center justify-between border-b border-line px-4">
          <Logo href="/admin" />
          <span className="rounded-md bg-danger/15 px-1.5 py-0.5 text-[11px] font-semibold text-danger">Admin</span>
        </div>
        <AdminNav openReports={openReports} />
        <div className="hidden p-3 text-xs text-faint lg:block">
          Signed in as {admin.email}
          <br />
          <Link href="/dashboard" className="text-violet hover:underline">
            Back to app
          </Link>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex h-14 items-center justify-end gap-2 border-b border-line px-4 lg:px-8">
          <Link href="/dashboard" className="text-sm text-muted hover:text-text lg:hidden">
            Back to app
          </Link>
          <ThemeToggle />
        </header>
        <main id="main" className="px-4 py-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
