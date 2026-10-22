export interface StyleDef {
  id: string;
  label: string;
  /** Appended to the prompt for providers without native style presets. */
  modifier: string;
  /** Stability AI `style_preset` value, when one exists. */
  stabilityPreset?: string;
  negative?: string;
  /** CSS gradient used for UI swatches (decorative, not AI output). */
  swatch: string;
}

export const STYLES: StyleDef[] = [
  { id: "photorealistic", label: "Photorealistic", modifier: "photorealistic, ultra-detailed photograph, natural lighting, 85mm lens, sharp focus", stabilityPreset: "photographic", negative: "cartoon, illustration, painting", swatch: "linear-gradient(135deg,#334155,#94a3b8)" },
  { id: "anime", label: "Anime", modifier: "anime style, cel shading, vibrant colors, detailed line art, studio-quality key visual", stabilityPreset: "anime", negative: "photorealistic, 3d render", swatch: "linear-gradient(135deg,#f472b6,#818cf8)" },
  { id: "cartoon", label: "Cartoon", modifier: "cartoon illustration, bold outlines, playful shapes, flat vibrant colors", stabilityPreset: "comic-book", swatch: "linear-gradient(135deg,#facc15,#fb923c)" },
  { id: "3d-render", label: "3D Render", modifier: "3D render, octane render, global illumination, soft shadows, high detail", stabilityPreset: "3d-model", swatch: "linear-gradient(135deg,#22d3ee,#6366f1)" },
  { id: "cinematic", label: "Cinematic", modifier: "cinematic film still, dramatic lighting, anamorphic lens, shallow depth of field, color graded", stabilityPreset: "cinematic", swatch: "linear-gradient(135deg,#0f172a,#b45309)" },
  { id: "fantasy", label: "Fantasy", modifier: "epic fantasy art, magical atmosphere, intricate details, ethereal lighting", stabilityPreset: "fantasy-art", swatch: "linear-gradient(135deg,#7c3aed,#10b981)" },
  { id: "digital-art", label: "Digital Art", modifier: "digital art, highly detailed, trending concept art, vivid colors", stabilityPreset: "digital-art", swatch: "linear-gradient(135deg,#8b5cf6,#06b6d4)" },
  { id: "watercolor", label: "Watercolor", modifier: "watercolor painting, soft washes, paper texture, delicate brush strokes", swatch: "linear-gradient(135deg,#93c5fd,#fbcfe8)" },
  { id: "oil-painting", label: "Oil Painting", modifier: "oil painting on canvas, rich impasto texture, classical composition, visible brushwork", swatch: "linear-gradient(135deg,#78350f,#d97706)" },
  { id: "cyberpunk", label: "Cyberpunk", modifier: "cyberpunk aesthetic, neon lights, rain-soaked streets, high-tech dystopia, magenta and cyan glow", stabilityPreset: "neon-punk", swatch: "linear-gradient(135deg,#db2777,#0891b2)" },
  { id: "minimalist", label: "Minimalist", modifier: "minimalist design, clean composition, negative space, simple shapes, muted palette", swatch: "linear-gradient(135deg,#e5e7eb,#9ca3af)" },
  { id: "product-photography", label: "Product Photography", modifier: "professional product photography, studio lighting, seamless backdrop, crisp reflections, commercial quality", stabilityPreset: "photographic", swatch: "linear-gradient(135deg,#f5f5f4,#a8a29e)" },
];

export const STYLE_IDS = STYLES.map((s) => s.id) as [string, ...string[]];

export function getStyle(id?: string | null): StyleDef | undefined {
  return id ? STYLES.find((s) => s.id === id) : undefined;
}

/** Builds the final provider prompt by appending the style's descriptive modifiers. */
export function applyStyle(prompt: string, style: StyleDef | undefined): string {
  if (!style) return prompt.trim();
  return `${prompt.trim().replace(/[.,;\s]+$/, "")}, ${style.modifier}`;
}

export const ASPECT_RATIOS: Record<string, { label: string; w: number; h: number }> = {
  "1:1": { label: "Square", w: 1, h: 1 },
  "4:5": { label: "Portrait 4:5", w: 4, h: 5 },
  "2:3": { label: "Portrait 2:3", w: 2, h: 3 },
  "9:16": { label: "Story 9:16", w: 9, h: 16 },
  "5:4": { label: "Landscape 5:4", w: 5, h: 4 },
  "3:2": { label: "Landscape 3:2", w: 3, h: 2 },
  "16:9": { label: "Widescreen 16:9", w: 16, h: 9 },
  "21:9": { label: "Cinematic 21:9", w: 21, h: 9 },
  "9:21": { label: "Tall 9:21", w: 9, h: 21 },
};
