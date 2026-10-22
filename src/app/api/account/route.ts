import { z } from "zod";
import { cookies } from "next/headers";
import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { verifyPassword } from "@/lib/auth/password";
import { sessionCookieName } from "@/lib/auth/session";
import { deleteAccount } from "@/lib/account";
import { enforceRateLimit, RULES } from "@/lib/rate-limit";

export const DELETE = route({}, async ({ user, json }) => {
  await enforceRateLimit(RULES.loginEmail, `delete:${user.id}`);
  const input = await json(z.object({ password: z.string().max(200).optional(), confirm: z.literal("DELETE", { message: 'Type "DELETE" to confirm' }) }));
  const record = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (record.passwordHash && !(input.password && (await verifyPassword(input.password, record.passwordHash)))) {
    throw new AppError("VALIDATION", "Your password is incorrect");
  }
  await deleteAccount(user.id);
  (await cookies()).delete(sessionCookieName());
  return { ok: true };
});
