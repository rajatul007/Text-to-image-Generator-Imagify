import { env } from "../../env";
import { providerHttpError, readBinary, sniffMime, wrapFetchError } from "./http";
import { ProviderError, type GenerateRequest, type ImageProvider, type ProviderImage, type ProviderResult } from "./types";

interface Prediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: string[] | string | null;
  error?: string | null;
  version?: string;
  urls?: { get: string };
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    });
  });

async function runPrediction(path: string, input: Record<string, unknown>, signal: AbortSignal): Promise<Prediction> {
  const e = env();
  const headers = { Authorization: `Bearer ${e.REPLICATE_API_TOKEN}`, "Content-Type": "application/json", Prefer: "wait=55" };
  let res = await fetch(`${e.REPLICATE_API_BASE}${path}`, { method: "POST", headers, body: JSON.stringify({ input }), signal });
  if (!res.ok) throw await providerHttpError("replicate", res);
  let prediction = (await res.json()) as Prediction;
  // Poll until terminal state (the caller's AbortSignal enforces the overall timeout).
  while (prediction.status === "starting" || prediction.status === "processing") {
    await sleep(1500, signal);
    res = await fetch(prediction.urls?.get ?? `${e.REPLICATE_API_BASE}/predictions/${prediction.id}`, {
      headers: { Authorization: `Bearer ${e.REPLICATE_API_TOKEN}` },
      signal,
    });
    if (!res.ok) throw await providerHttpError("replicate", res);
    prediction = (await res.json()) as Prediction;
  }
  if (prediction.status !== "succeeded") {
    const msg = prediction.error ?? prediction.status;
    if (/nsfw|safety/i.test(msg)) throw new ProviderError("content_filtered", "Your request was blocked by the provider's safety filter. Please adjust your prompt.", `replicate: ${msg}`);
    throw new ProviderError("transient", "The image service failed to generate this image.", `replicate: ${msg}`);
  }
  return prediction;
}

/** Replicate predictions API, e.g. black-forest-labs/flux-schnell. Model config: { path: "/models/<owner>/<name>/predictions" } */
export const replicateProvider: ImageProvider = {
  id: "replicate",
  isConfigured: () => Boolean(env().REPLICATE_API_TOKEN),

  async generate(req: GenerateRequest): Promise<ProviderResult> {
    const cfg = req.model.config as { path?: string };
    const path = cfg.path ?? `/models/${req.model.providerModel}/predictions`;
    const images: ProviderImage[] = [];
    let version = req.model.modelVersion;
    try {
      for (let i = 0; i < req.numImages; i++) {
        const seed = req.seed != null ? req.seed + i : undefined;
        const prediction = await runPrediction(
          path,
          { prompt: req.prompt, aspect_ratio: req.aspectRatio, num_outputs: 1, output_format: "png", ...(seed != null ? { seed } : {}) },
          req.signal,
        );
        if (prediction.version) version = `${req.model.modelVersion}@${prediction.version.slice(0, 12)}`;
        const outputs = Array.isArray(prediction.output) ? prediction.output : prediction.output ? [prediction.output] : [];
        for (const url of outputs) {
          const res = await fetch(url, { signal: req.signal });
          if (!res.ok) throw await providerHttpError("replicate-delivery", res);
          const data = await readBinary(res);
          images.push({ data, mimeType: sniffMime(data), seed: seed ?? null });
        }
      }
    } catch (err) {
      throw wrapFetchError("replicate", err);
    }
    if (images.length === 0) throw new ProviderError("transient", "The image service returned no images.", "replicate: empty output");
    return { images, modelVersion: version, costUsd: Number(req.model.estimatedCostUsd) * images.length };
  },
};
