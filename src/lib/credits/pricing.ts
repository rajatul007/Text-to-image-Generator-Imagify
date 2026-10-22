import type { AiModel } from "@prisma/client";
import { AppError } from "../errors";

export interface GenerationCostInput {
  model: Pick<AiModel, "creditsPerImage" | "hdMultiplier" | "qualities" | "maxImages">;
  numImages: number;
  quality: string;
}

/** Server-authoritative credit cost. The browser's estimate is never trusted. */
export function generationCost({ model, numImages, quality }: GenerationCostInput): number {
  if (!Number.isInteger(numImages) || numImages < 1 || numImages > model.maxImages) {
    throw new AppError("VALIDATION", `This model supports between 1 and ${model.maxImages} images per request`);
  }
  if (!model.qualities.includes(quality)) throw new AppError("VALIDATION", "Unsupported quality for this model");
  const multiplier = quality === "hd" ? Math.max(1, model.hdMultiplier) : 1;
  return model.creditsPerImage * multiplier * numImages;
}

