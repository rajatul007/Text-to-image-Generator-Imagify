import { env } from "../../env";
import { blobFrom, providerHttpError, wrapFetchError } from "./http";
import { ProviderError, type EditRequest, type GenerateRequest, type ImageProvider, type ProviderResult } from "./types";

const SIZES: Record<string, string> = { "1:1": "1024x1024", "3:2": "1536x1024", "2:3": "1024x1536" };
const QUALITY: Record<string, string> = { standard: "medium", hd: "high" };

interface OpenAIImageResponse {
  data?: { b64_json?: string }[];
  error?: { message?: string };
}

async function parse(res: Response, model: string, costPerImage: number): Promise<ProviderResult> {
  if (!res.ok) throw await providerHttpError("openai", res);
  const json = (await res.json()) as OpenAIImageResponse;
  const images = (json.data ?? [])
    .filter((d) => d.b64_json)
    .map((d) => ({ data: Buffer.from(d.b64_json!, "base64"), mimeType: "image/png", seed: null }));
  if (images.length === 0) throw new ProviderError("transient", "The image service returned no images.", "openai: empty data");
  return { images, modelVersion: model, costUsd: costPerImage * images.length };
}

/** OpenAI Images API (gpt-image-1). Seeds and negative prompts are not supported by this API. */
export const openaiProvider: ImageProvider = {
  id: "openai",
  isConfigured: () => Boolean(env().OPENAI_API_KEY),

  async generate(req: GenerateRequest) {
    const e = env();
    const size = SIZES[req.aspectRatio];
    if (!size) throw new ProviderError("invalid_request", "Unsupported aspect ratio for this model.");
    try {
      const res = await fetch(`${e.OPENAI_API_BASE}/images/generations`, {
        method: "POST",
        headers: { Authorization: `Bearer ${e.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: req.model.providerModel, prompt: req.prompt, n: req.numImages, size, quality: QUALITY[req.quality] ?? "medium" }),
        signal: req.signal,
      });
      return await parse(res, req.model.modelVersion, Number(req.model.estimatedCostUsd) * (req.quality === "hd" ? 2 : 1));
    } catch (err) {
      throw wrapFetchError("openai", err);
    }
  },

  async edit(req: EditRequest) {
    const e = env();
    const instruction =
      req.type === "VARIATION"
        ? `Create a fresh variation of this image that keeps its subject, composition and style.${req.prompt ? ` Context: ${req.prompt}` : ""}`
        : req.prompt;
    if (!instruction) throw new ProviderError("invalid_request", "A text instruction is required for this edit.");
    const form = new FormData();
    form.append("model", req.model.providerModel);
    form.append("image", blobFrom(req.image, req.mimeType), "image.png");
    form.append("prompt", instruction);
    form.append("n", String(req.numImages));
    form.append("size", "auto");
    try {
      const res = await fetch(`${e.OPENAI_API_BASE}/images/edits`, {
        method: "POST",
        headers: { Authorization: `Bearer ${e.OPENAI_API_KEY}` },
        body: form,
        signal: req.signal,
      });
      return await parse(res, req.model.modelVersion, Number(req.model.estimatedCostUsd));
    } catch (err) {
      throw wrapFetchError("openai", err);
    }
  },
};
