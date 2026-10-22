import type { AiModel, JobType } from "@prisma/client";
import type { StyleDef } from "../styles";

export interface GenerateRequest {
  model: AiModel;
  prompt: string;
  negativePrompt?: string | null;
  aspectRatio: string;
  quality: string;
  numImages: number;
  /** Base seed. Image i uses seed + i on seed-capable models. */
  seed?: number | null;
  style?: StyleDef;
  signal: AbortSignal;
}

export interface EditRequest {
  model: AiModel;
  type: Exclude<JobType, "GENERATE">;
  image: Buffer;
  mimeType: string;
  width: number;
  height: number;
  prompt?: string | null;
  negativePrompt?: string | null;
  seed?: number | null;
  numImages: number;
  strength?: number;
  signal: AbortSignal;
}

export interface ProviderImage {
  data: Buffer;
  mimeType: string;
  seed?: number | null;
}

export interface ProviderResult {
  images: ProviderImage[];
  modelVersion: string;
  costUsd?: number;
}

export interface ImageProvider {
  readonly id: string;
  isConfigured(): boolean;
  generate?(req: GenerateRequest): Promise<ProviderResult>;
  edit?(req: EditRequest): Promise<ProviderResult>;
}

export type ProviderErrorKind = "transient" | "rate_limited" | "content_filtered" | "invalid_request" | "auth" | "timeout" | "unknown";

/** Error raised by provider adapters. `userMessage` is always safe to display. */
export class ProviderError extends Error {
  constructor(
    readonly kind: ProviderErrorKind,
    readonly userMessage: string,
    internal?: string,
  ) {
    super(internal ?? userMessage);
    this.name = "ProviderError";
  }
  get retryable() {
    return this.kind === "transient" || this.kind === "rate_limited" || this.kind === "timeout";
  }
}
