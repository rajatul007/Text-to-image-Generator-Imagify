"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Coins, Dices, Info, Sparkles, Wand2 } from "lucide-react";
import { Button } from "../ui/button";
import { Field, Input, Select, Textarea } from "../ui/field";
import { Alert, EmptyState, Panel } from "../ui/misc";
import { Tooltip } from "../ui/tooltip";
import { SuggestionsDialog } from "../prompts/suggestions-dialog";
import { EnhancerPanel } from "./enhancer-panel";
import { JobCard } from "./job-card";
import { api, ApiClientError, newIdempotencyKey } from "@/lib/client/api";
import type { PublicModel } from "@/lib/ai/registry";
import type { SerializedJob } from "@/lib/queries/jobs";
import { cn } from "@/lib/utils";

export interface GeneratorDefaults {
  prompt?: string;
  enhancedPrompt?: string | null;
  negativePrompt?: string;
  style?: string | null;
  aspectRatio?: string;
  modelId?: string;
  numImages?: number;
  quality?: string;
  seed?: number | null;
}

interface Props {
  models: PublicModel[];
  styles: { id: string; label: string; swatch: string }[];
  aspectRatios: Record<string, { label: string; w: number; h: number }>;
  balance: number;
  verified: boolean;
  enhancerAvailable: boolean;
  defaults: GeneratorDefaults;
  recentJobs: SerializedJob[];
}

const MAX_SEED = 2_147_483_647;

export function Generator({ models, styles, aspectRatios, balance: initialBalance, verified, enhancerAvailable, defaults, recentJobs }: Props) {
  const router = useRouter();
  const firstAvailable = models.find((m) => m.available) ?? models[0];
  const [modelId, setModelId] = useState(() => (defaults.modelId && models.some((m) => m.id === defaults.modelId) ? defaults.modelId : firstAvailable?.id));
  const model = models.find((m) => m.id === modelId);
  const [prompt, setPrompt] = useState(defaults.enhancedPrompt ?? defaults.prompt ?? "");
  const [originalPrompt, setOriginalPrompt] = useState<string | null>(defaults.enhancedPrompt ? (defaults.prompt ?? null) : null);
  const [negativePrompt, setNegativePrompt] = useState(defaults.negativePrompt ?? "");
  const [style, setStyle] = useState<string | null>(defaults.style ?? null);
  const [aspectRatio, setAspectRatio] = useState(defaults.aspectRatio ?? "1:1");
  const [numImages, setNumImages] = useState(defaults.numImages ?? 1);
  const [quality, setQuality] = useState(defaults.quality ?? "standard");
  const [seedText, setSeedText] = useState(defaults.seed != null ? String(defaults.seed) : "");
  const [showEnhancer, setShowEnhancer] = useState(false);
  const [balance, setBalance] = useState(initialBalance);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<SerializedJob[]>(recentJobs);
  const pendingKey = useRef<string | null>(null);

  // Keep settings valid for the selected model.
  const ratio = model?.aspectRatios.includes(aspectRatio) ? aspectRatio : (model?.aspectRatios[0] ?? "1:1");
  const count = Math.min(numImages, model?.maxImages ?? 1);
  const q = model?.qualities.includes(quality) ? quality : "standard";
  const cost = model ? model.creditsPerImage * (q === "hd" ? model.hdMultiplier : 1) * count : 0;
  const seedValue = seedText.trim() === "" ? null : Number(seedText);
  const seedInvalid = seedValue !== null && (!Number.isInteger(seedValue) || seedValue < 0 || seedValue > MAX_SEED);
  const insufficient = cost > balance;

  const ratioOptions = useMemo(() => (model?.aspectRatios ?? []).map((r) => ({ id: r, ...(aspectRatios[r] ?? { label: r, w: 1, h: 1 }) })), [model, aspectRatios]);

  const applyEnhanced = (text: string) => {
    if (!originalPrompt) setOriginalPrompt(prompt);
    setPrompt(text);
    toast.success("Enhanced prompt applied – edit it freely");
  };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!model || submitting) return;
    if (!verified) return setError("Verify your email address to start generating.");
    if (prompt.trim().length < 3) return setError("Describe your image in at least a few words.");
    if (seedInvalid) return setError(`Seed must be a whole number between 0 and ${MAX_SEED.toLocaleString("en-IN")}.`);
    setError(null);
    setSubmitting(true);
    // The same key is reused if this exact submission is retried after a network error → no double charge.
    pendingKey.current ??= newIdempotencyKey();
    try {
      const res = await api<{ job: SerializedJob; balance: number; duplicate: boolean }>("/api/generations", {
        body: {
          modelId: model.id,
          prompt: originalPrompt ?? prompt,
          enhancedPrompt: originalPrompt ? prompt : null,
          negativePrompt: model.supportsNegativePrompt && negativePrompt.trim() ? negativePrompt.trim() : null,
          style,
          aspectRatio: ratio,
          quality: q,
          numImages: count,
          seed: model.supportsSeed ? seedValue : null,
          idempotencyKey: pendingKey.current,
        },
      });
      pendingKey.current = null;
      setBalance(res.balance);
      setJobs((js) => [res.job, ...js.filter((j) => j.id !== res.job.id)]);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.status < 500) pendingKey.current = null;
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const reuse = (job: SerializedJob) => {
    const m = models.find((x) => x.id === job.modelId);
    if (m) setModelId(m.id);
    setOriginalPrompt(job.enhancedPrompt ? job.prompt : null);
    setPrompt(job.enhancedPrompt ?? job.prompt);
    setNegativePrompt(job.userNegativePrompt ?? "");
    setStyle(job.style);
    if (job.aspectRatio) setAspectRatio(job.aspectRatio);
    setNumImages(job.numImages);
    setQuality(job.quality);
    setSeedText(job.seed != null ? String(job.seed) : "");
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast.success("Settings loaded – including the seed");
  };

  if (models.length === 0)
    return <EmptyState title="No image models are enabled" >An administrator needs to enable at least one model.</EmptyState>;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
      <form onSubmit={submit} className="space-y-5" noValidate>
        <Panel className="console space-y-3 border-0 p-4">
          <div className="flex items-center justify-between">
            <label htmlFor="prompt" className="text-sm font-medium">
              Prompt
            </label>
            <span className="text-xs text-faint tabular-nums">{prompt.length}/2000</span>
          </div>
          <Textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit();
            }}
            maxLength={2000}
            rows={5}
            placeholder="Describe what you want to see – subject, setting, lighting, mood…"
            className="min-h-32 text-[15px]"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={showEnhancer ? "primary" : "secondary"} size="sm" onClick={() => setShowEnhancer(!showEnhancer)} aria-expanded={showEnhancer}>
              <Wand2 className="size-4" /> Prompt enhancer
            </Button>
            <SuggestionsDialog
              onPick={(p) => {
                setPrompt(p.prompt);
                setOriginalPrompt(null);
                setStyle(p.style);
                setAspectRatio(p.aspectRatio);
                if (p.negativePrompt) setNegativePrompt(p.negativePrompt);
              }}
            />
          </div>
          {showEnhancer && (
            <EnhancerPanel
              prompt={prompt}
              style={style}
              available={enhancerAvailable}
              onApply={applyEnhanced}
              original={originalPrompt}
              onRevert={() => {
                if (originalPrompt) setPrompt(originalPrompt);
                setOriginalPrompt(null);
              }}
            />
          )}
        </Panel>

        <Panel className="space-y-5 p-4">
          <Field label="Model" htmlFor="model" hint={model ? `${model.creditsPerImage} credit${model.creditsPerImage === 1 ? "" : "s"} / image` : undefined}>
            <Select id="model" value={modelId} onChange={(e) => setModelId(e.target.value)}>
              {models.map((m) => (
                <option key={m.id} value={m.id} disabled={!m.available}>
                  {m.displayName}
                  {m.available ? "" : " – not configured"}
                </option>
              ))}
            </Select>
            {model?.description && <p className="mt-1.5 text-xs text-muted">{model.description}</p>}
            {model && !model.available && <p className="mt-1.5 text-xs text-warn">This model&apos;s provider isn&apos;t configured on the server. Choose another model.</p>}
          </Field>

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Style</legend>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3" role="radiogroup" aria-label="Style">
              <button type="button" role="radio" aria-checked={style === null} onClick={() => setStyle(null)} className={cn("rounded-lg border px-2 py-2 text-xs", style === null ? "border-violet bg-violet/12" : "border-line text-muted hover:text-text")}>
                None
              </button>
              {styles.map((s) => (
                <button key={s.id} type="button" role="radio" aria-checked={style === s.id} onClick={() => setStyle(s.id)} className={cn("flex items-center gap-1.5 rounded-lg border px-2 py-2 text-left text-xs", style === s.id ? "border-violet bg-violet/12 text-text" : "border-line text-muted hover:text-text")}>
                  <span className="size-3 shrink-0 rounded-full" style={{ background: s.swatch }} aria-hidden />
                  <span className="truncate">{s.label}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-1.5 flex w-full justify-between text-sm font-medium">
              Aspect ratio
              {ratioOptions.length <= 1 && <span className="text-xs font-normal text-faint">{model?.displayName} only supports square images</span>}
            </legend>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Aspect ratio">
              {ratioOptions.map((r) => (
                <button key={r.id} type="button" role="radio" aria-checked={ratio === r.id} onClick={() => setAspectRatio(r.id)} title={r.label} className={cn("flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs", ratio === r.id ? "border-violet bg-violet/12 text-text" : "border-line text-muted hover:text-text")}>
                  <span className="inline-block border border-current" style={{ width: Math.round((14 * r.w) / Math.max(r.w, r.h)), height: Math.round((14 * r.h) / Math.max(r.w, r.h)) }} aria-hidden />
                  {r.id}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Images" htmlFor="num">
              <Select id="num" value={count} onChange={(e) => setNumImages(Number(e.target.value))}>
                {Array.from({ length: model?.maxImages ?? 1 }).map((_, i) => (
                  <option key={i} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Quality" htmlFor="quality">
              <Select id="quality" value={q} onChange={(e) => setQuality(e.target.value)} disabled={(model?.qualities.length ?? 1) < 2}>
                {(model?.qualities ?? ["standard"]).map((x) => (
                  <option key={x} value={x}>
                    {x === "hd" ? `HD (×${model?.hdMultiplier} credits)` : "Standard"}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <details className="group rounded-xl border border-line p-3" open={Boolean(defaults.seed != null || defaults.negativePrompt)}>
            <summary className="cursor-pointer list-none text-sm font-medium [&::-webkit-details-marker]:hidden">
              Advanced settings <span className="text-xs font-normal text-faint">negative prompt, seed</span>
            </summary>
            <div className="mt-4 space-y-4">
              <Field label="Negative prompt" htmlFor="negative" hint={model?.supportsNegativePrompt ? "What to avoid" : "Not supported by this model"}>
                <Textarea id="negative" value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} disabled={!model?.supportsNegativePrompt} maxLength={1000} rows={2} placeholder={model?.supportsNegativePrompt ? "blurry, extra fingers, watermark, text" : `${model?.displayName ?? "This model"} doesn't accept negative prompts`} />
              </Field>
              <div>
                <Field label="Seed" htmlFor="seed" hint={model?.supportsSeed ? "Leave empty for random" : "Not supported by this model"} error={seedInvalid ? `Use a whole number from 0 to ${MAX_SEED}` : undefined}>
                  <div className="flex gap-2">
                    <Input id="seed" inputMode="numeric" value={model?.supportsSeed ? seedText : ""} onChange={(e) => setSeedText(e.target.value.replace(/[^\d]/g, ""))} disabled={!model?.supportsSeed} placeholder={model?.supportsSeed ? "Random" : "Unavailable"} aria-invalid={seedInvalid || undefined} />
                    <Tooltip content="Random seed">
                      <Button type="button" variant="secondary" size="icon" disabled={!model?.supportsSeed} onClick={() => setSeedText(String(crypto.getRandomValues(new Uint32Array(1))[0] & 0x7fffffff))} aria-label="Generate random seed">
                        <Dices className="size-4" />
                      </Button>
                    </Tooltip>
                    {seedText && model?.supportsSeed && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setSeedText("")}>
                        Clear
                      </Button>
                    )}
                  </div>
                </Field>
                <p className="mt-2 flex gap-1.5 text-xs text-muted">
                  <Info className="mt-0.5 size-3.5 shrink-0" />
                  {model?.supportsSeed
                    ? "The same seed with the same prompt, model version and settings usually reproduces an image – but results can still differ if the provider updates the model or any parameter changes. With several images, image n uses seed + n."
                    : `${model?.displayName ?? "This model"}'s API doesn't expose seeds, so results can't be reproduced exactly. Choose FLUX or a Stability model for seed control.`}
                </p>
              </div>
            </div>
          </details>
        </Panel>

        <div className="sticky bottom-3 z-10 space-y-3">
          {error && (
            <Alert tone="danger" action={insufficient ? <Button asChild size="sm" variant="secondary"><Link href="/credits">Buy credits</Link></Button> : undefined}>
              {error}
            </Alert>
          )}
          <Panel className="flex items-center justify-between gap-3 p-3 shadow-[var(--shadow)]">
            <div className="text-sm">
              <div className="flex items-center gap-1.5 font-medium tabular-nums">
                <Coins className="size-4 text-violet" /> {cost} credit{cost === 1 ? "" : "s"}
              </div>
              <div className={cn("text-xs tabular-nums", insufficient ? "text-danger" : "text-muted")}>
                {insufficient ? (
                  <>
                    Not enough credits ·{" "}
                    <Link href="/credits" className="underline">
                      top up
                    </Link>
                  </>
                ) : (
                  `${balance.toLocaleString("en-IN")} available`
                )}
              </div>
            </div>
            <Button type="submit" size="lg" loading={submitting} disabled={!model?.available || insufficient || !verified || submitting}>
              {!submitting && <Sparkles className="size-4" />} Generate
            </Button>
          </Panel>
        </div>
      </form>

      <section aria-label="Results" className="min-w-0 space-y-4">
        {jobs.length === 0 ? (
          <EmptyState icon={<Sparkles className="size-5" />} title="Your images will appear here" className="min-h-[420px]">
            Write a prompt, pick a style and press Generate. Every result is saved privately to your creations.
          </EmptyState>
        ) : (
          jobs.map((job) => (
            <JobCard
              key={job.id}
              initial={job}
              onReuse={reuse}
              onReuseSeed={(s) => {
                setSeedText(String(s));
                toast.success(`Seed ${s} loaded`);
              }}
              onBalance={setBalance}
              onRetried={(j) => setJobs((js) => [j, ...js])}
            />
          ))
        )}
      </section>
    </div>
  );
}
