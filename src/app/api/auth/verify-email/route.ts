import { z } from "zod";
import { route } from "@/lib/api";
import { consumeToken, markEmailVerified } from "@/lib/auth/accounts";
import { enforceRateLimit, RULES } from "@/lib/rate-limit";
import { getBalance } from "@/lib/credits/ledger";

export const POST = route({ auth: "none", csrf: true }, async ({ json, ip }) => {
  await enforceRateLimit(RULES.verifyEmail, ip);
  const { token } = await json(z.object({ token: z.string().min(10).max(200) }));
  const record = await consumeToken(token, "EMAIL_VERIFY");
  await markEmailVerified(record.userId);
  return { ok: true, balance: await getBalance(record.userId) };
});
