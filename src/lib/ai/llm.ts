import { env } from "../env";
import { AppError } from "../errors";
import { logger } from "../logger";

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

export function llmConfigured() {
  return Boolean(env().LLM_API_KEY);
}

export function llmInfo() {
  const e = env();
  const provider = e.LLM_PROVIDER;
  const model = e.LLM_MODEL ?? (provider === "anthropic" ? "claude-haiku-4-5" : "gpt-4o-mini");
  const base = e.LLM_API_BASE ?? (provider === "anthropic" ? "https://api.anthropic.com/v1" : "https://api.openai.com/v1");
  return { provider, model, base };
}

const unavailable = () => new AppError("PROVIDER_UNAVAILABLE", "The prompt enhancer is temporarily unavailable. Your prompt has not been changed.");

/** Sends a chat completion to the configured LLM (OpenAI-compatible or Anthropic). Returns the text content. */
export async function chat(messages: ChatMessage[], opts: { temperature?: number; maxTokens?: number } = {}): Promise<string> {
  const e = env();
  if (!e.LLM_API_KEY) throw new AppError("NOT_CONFIGURED", "The prompt enhancer is not configured on this server.");
  const { provider, model, base } = llmInfo();
  const signal = AbortSignal.timeout(e.LLM_TIMEOUT_MS);
  let res: Response;
  try {
    if (provider === "anthropic") {
      const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
      res = await fetch(`${base}/messages`, {
        method: "POST",
        headers: { "x-api-key": e.LLM_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          system,
          max_tokens: opts.maxTokens ?? 1200,
          temperature: opts.temperature ?? 0.8,
          messages: messages.filter((m) => m.role === "user").map((m) => ({ role: "user", content: m.content })),
        }),
        signal,
      });
    } else {
      res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${e.LLM_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, temperature: opts.temperature ?? 0.8, max_tokens: opts.maxTokens ?? 1200 }),
        signal,
      });
    }
  } catch (err) {
    logger.warn("llm request failed", { error: (err as Error).message });
    throw unavailable();
  }
  if (!res.ok) {
    logger.warn("llm http error", { status: res.status, body: (await res.text().catch(() => "")).slice(0, 300) });
    throw unavailable();
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    content?: { type: string; text?: string }[];
  };
  const text = provider === "anthropic" ? json.content?.find((c) => c.type === "text")?.text : json.choices?.[0]?.message?.content;
  if (!text?.trim()) throw unavailable();
  return text;
}
