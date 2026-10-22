import { z } from "zod";
import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { consumeToken, markEmailVerified } from "@/lib/auth/accounts";
import { hashPassword, passwordSchema } from "@/lib/auth/password";
import { enforceRateLimit, RULES } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { templates } from "@/lib/email/templates";

export const POST = route({ auth: "none", csrf: true }, async ({ json, ip }) => {
  await enforceRateLimit(RULES.passwordReset, ip);
  const input = await json(z.object({ token: z.string().min(10).max(200), password: passwordSchema }));
  const record = await consumeToken(input.token, "PASSWORD_RESET");
  const passwordHash = await hashPassword(input.password);
  const user = await db.user.update({ where: { id: record.userId }, data: { passwordHash } });
  // Resetting via an emailed link also proves ownership of the address.
  if (!user.emailVerified) await markEmailVerified(user.id);
  await db.session.deleteMany({ where: { userId: user.id } });
  void sendEmail(user.email, "passwordChanged", templates.passwordChanged(user.name));
  return { ok: true, message: "Password updated. Please sign in with your new password." };
});
