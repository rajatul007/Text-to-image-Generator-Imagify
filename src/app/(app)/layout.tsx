import { AppShell } from "@/components/layout/app-shell";
import { AnnouncementBanner, VerifyBanner } from "@/components/layout/banners";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { currentUser } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { getBalance } from "@/lib/credits/ledger";
import { getSettings } from "@/lib/settings";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  // Pages that are also public (e.g. the prompt library) render inside the marketing shell for visitors.
  // Every private page calls requirePageUser() itself.
  if (!user)
    return (
      <>
        <SiteHeader signedIn={false} />
        <main id="main" className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          {children}
        </main>
        <SiteFooter />
      </>
    );
  const now = new Date();
  const [balance, unread, settings, announcements] = await Promise.all([
    getBalance(user.id),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    getSettings(),
    db.announcement.findMany({ where: { active: true, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] }, orderBy: { createdAt: "desc" }, take: 2 }),
  ]);
  return (
    <AppShell
      user={{ name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarKey ? `/api/avatar/${user.id}` : null }}
      balance={balance}
      unread={unread}
      lowCredits={balance < settings.lowCreditThreshold}
    >
      {announcements.map((a) => (
        <AnnouncementBanner key={a.id} id={a.id} title={a.title} body={a.body} level={a.level} />
      ))}
      {!user.emailVerified && <VerifyBanner email={user.email} welcomeCredits={settings.welcomeCredits} />}
      {children}
    </AppShell>
  );
}
