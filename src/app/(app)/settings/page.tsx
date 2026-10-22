import { requirePageUser } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { DataPanel, NotificationPrefs, PasswordPanel, SessionsPanel } from "@/components/account/settings-panels";
import { PageHeader } from "@/components/ui/misc";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requirePageUser("/settings");
  const [profile, sessions] = await Promise.all([
    db.profile.findUniqueOrThrow({ where: { userId: user.id } }),
    db.session.count({ where: { userId: user.id, expiresAt: { gt: new Date() } } }),
  ]);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Settings" description="Notifications, security and your data." />
      <NotificationPrefs
        initial={{
          emailGenerationComplete: profile.emailGenerationComplete,
          emailGenerationFailed: profile.emailGenerationFailed,
          emailLowCredits: profile.emailLowCredits,
          emailPayments: profile.emailPayments,
          emailProductUpdates: profile.emailProductUpdates,
          inAppNotifications: profile.inAppNotifications,
          defaultShowPrompt: profile.defaultShowPrompt,
          defaultShowCreator: profile.defaultShowCreator,
        }}
      />
      <PasswordPanel hasPassword={user.hasPassword} />
      <SessionsPanel count={sessions} />
      <DataPanel hasPassword={user.hasPassword} />
    </div>
  );
}
