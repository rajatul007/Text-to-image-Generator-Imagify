import type { AiModel } from "@prisma/client";
import { db } from "../db";
import { clipdropProvider } from "./providers/clipdrop";
import { openaiProvider } from "./providers/openai";
import { replicateProvider } from "./providers/replicate";
import { stabilityProvider } from "./providers/stability";
import type { ImageProvider } from "./providers/types";

const PROVIDERS: Record<string, ImageProvider> = {
  stability: stabilityProvider,
  openai: openaiProvider,
  replicate: replicateProvider,
  clipdrop: clipdropProvider,
};

export function getProvider(id: string): ImageProvider | undefined {
  return PROVIDERS[id];
}

export function providerIds() {
  return Object.keys(PROVIDERS);
}

export function isModelAvailable(model: AiModel) {
  return model.enabled && Boolean(PROVIDERS[model.provider]?.isConfigured());
}

export interface PublicModel {
  id: string;
  kind: AiModel["kind"];
  provider: string;
  displayName: string;
  description: string | null;
  modelVersion: string;
  supportsSeed: boolean;
  supportsNegativePrompt: boolean;
  supportsStylePreset: boolean;
  maxImages: number;
  aspectRatios: string[];
  qualities: string[];
  creditsPerImage: number;
  hdMultiplier: number;
  available: boolean;
}

export function toPublicModel(m: AiModel): PublicModel {
  return {
    id: m.id,
    kind: m.kind,
    provider: m.provider,
    displayName: m.displayName,
    description: m.description,
    modelVersion: m.modelVersion,
    supportsSeed: m.supportsSeed,
    supportsNegativePrompt: m.supportsNegativePrompt,
    supportsStylePreset: m.supportsStylePreset,
    maxImages: m.maxImages,
    aspectRatios: m.aspectRatios,
    qualities: m.qualities,
    creditsPerImage: m.creditsPerImage,
    hdMultiplier: m.hdMultiplier,
    available: isModelAvailable(m),
  };
}

export async function listModels(kind?: AiModel["kind"]) {
  const models = await db.aiModel.findMany({ where: { enabled: true, ...(kind ? { kind } : {}) }, orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }] });
  return models.map(toPublicModel);
}
