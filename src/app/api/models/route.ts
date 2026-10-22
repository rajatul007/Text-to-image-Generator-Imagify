import { route } from "@/lib/api";
import { listModels } from "@/lib/ai/registry";
import { STYLES, ASPECT_RATIOS } from "@/lib/ai/styles";
import { llmConfigured } from "@/lib/ai/llm";

export const GET = route({ auth: "none" }, async () => {
  const models = await listModels();
  return {
    models,
    styles: STYLES.map(({ id, label, swatch }) => ({ id, label, swatch })),
    aspectRatios: ASPECT_RATIOS,
    enhancerAvailable: llmConfigured(),
  };
});
