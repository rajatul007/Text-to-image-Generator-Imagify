import { z } from "zod";
import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { getSettings } from "@/lib/settings";
import { assertPromptAllowed } from "@/lib/ai/moderation";
import { STYLE_IDS } from "@/lib/ai/styles";
import { CATEGORY_IDS } from "@/data/prompt-categories";
import { libraryQuerySchema, listPromptTemplates } from "@/lib/queries/prompts";

export const GET = route({ auth: "optional" }, async ({ user, query }) => listPromptTemplates(user?.id ?? null, query(libraryQuerySchema)));

const createSchema = z.object({
  title: z.string().trim().min(3).max(80),
  prompt: z.string().trim().min(10).max(2000),
  negativePrompt: z.string().trim().max(1000).optional().nullable(),
  category: z.enum(CATEGORY_IDS),
  style: z.enum(STYLE_IDS),
  aspectRatio: z.string().max(6).default("1:1"),
  tags: z.array(z.string().trim().toLowerCase().max(24)).max(8).default([]),
});

/** Users can share their own prompts publicly when the feature is enabled. */
export const POST = route({ verified: true }, async ({ user, json }) => {
  const { publicUserPromptsEnabled } = await getSettings();
  if (!publicUserPromptsEnabled) throw new AppError("FORBIDDEN", "Sharing community prompts is currently disabled");
  const input = await json(createSchema);
  await assertPromptAllowed(input.title, input.prompt, input.negativePrompt);
  const template = await db.promptTemplate.create({ data: { ...input, authorId: user.id, status: "PUBLISHED", isPublic: true } });
  return { template };
});
