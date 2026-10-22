import { ProviderError } from "./types";

/** Maps an HTTP failure from an AI provider to a classified ProviderError. */
export async function providerHttpError(provider: string, res: Response): Promise<ProviderError> {
  let body = "";
  try {
    body = (await res.text()).slice(0, 600);
  } catch {
    /* ignore */
  }
  const internal = `${provider} HTTP ${res.status}: ${body}`;
  const lower = body.toLowerCase();
  if (res.status === 429) return new ProviderError("rate_limited", "The image service is busy right now. Please try again shortly.", internal);
  if (res.status >= 500) return new ProviderError("transient", "The image service is temporarily unavailable.", internal);
  if (res.status === 401 || res.status === 402) return new ProviderError("auth", "The image service is not available at the moment.", internal);
  if (lower.includes("moderation") || lower.includes("safety") || lower.includes("content_policy") || lower.includes("nsfw") || lower.includes("flagged"))
    return new ProviderError("content_filtered", "Your request was blocked by the provider's safety filter. Please adjust your prompt.", internal);
  if (res.status === 403) return new ProviderError("auth", "The image service rejected the request.", internal);
  return new ProviderError("invalid_request", "The image service could not process this request with the chosen settings.", internal);
}

export function wrapFetchError(provider: string, err: unknown): ProviderError {
  if (err instanceof ProviderError) return err;
  const e = err as Error;
  if (e?.name === "TimeoutError" || e?.name === "AbortError")
    return new ProviderError("timeout", "The image service took too long to respond.", `${provider}: ${e.message}`);
  return new ProviderError("transient", "Could not reach the image service.", `${provider}: ${e?.message ?? String(err)}`);
}

export async function readBinary(res: Response): Promise<Buffer> {
  return Buffer.from(await res.arrayBuffer());
}

export function sniffMime(buf: Buffer): string {
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "image/webp";
  return "application/octet-stream";
}

export function blobFrom(buf: Buffer, mime: string) {
  return new Blob([new Uint8Array(buf)], { type: mime });
}
