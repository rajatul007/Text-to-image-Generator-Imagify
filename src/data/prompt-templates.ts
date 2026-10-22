import type { PromptCategoryId } from "./prompt-categories";

export interface SeedTemplate {
  title: string;
  category: PromptCategoryId;
  style: string;
  aspectRatio: string;
  prompt: string;
  negativePrompt?: string;
  tags: string[];
  featured?: boolean;
}

export const SEED_TEMPLATES: SeedTemplate[] = [
  // Portraits
  { title: "Golden hour portrait", category: "portraits", style: "photorealistic", aspectRatio: "4:5", featured: true, tags: ["portrait", "golden hour", "bokeh"],
    prompt: "Close-up portrait of a smiling elderly fisherman with weathered skin and a knitted cap, golden hour sunlight from the side, shallow depth of field with creamy bokeh of a harbor behind him, 85mm lens, rich warm tones, highly detailed skin texture" },
  { title: "Neon-lit street portrait", category: "portraits", style: "cyberpunk", aspectRatio: "2:3", tags: ["neon", "night", "rain"],
    prompt: "Portrait of a young woman in a reflective raincoat standing under neon signs on a rainy night street, magenta and teal light reflecting on wet skin, cinematic composition, droplets in the air, moody atmosphere" },
  { title: "Renaissance-style self portrait", category: "portraits", style: "oil-painting", aspectRatio: "4:5", tags: ["classical", "painting"],
    prompt: "Classical oil portrait of a thoughtful scholar in a dark velvet coat holding a quill, chiaroscuro candlelight, deep umber background, fine craquelure texture, museum-quality composition" },
  // Nature
  { title: "Misty mountain sunrise", category: "nature", style: "photorealistic", aspectRatio: "16:9", featured: true, tags: ["mountains", "sunrise", "fog"],
    prompt: "Sweeping landscape of jagged alpine peaks at sunrise, layers of mist drifting through pine valleys, first light painting the summits pink and orange, a still lake reflecting the sky in the foreground, ultra-wide angle, crisp detail" },
  { title: "Bioluminescent beach", category: "nature", style: "cinematic", aspectRatio: "16:9", tags: ["night", "ocean", "glow"],
    prompt: "Night beach with waves glowing electric blue from bioluminescent plankton, Milky Way arching overhead, silhouetted palm trees, long exposure, serene and magical atmosphere" },
  { title: "Autumn forest path", category: "nature", style: "watercolor", aspectRatio: "3:2", tags: ["autumn", "forest"],
    prompt: "A winding forest path covered in red and amber leaves, soft sunbeams through the canopy, gentle watercolor washes with visible paper texture, cozy peaceful mood" },
  // Architecture
  { title: "Brutalist library interior", category: "architecture", style: "photorealistic", aspectRatio: "3:2", tags: ["interior", "concrete"],
    prompt: "Interior of a vast brutalist concrete library with towering bookshelves, skylights casting geometric beams of light, a few readers at long wooden tables, symmetrical composition, architectural photography" },
  { title: "Floating eco city", category: "architecture", style: "3d-render", aspectRatio: "16:9", featured: true, tags: ["futuristic", "green"],
    prompt: "A sustainable futuristic city of curved white towers covered in hanging gardens, floating above calm turquoise water, solar sails and wind turbines, soft daylight, aerial view, clean 3D architectural visualization" },
  { title: "Kyoto alley at dusk", category: "architecture", style: "cinematic", aspectRatio: "2:3", tags: ["japan", "lanterns"],
    prompt: "Narrow traditional Kyoto alley at dusk with wooden machiya houses, glowing paper lanterns, stone pavement wet from rain, a lone figure with an umbrella in the distance, cinematic color grading" },
  // Fantasy
  { title: "Dragon over the citadel", category: "fantasy", style: "fantasy", aspectRatio: "16:9", featured: true, tags: ["dragon", "castle", "epic"],
    prompt: "An enormous emerald dragon circling a cliffside citadel at sunset, banners whipping in the wind, storm clouds lit gold from below, epic scale, intricate armor details on tiny guards for scale" },
  { title: "Enchanted library tree", category: "fantasy", style: "digital-art", aspectRatio: "2:3", tags: ["magic", "books"],
    prompt: "A giant ancient tree whose hollow trunk is a spiral library, glowing books floating between branches, fireflies and soft magical light, cozy and wondrous atmosphere, highly detailed" },
  { title: "Crystal cave guardian", category: "fantasy", style: "fantasy", aspectRatio: "4:5", tags: ["crystal", "guardian"],
    prompt: "A stoic armored guardian made of living crystal standing in a cave of glowing amethyst geodes, prismatic light refractions, mist at ground level, heroic low-angle shot" },
  // Anime
  { title: "Rooftop summer evening", category: "anime", style: "anime", aspectRatio: "16:9", featured: true, tags: ["slice of life", "sunset"],
    prompt: "Two friends sitting on a school rooftop at summer sunset, cumulonimbus clouds glowing orange, city skyline below, wind blowing their hair, detailed anime key visual, nostalgic mood" },
  { title: "Mecha hangar", category: "anime", style: "anime", aspectRatio: "16:9", tags: ["mecha", "robot"],
    prompt: "A towering white and blue mecha being repaired in a vast hangar, sparks from welding, engineers on scaffolding, dramatic overhead lights, detailed mechanical design, anime production art" },
  { title: "Spirit forest shrine", category: "anime", style: "anime", aspectRatio: "2:3", tags: ["shrine", "spirits"],
    prompt: "A small mossy shrine in a deep forest surrounded by gentle glowing forest spirits, a girl in a yellow raincoat offering a rice ball, soft dappled light, painterly anime background art" },
  // Sci-fi
  { title: "Orbital station sunrise", category: "sci-fi", style: "cinematic", aspectRatio: "21:9", featured: true, tags: ["space", "station"],
    prompt: "A massive ring-shaped orbital station silhouetted against Earth's sunrise, thin atmosphere glowing blue, shuttles docking with tiny engine trails, hard science fiction realism, anamorphic lens flare" },
  { title: "Desert planet market", category: "sci-fi", style: "digital-art", aspectRatio: "16:9", tags: ["alien", "market"],
    prompt: "Bustling market on a desert planet with twin suns, merchants under colorful canopies, strange alien fruits, hovering cargo drones, warm dusty light, rich detailed concept art" },
  { title: "Android repair lab", category: "sci-fi", style: "3d-render", aspectRatio: "3:2", tags: ["android", "lab"],
    prompt: "A sleek android with a partially open face panel sitting calmly in a clean white repair lab, robotic arms adjusting components, soft studio lighting, subsurface scattering, photoreal 3D render" },
  // Product
  { title: "Perfume on marble", category: "product", style: "product-photography", aspectRatio: "4:5", featured: true, tags: ["luxury", "cosmetics"],
    prompt: "A minimalist glass perfume bottle with amber liquid on white Carrara marble, soft diffused window light, delicate shadow, a sprig of jasmine beside it, luxury commercial product photography" },
  { title: "Sneaker levitation", category: "product", style: "product-photography", aspectRatio: "1:1", tags: ["sneaker", "dynamic"],
    prompt: "A modern running sneaker floating mid-air against a gradient pastel background, splashes of colored powder exploding around it, crisp studio lighting, high-speed photography look" },
  { title: "Coffee bag mockup", category: "product", style: "product-photography", aspectRatio: "4:5", tags: ["packaging", "coffee"],
    prompt: "A matte kraft coffee bag with a blank label standing on a rustic wooden table, scattered roasted beans, morning side light, shallow depth of field, clean packaging mockup photography" },
  // Logos
  { title: "Geometric fox emblem", category: "logos", style: "minimalist", aspectRatio: "1:1", tags: ["emblem", "flat"],
    prompt: "Minimalist geometric fox head emblem built from simple triangles, flat orange and charcoal colors, centered on a plain white background, vector logo concept, clean negative space" },
  { title: "Coffee shop badge", category: "logos", style: "minimalist", aspectRatio: "1:1", tags: ["badge", "vintage"],
    prompt: "Vintage circular badge logo concept for a coffee roastery featuring a steaming cup and mountain silhouette, two-color design, cream and dark brown, centered on white, flat vector style" },
  { title: "Tech monogram", category: "logos", style: "minimalist", aspectRatio: "1:1", tags: ["monogram", "tech"],
    prompt: "Abstract interlocking monogram mark formed by two flowing ribbons, gradient from violet to electric blue, modern tech brand identity concept, centered on dark background, simple and scalable" },
  // Wallpapers
  { title: "Synthwave horizon", category: "wallpapers", style: "digital-art", aspectRatio: "16:9", featured: true, tags: ["synthwave", "retro"],
    prompt: "Retro synthwave landscape with a glowing striped sun setting over a neon grid, purple and pink mountains, starry gradient sky, crisp desktop wallpaper composition" },
  { title: "Phone wallpaper – aurora", category: "wallpapers", style: "photorealistic", aspectRatio: "9:16", tags: ["aurora", "mobile"],
    prompt: "Vertical shot of vivid green and violet aurora swirling above a snowy pine forest and frozen lake, stars visible, calm and minimal, phone wallpaper composition" },
  { title: "Minimal dunes", category: "wallpapers", style: "minimalist", aspectRatio: "16:9", tags: ["desert", "calm"],
    prompt: "Smooth minimalist sand dunes with soft curved shadows, pastel peach and lavender gradient sky, lots of negative space, calm desktop wallpaper" },
  // Social
  { title: "Motivational quote background", category: "social", style: "watercolor", aspectRatio: "1:1", tags: ["instagram", "background"],
    prompt: "Soft abstract watercolor background in blush pink and sage green with generous empty space in the center for text, gentle paper texture, elegant and airy" },
  { title: "Story teaser", category: "social", style: "cinematic", aspectRatio: "9:16", tags: ["story", "teaser"],
    prompt: "Moody vertical teaser image of a silhouetted figure walking into a beam of light through fog, empty space at top for a headline, high contrast, cinematic" },
  { title: "Flat-lay workspace", category: "social", style: "product-photography", aspectRatio: "4:5", tags: ["flat lay", "workspace"],
    prompt: "Top-down flat lay of a tidy creative workspace with a laptop, notebook, coffee cup, succulent and color swatches on a light oak desk, soft natural light, social media aesthetic" },
  // Food
  { title: "Ramen close-up", category: "food", style: "photorealistic", aspectRatio: "4:5", featured: true, tags: ["ramen", "steam"],
    prompt: "Steaming bowl of tonkotsu ramen with chashu pork, soft-boiled egg, nori and scallions, chopsticks lifting noodles, dark moody background, side lighting highlighting the steam, food photography" },
  { title: "Rustic bakery table", category: "food", style: "photorealistic", aspectRatio: "3:2", tags: ["bread", "rustic"],
    prompt: "Freshly baked sourdough loaves and croissants on a floured wooden table, morning sunlight through a bakery window, dust in the light rays, warm rustic food photography" },
  { title: "Tropical smoothie bowl", category: "food", style: "product-photography", aspectRatio: "1:1", tags: ["healthy", "colorful"],
    prompt: "Top-down view of a vibrant acai smoothie bowl topped with mango, kiwi, berries, coconut flakes and granola on a pastel blue surface, bright even lighting, crisp detail" },
  // Fashion
  { title: "Editorial runway", category: "fashion", style: "photorealistic", aspectRatio: "2:3", featured: true, tags: ["editorial", "runway"],
    prompt: "High-fashion editorial photo of a model in a sculptural crimson gown walking on a misty minimalist runway, dramatic spotlight, motion in the fabric, magazine cover quality" },
  { title: "Streetwear lookbook", category: "fashion", style: "photorealistic", aspectRatio: "4:5", tags: ["streetwear", "urban"],
    prompt: "Streetwear lookbook shot of a person in an oversized pastel jacket and cargo pants leaning on a graffiti wall, overcast soft light, 35mm film look, candid pose" },
  { title: "Couture sketch", category: "fashion", style: "watercolor", aspectRatio: "2:3", tags: ["sketch", "design"],
    prompt: "Fashion illustration sketch of an elegant flowing evening dress, loose ink lines with watercolor washes in teal and gold, elongated figure proportions, designer sketchbook style" },
  // Animals
  { title: "Snow leopard portrait", category: "animals", style: "photorealistic", aspectRatio: "4:5", featured: true, tags: ["wildlife", "snow"],
    prompt: "Majestic snow leopard resting on a snowy rock ledge, piercing pale eyes looking at the camera, snowflakes falling, telephoto wildlife photography, extremely detailed fur" },
  { title: "Tiny explorer hedgehog", category: "animals", style: "3d-render", aspectRatio: "1:1", tags: ["cute", "adventure"],
    prompt: "Adorable hedgehog wearing a tiny explorer hat and backpack standing on a mossy log in a forest, soft morning light, tilt-shift miniature look, charming 3D render" },
  { title: "Koi pond from above", category: "animals", style: "watercolor", aspectRatio: "3:2", tags: ["koi", "water"],
    prompt: "Top-down view of orange and white koi fish swimming among lily pads, gentle ripples, loose watercolor style with soft bleeding colors" },
  // Abstract
  { title: "Liquid chrome", category: "abstract", style: "3d-render", aspectRatio: "1:1", featured: true, tags: ["chrome", "fluid"],
    prompt: "Abstract flowing liquid chrome sculpture with iridescent reflections of violet and blue, floating in a soft gradient void, smooth caustics, high-end 3D render" },
  { title: "Paper cut layers", category: "abstract", style: "minimalist", aspectRatio: "16:9", tags: ["paper", "layers"],
    prompt: "Layered paper-cut abstract landscape of flowing waves in shades of deep teal to coral, soft shadows between layers, minimalist and calming" },
  { title: "Bauhaus composition", category: "abstract", style: "digital-art", aspectRatio: "4:5", tags: ["bauhaus", "geometric"],
    prompt: "Bauhaus-inspired geometric composition of circles, half-moons and bold lines in primary red, yellow and blue on off-white, subtle print grain, balanced asymmetry" },
  // Game assets
  { title: "Fantasy potion icons", category: "game-assets", style: "digital-art", aspectRatio: "1:1", featured: true, tags: ["icons", "rpg"],
    prompt: "Set of stylized fantasy potion bottle game icons arranged in a grid, glowing red, blue and green liquids, ornate corks, clean dark background, hand-painted RPG inventory style" },
  { title: "Isometric tavern", category: "game-assets", style: "3d-render", aspectRatio: "1:1", tags: ["isometric", "building"],
    prompt: "Cozy isometric medieval tavern building with a thatched roof, warm glowing windows, barrels and a small garden, clean game asset on a plain background, stylized low-poly render" },
  { title: "Sci-fi character concept", category: "game-assets", style: "digital-art", aspectRatio: "2:3", tags: ["character", "concept"],
    prompt: "Full-body character concept of a sci-fi scavenger in patched armor with a glowing visor and a backpack full of salvaged tech, neutral pose, plain light background, game character design sheet" },
];
