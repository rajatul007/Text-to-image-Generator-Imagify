import { z } from "zod";
import { route } from "@/lib/api";
import { RULES } from "@/lib/rate-limit";
import { ENHANCE_MODES, enhancePrompt } from "@/lib/ai/enhancer";
import { assertPromptAllowed } from "@/lib/ai/moderation";
import { STYLE_IDS } from "@/lib/ai/styles";

const schema = z.object({
  prompt: z.string().trim().min(2, "Write a short idea first").max(1500),
  mode: z.enum(ENHANCE_MODES).default("detailed"),
  count: z.number().int().min(1).max(4).default(1),
  style: z.enum(STYLE_IDS).optional().nullable(),
});

export const POST = route({ rateLimit: RULES.enhance }, async ({ user, json }) => {
  const input = await json(schema);
  await assertPromptAllowed(input.prompt);
  const result = await enhancePrompt(user.id, { ...input, style: input.style ?? undefined });
  return result;
});
