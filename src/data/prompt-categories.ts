export const PROMPT_CATEGORIES = [
  { id: "portraits", label: "Portraits" },
  { id: "nature", label: "Nature & Landscapes" },
  { id: "architecture", label: "Architecture" },
  { id: "fantasy", label: "Fantasy" },
  { id: "anime", label: "Anime" },
  { id: "sci-fi", label: "Sci-fi" },
  { id: "product", label: "Product Photography" },
  { id: "logos", label: "Logos & Branding" },
  { id: "wallpapers", label: "Wallpapers" },
  { id: "social", label: "Social Media" },
  { id: "food", label: "Food Photography" },
  { id: "fashion", label: "Fashion" },
  { id: "animals", label: "Animals" },
  { id: "abstract", label: "Abstract Art" },
  { id: "game-assets", label: "Game Assets" },
] as const;

export type PromptCategoryId = (typeof PROMPT_CATEGORIES)[number]["id"];
export const CATEGORY_IDS = PROMPT_CATEGORIES.map((c) => c.id) as unknown as [PromptCategoryId, ...PromptCategoryId[]];
export const categoryLabel = (id: string) => PROMPT_CATEGORIES.find((c) => c.id === id)?.label ?? id;
