import { env } from "../../env";
import { blobFrom, providerHttpError, readBinary, sniffMime, wrapFetchError } from "./http";
import { ProviderError, type EditRequest, type GenerateRequest, type ImageProvider, type ProviderImage, type ProviderResult } from "./types";

/**
 * Stability AI REST v2beta.
 * Model config keys: { endpoint: "core" | "ultra" | "sd3" | "remove-background" | "upscale-fast" | "img2img", sd3Model?: string, strength?: number }
 */
interface StabilityConfig {
  endpoint: "core" | "ultra" | "sd3" | "remove-background" | "upscale-fast" | "img2img";
  sd3Model?: string;
  strength?: number;
}

const PATHS: Record<StabilityConfig["endpoint"], string> = {
  core: "/v2beta/stable-image/generate/core",
  ultra: "/v2beta/stable-image/generate/ultra",
  sd3: "/v2beta/stable-image/generate/sd3",
  img2img: "/v2beta/stable-image/generate/sd3",
  "remove-background": "/v2beta/stable-image/edit/remove-background",
  "upscale-fast": "/v2beta/stable-image/upscale/fast",
};

async function call(path: string, form: FormData, signal: AbortSignal): Promise<ProviderImage> {
  const e = env();
  let res: Response;
  try {
    res = await fetch(`${e.STABILITY_API_BASE}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${e.STABILITY_API_KEY}`, Accept: "image/*" },
      body: form,
      signal,
    });
  } catch (err) {
    throw wrapFetchError("stability", err);
  }
  if (!res.ok) throw await providerHttpError("stability", res);
  const finish = res.headers.get("finish-reason");
  if (finish && finish !== "SUCCESS") {
    throw new ProviderError("content_filtered", "Your request was blocked by the provider's safety filter. Please adjust your prompt.", `stability finish-reason ${finish}`);
  }
  const data = await readBinary(res);
  const seedHeader = res.headers.get("seed");
  return { data, mimeType: sniffMime(data), seed: seedHeader ? Number(seedHeader) : null };
}

export const stabilityProvider: ImageProvider = {
  id: "stability",
  isConfigured: () => Boolean(env().STABILITY_API_KEY),

  async generate(req: GenerateRequest): Promise<ProviderResult> {
    const cfg = req.model.config as unknown as StabilityConfig;
    const images: ProviderImage[] = [];
    // One request per image so every image has its own reproducible seed (base + index).
    for (let i = 0; i < req.numImages; i++) {
      const form = new FormData();
      form.append("prompt", req.prompt);
      form.append("output_format", "png");
      form.append("aspect_ratio", req.aspectRatio);
      if (req.seed != null) form.append("seed", String((req.seed + i) % 4294967295));
      if (req.negativePrompt && req.model.supportsNegativePrompt) form.append("negative_prompt", req.negativePrompt);
      if (cfg.endpoint === "core" && req.style?.stabilityPreset) form.append("style_preset", req.style.stabilityPreset);
      if (cfg.endpoint === "sd3" && cfg.sd3Model) form.append("model", cfg.sd3Model);
      const img = await call(PATHS[cfg.endpoint], form, req.signal);
      images.push({ ...img, seed: img.seed ?? (req.seed != null ? req.seed + i : null) });
    }
    return { images, modelVersion: req.model.modelVersion, costUsd: Number(req.model.estimatedCostUsd) * req.numImages };
  },

  async edit(req: EditRequest): Promise<ProviderResult> {
    const cfg = req.model.config as unknown as StabilityConfig;
    const images: ProviderImage[] = [];
    const count = cfg.endpoint === "img2img" ? req.numImages : 1;
    for (let i = 0; i < count; i++) {
      const form = new FormData();
      form.append("image", blobFrom(req.image, req.mimeType), "image.png");
      form.append("output_format", "png");
      if (cfg.endpoint === "img2img") {
        if (!req.prompt) throw new ProviderError("invalid_request", "A text instruction is required for this edit.");
        form.append("mode", "image-to-image");
        form.append("prompt", req.prompt);
        form.append("strength", String(req.strength ?? cfg.strength ?? 0.6));
        form.append("model", cfg.sd3Model ?? "sd3.5-large");
        if (req.negativePrompt) form.append("negative_prompt", req.negativePrompt);
        if (req.seed != null) form.append("seed", String(req.seed + i));
      }
      const img = await call(PATHS[cfg.endpoint], form, req.signal);
      images.push(img);
    }
    return { images, modelVersion: req.model.modelVersion, costUsd: Number(req.model.estimatedCostUsd) * count };
  },
};
