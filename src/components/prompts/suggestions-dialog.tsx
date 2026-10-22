"use client";

import { useEffect, useState } from "react";
import { Lightbulb, Search } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/field";
import { Skeleton } from "../ui/misc";
import { api } from "@/lib/client/api";
import { PROMPT_CATEGORIES, categoryLabel } from "@/data/prompt-categories";
import type { PromptTemplateItem } from "@/lib/queries/prompts";
import { cn } from "@/lib/utils";

export interface PickedPrompt {
  id: string;
  prompt: string;
  style: string;
  aspectRatio: string;
  negativePrompt: string | null;
}

/** Browsable prompt suggestions from the library; picking one loads it into the caller's form for editing. */
export function SuggestionsDialog({ onPick, trigger }: { onPick: (p: PickedPrompt) => void; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("");
  const [items, setItems] = useState<PromptTemplateItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      const params = new URLSearchParams({ sort: "trending", pageSize: "18" });
      if (q) params.set("q", q);
      if (category) params.set("category", category);
      setError(null);
      api<{ items: PromptTemplateItem[] }>(`/api/prompts/library?${params}`, { signal: ctrl.signal })
        .then((r) => setItems(r.items))
        .catch((e) => !ctrl.signal.aborted && setError(e.message));
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [open, q, category]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="secondary" size="sm" type="button">
            <Lightbulb className="size-4" /> Prompt suggestions
          </Button>
        )}
      </DialogTrigger>
      <DialogContent title="Prompt suggestions" description="Pick a starting point – you can edit it before generating." wide>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search prompts, e.g. dragon, ramen, neon" className="pl-9" aria-label="Search prompts" />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setCategory("")} className={cn("rounded-full border px-3 py-1 text-xs", !category ? "border-violet bg-violet/12 text-text" : "border-line text-muted hover:text-text")}>
            All
          </button>
          {PROMPT_CATEGORIES.map((c) => (
            <button key={c.id} type="button" onClick={() => setCategory(c.id)} className={cn("rounded-full border px-3 py-1 text-xs", category === c.id ? "border-violet bg-violet/12 text-text" : "border-line text-muted hover:text-text")}>
              {c.label}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {error && <p className="text-sm text-danger sm:col-span-2">{error}</p>}
          {!items && !error && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          {items?.length === 0 && <p className="py-8 text-center text-sm text-muted sm:col-span-2">No prompts match. Try another search.</p>}
          {items?.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                onPick({ id: t.id, prompt: t.prompt, style: t.style, aspectRatio: t.aspectRatio, negativePrompt: t.negativePrompt });
                void fetch(`/api/prompts/library/${t.id}/use`, { method: "POST" }).catch(() => undefined);
                setOpen(false);
              }}
              className="rounded-xl border border-line bg-panel-2 p-3 text-left transition-colors hover:border-violet/60"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{t.title}</span>
                <span className="text-xs text-faint">{categoryLabel(t.category)}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-muted">{t.prompt}</p>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
