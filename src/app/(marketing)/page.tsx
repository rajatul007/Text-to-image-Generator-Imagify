import Link from "next/link";
import { ImageIcon, Lock, RefreshCw, Share2, Sliders, Wand2 } from "lucide-react";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth/current";
import { serializePublicImage } from "@/lib/images/access";
import { publicImageWhere } from "@/lib/queries/images";
import { STYLES } from "@/lib/ai/styles";
import { llmConfigured } from "@/lib/ai/llm";
import { getSettings } from "@/lib/settings";
import { PROMPT_CATEGORIES } from "@/data/prompt-categories";
import { HeroConsole } from "@/components/home/hero-console";
import { PricingCards } from "@/components/home/pricing-cards";
import { Faq } from "@/components/home/faq";
import { PublicImageGrid } from "@/components/images/public-image-grid";
import { Button } from "@/components/ui/button";
import { SEED_TEMPLATES } from "@/data/prompt-templates";

export const dynamic = "force-dynamic";

const include = { user: { select: { name: true, profile: { select: { username: true, displayName: true, avatarKey: true } } } } } as const;

export default async function HomePage() {
  const user = await currentUser();
  const [featured, recent, packages, settings, categoryCounts] = await Promise.all([
    db.generatedImage.findMany({ where: publicImageWhere(), orderBy: [{ likeCount: "desc" }, { publishedAt: "desc" }], take: 12, include }),
    db.generatedImage.findMany({ where: publicImageWhere(), orderBy: { publishedAt: "desc" }, take: 8, include }),
    db.creditPackage.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    getSettings(),
    db.promptTemplate.groupBy({ by: ["category"], where: { status: "PUBLISHED", isPublic: true }, _count: { _all: true } }),
  ]);
  const featuredIds = new Set(featured.map((f) => f.id));
  const fresh = recent.filter((r) => !featuredIds.has(r.id)).slice(0, 8);
  const starterPrompts = SEED_TEMPLATES.filter((t) => t.featured).slice(0, 6);

  return (
    <>
      {/* Hero: the prompt console is the product, so it is the hero. */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-[520px] max-w-5xl rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--violet)_22%,transparent),transparent)] blur-2xl" />
        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-16 text-center sm:px-6 sm:pt-24">
          <h1 className="font-display mx-auto max-w-4xl text-[clamp(2.5rem,7vw,5.25rem)] font-bold leading-[0.95] tracking-[-0.035em]">Turn Your Imagination Into Reality.</h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted sm:text-lg">
            Describe it, refine it with the prompt enhancer, and generate it with leading image models. {settings.welcomeCredits > 0 ? `New accounts get ${settings.welcomeCredits} free credits after verifying their email.` : ""}
          </p>
          <div className="mt-10">
            <HeroConsole signedIn={Boolean(user)} verified={Boolean(user?.emailVerified)} enhancerAvailable={llmConfigured()} styles={STYLES.map(({ id, label }) => ({ id, label }))} />
          </div>
          <p className="mt-4 text-xs text-faint">Tip: press Ctrl + Enter to generate.</p>
        </div>
      </section>

      {/* Community + sample gallery */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6" aria-labelledby="gallery-heading">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 id="gallery-heading" className="font-display text-2xl font-semibold sm:text-3xl">
              Made by the community
            </h2>
            <p className="mt-1 text-sm text-muted">Images creators chose to publish. Open one to see its prompt and settings.</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/explore">Browse Explore</Link>
          </Button>
        </div>
        {featured.length > 0 ? (
          <PublicImageGrid images={featured.map((f) => serializePublicImage(f))} />
        ) : (
          <div className="rounded-[var(--radius-panel)] border border-dashed border-line p-6 sm:p-8">
            <p className="max-w-xl text-sm text-muted">The public gallery is empty right now – every image starts private. Here are a few prompts from the library to try first:</p>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {starterPrompts.map((t) => (
                <li key={t.title}>
                  <Link href={`/generate?prompt=${encodeURIComponent(t.prompt)}&style=${t.style}`} className="block h-full rounded-xl border border-line bg-panel p-4 hover:border-violet/60">
                    <span className="text-sm font-medium">{t.title}</span>
                    <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted">{t.prompt}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        {fresh.length > 0 && (
          <div className="mt-12">
            <h3 className="font-display mb-4 text-xl font-semibold">Recently published</h3>
            <PublicImageGrid images={fresh.map((f) => serializePublicImage(f))} className="lg:columns-4" />
          </div>
        )}
      </section>

      {/* Styles & categories */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6" aria-labelledby="styles-heading">
        <h2 id="styles-heading" className="font-display text-2xl font-semibold sm:text-3xl">
          Twelve styles, one click each
        </h2>
        <p className="mt-1 text-sm text-muted">Pick a style and we add the right lighting, medium and finish to your prompt.</p>
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {STYLES.map((s) => (
            <li key={s.id}>
              <Link href={`/generate?style=${s.id}`} className="group block overflow-hidden rounded-xl border border-line bg-panel hover:border-violet/60">
                <div className="h-16 transition-transform duration-500 group-hover:scale-105" style={{ background: s.swatch }} aria-hidden />
                <div className="px-3 py-2 text-sm font-medium">{s.label}</div>
              </Link>
            </li>
          ))}
        </ul>
        <h3 className="font-display mt-12 text-xl font-semibold">Browse prompts by category</h3>
        <ul className="mt-4 flex flex-wrap gap-2">
          {PROMPT_CATEGORIES.map((c) => (
            <li key={c.id}>
              <Link href={`/prompt-library?category=${c.id}`} className="inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3.5 py-1.5 text-sm text-muted hover:border-violet/60 hover:text-text">
                {c.label}
                <span className="text-xs text-faint tabular-nums">{categoryCounts.find((x) => x.category === c.id)?._count._all ?? 0}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* How it works – a genuine sequence */}
      <section id="how-it-works" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-14 sm:px-6" aria-labelledby="how-heading">
        <h2 id="how-heading" className="font-display text-2xl font-semibold sm:text-3xl">
          How it works
        </h2>
        <ol className="mt-8 grid gap-6 md:grid-cols-4">
          {[
            ["Describe", "Write an idea in plain words, or start from the prompt library."],
            ["Enhance", "Let the enhancer add lighting, camera and mood. Edit anything you like."],
            ["Generate", "Choose a model, style, aspect ratio and seed. You see the credit cost before you start."],
            ["Refine & share", "Edit, upscale or remove backgrounds, compare before and after, then publish or share a private link."],
          ].map(([t, d], i) => (
            <li key={t} className="relative pl-12">
              <span className="font-display absolute left-0 top-0 grid size-9 place-items-center rounded-full border border-line bg-panel text-sm font-semibold text-violet">{i + 1}</span>
              <h3 className="font-semibold">{t}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6" aria-labelledby="features-heading">
        <h2 id="features-heading" className="font-display text-2xl font-semibold sm:text-3xl">
          Built for iterating, not just generating
        </h2>
        <div className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {[
            [Wand2, "Prompt enhancer", "Concise, detailed, cinematic, realistic and artistic modes, with several alternatives to compare."],
            [Sliders, "Real controls", "Negative prompts, aspect ratios, image count, quality and seeds – only where the selected model supports them."],
            [RefreshCw, "Reproducible", "Every image keeps its seed, model version and settings. Reuse them with one click."],
            [ImageIcon, "Editing workspace", "Edit with text, make variations, upscale and remove backgrounds. Every version is kept with its lineage."],
            [Lock, "Private by default", "Images are stored privately and served only to you until you publish or share them."],
            [Share2, "Share on your terms", "Choose whether a share link shows your prompt and name. Revoke it whenever you want."],
          ].map(([Icon, t, d]) => {
            const I = Icon as typeof Wand2;
            return (
              <div key={t as string} className="flex gap-4">
                <I className="mt-0.5 size-5 shrink-0 text-violet" aria-hidden />
                <div>
                  <h3 className="font-semibold">{t as string}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{d as string}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-14 sm:px-6" aria-labelledby="pricing-heading">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="pricing-heading" className="font-display text-2xl font-semibold sm:text-3xl">
              Pay for what you create
            </h2>
            <p className="mt-1 text-sm text-muted">Start free with {settings.welcomeCredits} credits. Top up with one-time packs, or subscribe for monthly credits.</p>
          </div>
          <Link href="/pricing" className="text-sm text-violet hover:underline">
            Compare plans and credit costs
          </Link>
        </div>
        <PricingCards packages={packages} />
      </section>

      <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6" aria-labelledby="faq-heading">
        <h2 id="faq-heading" className="font-display mb-6 text-2xl font-semibold sm:text-3xl">
          Questions, answered
        </h2>
        <Faq />
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="console flex flex-col items-start gap-5 p-8 sm:flex-row sm:items-center sm:justify-between sm:p-10">
          <div>
            <h2 className="font-display text-2xl font-semibold sm:text-3xl">Your first image is a sentence away.</h2>
            <p className="mt-1 text-sm text-muted">Create an account, verify your email, and start with free credits.</p>
          </div>
          <div className="flex gap-2">
            {user ? (
              <Button asChild size="lg">
                <Link href="/generate">Start generating</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="secondary" size="lg">
                  <Link href="/login">Log in</Link>
                </Button>
                <Button asChild size="lg">
                  <Link href="/signup">Create free account</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
