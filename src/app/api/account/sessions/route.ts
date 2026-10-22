import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { destroyOtherSessions } from "@/lib/auth/session";

export const GET = route({}, async ({ user }) => {
  const sessions = await db.session.findMany({ where: { userId: user.id, expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: "desc" }, select: { id: true, ip: true, userAgent: true, createdAt: true, lastSeenAt: true } });
  return { sessions: sessions.map((s) => ({ ...s, current: s.id === user.sessionId })) };
});

/** Signs out every other device. */
export const DELETE = route({}, async ({ user }) => {
  await destroyOtherSessions(user.id, user.sessionId);
  return { ok: true };
});
