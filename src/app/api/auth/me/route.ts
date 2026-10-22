import { route } from "@/lib/api";
import { getBalance } from "@/lib/credits/ledger";
import { db } from "@/lib/db";

export const GET = route({ auth: "optional" }, async ({ user }) => {
  if (!user) return { user: null };
  const [balance, unread] = await Promise.all([getBalance(user.id), db.notification.count({ where: { userId: user.id, readAt: null } })]);
  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role, emailVerified: Boolean(user.emailVerified), username: user.username, hasPassword: user.hasPassword },
    balance,
    unreadNotifications: unread,
  };
});
