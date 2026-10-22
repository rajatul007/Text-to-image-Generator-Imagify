import { z } from "zod";
import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { createSession } from "@/lib/auth/session";
import { normalizeEmail } from "@/lib/auth/accounts";
import { burnPasswordCheck, verifyPassword } from "@/lib/auth/password";
import { enforceRateLimit, resetRateLimit, RULES } from "@/lib/rate-limit";

const schema = z.object({ email: z.string().trim().email("Enter a valid email address"), password: z.string().min(1, "Enter your password").max(200) });

export const POST = route({ auth: "none", csrf: true }, async ({ json, ip }) => {
  const input = await json(schema);
  const email = normalizeEmail(input.email);
  await enforceRateLimit(RULES.login, ip);
  await enforceRateLimit(RULES.loginEmail, email);
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    await burnPasswordCheck(input.password);
    if (user && !user.passwordHash) throw new AppError("UNAUTHENTICATED", "This account uses Google sign-in. Continue with Google or reset your password to set one.");
    throw new AppError("UNAUTHENTICATED", "Incorrect email or password");
  }
  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) throw new AppError("UNAUTHENTICATED", "Incorrect email or password");
  if (user.status === "SUSPENDED") throw new AppError("ACCOUNT_SUSPENDED", "This account has been suspended. Contact support if you think this is a mistake.");
  if (user.status === "DELETED") throw new AppError("UNAUTHENTICATED", "Incorrect email or password");
  await resetRateLimit(RULES.loginEmail, email);
  await createSession(user.id);
  return { user: { id: user.id, name: user.name, email: user.email, role: user.role, emailVerified: Boolean(user.emailVerified) } };
});
