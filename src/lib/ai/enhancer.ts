import { z } from "zod";
import { db } from "../db";
import { AppError } from "../errors";
import { chat, llmInfo } from "./llm";
import { getStyle } from "./styles";

export const ENHANCE_MODES = ["concise", "detailed", "cinematic", "realistic", "artistic"] as const;
export type EnhanceMode = (typeof ENHANCE_MODES)[number];

const MODE_GUIDE: Record<EnhanceMode, string> = {
  concise: "Keep it tight: one sentence, 25–45 words, only the most impactful visual details.",
  detailed: "Rich and thorough: 60–100 words covering subject, environment, lighting, camera angle, composition, mood and style.",
  cinematic: "Frame it like a film still: lens, camera angle, dramatic lighting, color grading, atmosphere. 50–90 words.",
  realistic: "Photorealistic photography language: camera, lens, natural lighting, textures, realistic materials. 50–90 words.",
  artistic: "Painterly/illustrative: medium, art movement influences (no living artist names), palette, brushwork, mood. 50–90 words.",
};

export function buildEnhancerMessages(prompt: string, mode: EnhanceMode, count: number, style?: string) {
  const styleLabel = getStyle(style)?.label;
  return [
    {
      role: "system" as const,
      content: [
        "You are an expert prompt engineer for text-to-image diffusion models.",
        "Rewrite the user's idea into a vivid, image-generation-friendly prompt.",
        "Rules: preserve the user's core subject and intent exactly; never change who/what the subject is; add concrete visual details (subject details, environment, lighting, camera angle, composition, mood, visual style);",
        "no meta commentary, no quotation marks around the prompt, no lists, no hashtags; do not add text/logos unless asked; do not name living artists or real private people; keep content safe for work.",
        MODE_GUIDE[mode],
        styleLabel ? `The user selected the visual style "${styleLabel}" – reflect it.` : "",
        `Return ONLY JSON of the form {"prompts": ["..."]} containing exactly ${count} distinct alternative${count > 1 ? "s" : ""}.`,
      ]
        .filter(Boolean)
        .join("\n"),
    },
    { role: "user" as const, content: `Idea: ${prompt}` },
  ];
}

const resultSchema = z.object({ prompts: z.array(z.string().min(3)).min(1) });

/** Extracts the JSON payload from an LLM reply (tolerates code fences or surrounding prose). */
export function parseEnhancerOutput(text: string, count: number): string[] {
  const candidates: string[] = [];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) candidates.push(fenced[1]);
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) candidates.push(text.slice(start, end + 1));
  for (const c of candidates) {
    try {
      const parsed = resultSchema.safeParse(JSON.parse(c));
      if (parsed.success) return clean(parsed.data.prompts).slice(0, count);
    } catch {
      /* try next */
    }
  }
  // Fallback: a single plain-text prompt
  const plain = text.replace(/```[\s\S]*?```/g, "").trim();
  if (plain.length > 10 && !plain.startsWith("{")) return clean([plain]).slice(0, 1);
  throw new AppError("PROVIDER_UNAVAILABLE", "The prompt enhancer returned an unexpected response. Your prompt has not been changed.");
}

function clean(prompts: string[]) {
  return prompts.map((p) => p.trim().replace(/^["'“]+|["'”]+$/g, "").replace(/\s+/g, " ").slice(0, 1500)).filter(Boolean);
}

export async function enhancePrompt(userId: string, input: { prompt: string; mode: EnhanceMode; count: number; style?: string }) {
  const text = await chat(buildEnhancerMessages(input.prompt, input.mode, input.count, input.style), { temperature: input.count > 1 ? 0.95 : 0.7 });
  const prompts = parseEnhancerOutput(text, input.count);
  const info = llmInfo();
  const record = await db.promptEnhancement.create({
    data: { userId, original: input.prompt, mode: input.mode, results: prompts, provider: info.provider, model: info.model },
  });
  return { id: record.id, prompts, provider: info.provider, model: info.model };
}
