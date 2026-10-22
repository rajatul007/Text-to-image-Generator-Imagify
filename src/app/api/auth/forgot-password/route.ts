import { z } from "zod";
import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { normalizeEmail, sendPasswordResetEmail } from "@/lib/auth/accounts";
import { enforceRateLimit, RULES } from "@/lib/rate-limit";

export const POST = route({ auth: "none", csrf: true }, async ({ json, ip }) => {
  await enforceRateLimit(RULES.passwordReset, ip);
  const { email } = await json(z.object({ email: z.string().trim().email("Enter a valid email address") }));
  const normalized = normalizeEmail(email);
  await enforceRateLimit(RULES.passwordReset, `email:${normalized}`);
  const user = await db.user.findUnique({ where: { email: normalized } });
  if (user && user.status === "ACTIVE") await sendPasswordResetEmail(user);
  // Same response either way – never reveal whether an account exists.
  return { ok: true, message: "If an account exists for that email, a reset link is on its way." };
});
