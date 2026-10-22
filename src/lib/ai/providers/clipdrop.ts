import { env } from "../../env";
import { blobFrom, providerHttpError, readBinary, sniffMime, wrapFetchError } from "./http";
import { ProviderError, type EditRequest, type GenerateRequest, type ImageProvider, type ProviderImage, type ProviderResult } from "./types";

/**
 * Clipdrop APIs (the provider used by the original Imagify app).
 * Model config: { endpoint: "text-to-image" | "remove-background" | "upscale" | "reimagine" | "replace-background" }
 */
type Endpoint = "text-to-image" | "remove-background" | "upscale" | "reimagine" | "replace-background";
const PATHS: Record<Endpoint, string> = {
  "text-to-image": "/text-to-image/v1",
  "remove-background": "/remove-background/v1",
  upscale: "/image-upscaling/v1/upscale",
  reimagine: "/reimagine/v1/reimagine",
  "replace-background": "/replace-background/v1",
};

async function call(endpoint: Endpoint, form: FormData, signal: AbortSignal): Promise<ProviderImage> {
  const e = env();
  let res: Response;
  try {
    res = await fetch(`${e.CLIPDROP_API_BASE}${PATHS[endpoint]}`, { method: "POST", headers: { "x-api-key": e.CLIPDROP_API_KEY! }, body: form, signal });
  } catch (err) {
    throw wrapFetchError("clipdrop", err);
  }
  if (!res.ok) throw await providerHttpError("clipdrop", res);
  const data = await readBinary(res);
  return { data, mimeType: sniffMime(data), seed: null };
}

export const clipdropProvider: ImageProvider = {
  id: "clipdrop",
  isConfigured: () => Boolean(env().CLIPDROP_API_KEY),

  async generate(req: GenerateRequest): Promise<ProviderResult> {
    const images: ProviderImage[] = [];
    for (let i = 0; i < req.numImages; i++) {
      const form = new FormData();
      form.append("prompt", req.prompt.slice(0, 1000));
      images.push(await call("text-to-image", form, req.signal));
    }
    return { images, modelVersion: req.model.modelVersion, costUsd: Number(req.model.estimatedCostUsd) * req.numImages };
  },

  async edit(req: EditRequest): Promise<ProviderResult> {
    const endpoint = (req.model.config as { endpoint: Endpoint }).endpoint;
    const form = new FormData();
    form.append("image_file", blobFrom(req.image, req.mimeType), "image.png");
    if (endpoint === "upscale") {
      const scale = Math.min(2, 4096 / Math.max(req.width, req.height));
      form.append("target_width", String(Math.round(req.width * scale)));
      form.append("target_height", String(Math.round(req.height * scale)));
    }
    if (endpoint === "replace-background") {
      if (!req.prompt) throw new ProviderError("invalid_request", "Describe the new background.");
      form.append("prompt", req.prompt);
    }
    const count = endpoint === "reimagine" ? req.numImages : 1;
    const images: ProviderImage[] = [];
    for (let i = 0; i < count; i++) images.push(await call(endpoint, form, req.signal));
    return { images, modelVersion: req.model.modelVersion, costUsd: Number(req.model.estimatedCostUsd) * count };
  },
};
