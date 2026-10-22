import { z } from "zod";
import { route } from "@/lib/api";
import { createSession } from "@/lib/auth/session";
import { createUser, sendVerificationEmail } from "@/lib/auth/accounts";
import { passwordSchema } from "@/lib/auth/password";
import { enforceRateLimit, RULES } from "@/lib/rate-limit";

const schema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(60),
  email: z.string().trim().email("Enter a valid email address").max(254),
  password: passwordSchema,
});

export const POST = route({ auth: "none", csrf: true }, async ({ json, ip }) => {
  await enforceRateLimit(RULES.signup, ip);
  const input = await json(schema);
  const user = await createUser(input);
  const mail = await sendVerificationEmail(user);
  await createSession(user.id);
  return {
    user: { id: user.id, name: user.name, email: user.email },
    verificationEmailSent: mail.ok,
    message: mail.ok ? "Account created. Check your inbox to verify your email." : "Account created, but we couldn't send the verification email. You can resend it from your dashboard.",
  };
});
