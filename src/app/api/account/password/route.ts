import { z } from "zod";
import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { hashPassword, passwordSchema, verifyPassword } from "@/lib/auth/password";
import { destroyOtherSessions } from "@/lib/auth/session";
import { enforceRateLimit, RULES } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { templates } from "@/lib/email/templates";

export const POST = route({}, async ({ user, json }) => {
  await enforceRateLimit(RULES.loginEmail, `pwchange:${user.id}`);
  const input = await json(z.object({ currentPassword: z.string().max(200).optional(), newPassword: passwordSchema }));
  const record = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (record.passwordHash) {
    if (!input.currentPassword || !(await verifyPassword(input.currentPassword, record.passwordHash))) {
      throw new AppError("VALIDATION", "Your current password is incorrect");
    }
  }
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(input.newPassword) } });
  await destroyOtherSessions(user.id, user.sessionId);
  void sendEmail(user.email, "passwordChanged", templates.passwordChanged(user.name));
  return { ok: true, message: "Password updated. Other devices have been signed out." };
});
