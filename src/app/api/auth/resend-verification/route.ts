import { route } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { sendVerificationEmail } from "@/lib/auth/accounts";
import { RULES } from "@/lib/rate-limit";

export const POST = route({ auth: "user", rateLimit: RULES.verifyEmail }, async ({ user }) => {
  if (user.emailVerified) return { ok: true, alreadyVerified: true };
  const res = await sendVerificationEmail(user);
  if (!res.ok) throw new AppError("PROVIDER_UNAVAILABLE", "We couldn't send the email right now. Please try again in a few minutes.");
  return { ok: true };
});
