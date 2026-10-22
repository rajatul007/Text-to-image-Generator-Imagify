import { requirePageUser } from "@/lib/auth/current";
import { NotificationList } from "@/components/account/notification-list";
import { PageHeader } from "@/components/ui/misc";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  await requirePageUser("/notifications");
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Notifications" />
      <NotificationList />
    </div>
  );
}
