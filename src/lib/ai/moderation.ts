import { env } from "../env";
import { AppError } from "../errors";
import { logger } from "../logger";

// Hard blocklist for clearly prohibited requests. Providers apply their own safety filters as well.
const BLOCKED: RegExp[] = [
  /\b(child|children|kid|kids|minor|minors|underage|preteen|pre-teen|teen|teens|young girl|young boy|loli|shota|toddler|infant)\b[\s\S]{0,40}\b(nude|naked|sexual|sexy|explicit|porn|nsfw|lingerie|erotic)\b/i,
  /\b(nude|naked|sexual|sexy|explicit|porn|nsfw|lingerie|erotic)\b[\s\S]{0,40}\b(child|children|kid|kids|minor|minors|underage|preteen|pre-teen|teen|teens|young girl|young boy|loli|shota|toddler|infant)\b/i,
  /\b(csam|cp porn)\b/i,
  /\b(beheading|gore porn|snuff)\b/i,
];

export interface ModerationResult {
  allowed: boolean;
  reason?: string;
}

export function localModeration(text: string): ModerationResult {
  for (const re of BLOCKED) if (re.test(text)) return { allowed: false, reason: "blocked_terms" };
  return { allowed: true };
}

/** Runs the local blocklist and, when enabled, OpenAI's moderation endpoint. */
export async function moderateText(text: string): Promise<ModerationResult> {
  const local = localModeration(text);
  if (!local.allowed) return local;
  const e = env();
  if (e.OPENAI_MODERATION && e.OPENAI_API_KEY) {
    try {
      const res = await fetch(`${e.OPENAI_API_BASE}/moderations`, {
        method: "POST",
        headers: { Authorization: `Bearer ${e.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "omni-moderation-latest", input: text }),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const json = (await res.json()) as { results?: { flagged: boolean; categories: Record<string, boolean> }[] };
        const r = json.results?.[0];
        if (r?.flagged && (r.categories["sexual/minors"] || r.categories["violence/graphic"] || r.categories["self-harm/instructions"] || r.categories["hate/threatening"])) {
          return { allowed: false, reason: "moderation_flagged" };
        }
      }
    } catch (err) {
      logger.warn("moderation check failed (allowing)", { error: (err as Error).message });
    }
  }
  return { allowed: true };
}

export async function assertPromptAllowed(...texts: (string | null | undefined)[]) {
  const joined = texts.filter(Boolean).join("\n");
  if (!joined) return;
  const result = await moderateText(joined);
  if (!result.allowed) throw new AppError("BAD_REQUEST", "This prompt violates our content policy. Please revise it and try again.");
}
