"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { BookOpen, Copy, Heart, Plus, Sparkles } from "lucide-react";
import { Button } from "../ui/button";
import { Badge, EmptyState, Skeleton } from "../ui/misc";
import { Pagination } from "../ui/pagination";
import { Segmented } from "../ui/segmented";
import { Dialog, DialogContent, DialogTrigger } from "../ui/dialog";
import { Field, Input, Select, Textarea } from "../ui/field";
import { SearchBox } from "../library/filters";
import { api } from "@/lib/client/api";
import { PROMPT_CATEGORIES, categoryLabel } from "@/data/prompt-categories";
import type { PromptTemplateItem } from "@/lib/queries/prompts";
import { useQueryState } from "@/hooks/use-query-state";
import { cn } from "@/lib/utils";

const KEYS = ["q", "category", "sort", "favorites", "community"] as const;

export function PromptLibrary({ signedIn, styles, allowCommunity }: { signedIn: boolean; styles: { id: string; label: string; swatch: string }[]; allowCommunity: boolean }) {
  const router = useRouter();
  const [f, set, sp] = useQueryState(KEYS);
  const page = Number(sp.get("page") ?? 1) || 1;
  const [q, setQ] = useState(f.q);
  const [data, setData] = useState<{ items: PromptTemplateItem[]; pages: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sort = (f.sort || "trending") as "trending" | "recent" | "featured";

  useEffect(() => {
    const t = setTimeout(() => q !== f.q && set({ q }), 300);
    return () => clearTimeout(t);
  }, [q, f.q, set]);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), sort });
    if (f.q) params.set("q", f.q);
    if (f.category) params.set("category", f.category);
    if (f.favorites) params.set("favorites", "1");
    if (f.community) params.set("community", "1");
    try {
      setError(null);
      setData(await api(`/api/prompts/library?${params}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [f, page, sort]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetching on filter change
    void load();
  }, [load]);

  const use = (t: PromptTemplateItem) => {
    void fetch(`/api/prompts/library/${t.id}/use`, { method: "POST" }).catch(() => undefined);
    const target = `/generate?${new URLSearchParams({ prompt: t.prompt, style: t.style, aspectRatio: t.aspectRatio })}`;
    router.push(signedIn ? target : `/signup?next=${encodeURIComponent(target)}`);
  };

  const toggleFav = async (t: PromptTemplateItem) => {
    if (!signedIn) return router.push("/login?next=/prompt-library");
    setData((d) => (d ? { ...d, items: d.items.map((x) => (x.id === t.id ? { ...x, favorite: !t.favorite } : x)) } : d));
    try {
      await api(`/api/prompts/library/${t.id}/favorite`, { method: t.favorite ? "DELETE" : "POST" });
      if (f.favorites && t.favorite) setData((d) => (d ? { ...d, items: d.items.filter((x) => x.id !== t.id) } : d));
    } catch (e) {
      toast.error((e as Error).message);
      setData((d) => (d ? { ...d, items: d.items.map((x) => (x.id === t.id ? { ...x, favorite: t.favorite } : x)) } : d));
    }
  };

  const swatch = (id: string) => styles.find((s) => s.id === id)?.swatch;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchBox value={q} onChange={setQ} placeholder="Search prompts by keyword" />
        <Segmented
          label="Sort"
          value={sort}
          onChange={(v) => set({ sort: v === "trending" ? "" : v })}
          options={[
            { value: "trending", label: "Trending" },
            { value: "recent", label: "Recently added" },
            { value: "featured", label: "Featured" },
          ]}
        />
        {signedIn && (
          <Button variant={f.favorites ? "primary" : "secondary"} size="sm" onClick={() => set({ favorites: f.favorites ? "" : "1" })} aria-pressed={Boolean(f.favorites)}>
            <Heart className="size-4" /> My favorites
          </Button>
        )}
        {allowCommunity && (
          <Button variant={f.community ? "primary" : "secondary"} size="sm" onClick={() => set({ community: f.community ? "" : "1" })} aria-pressed={Boolean(f.community)}>
            Community
          </Button>
        )}
        {signedIn && allowCommunity && <SharePromptDialog styles={styles} onCreated={load} />}
      </div>
      <div className="mb-6 flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        <button onClick={() => set({ category: "" })} className={cn("shrink-0 rounded-full border px-3 py-1 text-sm", !f.category ? "border-violet bg-violet/12" : "border-line text-muted hover:text-text")}>
          All categories
        </button>
        {PROMPT_CATEGORIES.map((c) => (
          <button key={c.id} onClick={() => set({ category: c.id })} className={cn("shrink-0 rounded-full border px-3 py-1 text-sm", f.category === c.id ? "border-violet bg-violet/12" : "border-line text-muted hover:text-text")}>
            {c.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {!data && !error && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      )}
      {data?.items.length === 0 && (
        <EmptyState icon={<BookOpen className="size-5" />} title={f.favorites ? "No favorite prompts yet" : "No prompts match"}>
          {f.favorites ? "Tap the heart on a prompt to save it here." : "Try a different keyword or category."}
        </EmptyState>
      )}
      {data && data.items.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((t) => (
            <li key={t.id} className="flex flex-col overflow-hidden rounded-[var(--radius-panel)] border border-line bg-panel">
              {t.previewImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.previewImageUrl} alt={`Preview for ${t.title}`} className="aspect-[16/9] w-full object-cover" loading="lazy" />
              ) : (
                <div className="h-1.5" style={{ background: swatch(t.style) }} aria-hidden />
              )}
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-medium">{t.title}</h3>
                    <p className="text-xs text-faint">
                      {categoryLabel(t.category)} · {styles.find((s) => s.id === t.style)?.label ?? t.style} · {t.aspectRatio}
                      {t.author && ` · by @${t.author.username}`}
                    </p>
                  </div>
                  <button onClick={() => toggleFav(t)} aria-pressed={t.favorite} aria-label={t.favorite ? "Remove from favorites" : "Add to favorites"} className="rounded-lg p-1.5 text-muted hover:bg-panel-2 hover:text-text">
                    <Heart className={cn("size-4", t.favorite && "fill-danger text-danger")} />
                  </button>
                </div>
                <p className="mt-2 line-clamp-4 flex-1 text-sm leading-relaxed text-muted">{t.prompt}</p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="flex gap-1">
                    {t.featured && <Badge tone="violet">Featured</Badge>}
                    {t.usageCount > 0 && <Badge>{t.usageCount} uses</Badge>}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        void navigator.clipboard.writeText(t.prompt);
                        toast.success("Prompt copied");
                      }}
                    >
                      <Copy className="size-4" /> Copy
                    </Button>
                    <Button size="sm" onClick={() => use(t)}>
                      <Sparkles className="size-4" /> Use
                    </Button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {data && <Pagination page={page} pages={data.pages} onChange={(p) => set({ page: String(p) })} />}
      {!signedIn && (
        <p className="mt-8 text-center text-sm text-muted">
          <Link href="/signup?next=/prompt-library" className="text-violet hover:underline">
            Create a free account
          </Link>{" "}
          to save favorites and generate from any prompt.
        </p>
      )}
    </div>
  );
}

function SharePromptDialog({ styles, onCreated }: { styles: { id: string; label: string }[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", prompt: "", category: "portraits", style: "digital-art", aspectRatio: "1:1" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api("/api/prompts/library", { body: form });
      toast.success("Prompt shared with the community");
      setOpen(false);
      setForm({ ...form, title: "", prompt: "" });
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <Plus className="size-4" /> Share a prompt
        </Button>
      </DialogTrigger>
      <DialogContent title="Share a prompt" description="Public prompts appear in the library with your username.">
        <form onSubmit={submit} className="space-y-4">
          {error && <p className="text-sm text-danger">{error}</p>}
          <Field label="Title" htmlFor="pt-title">
            <Input id="pt-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={80} required />
          </Field>
          <Field label="Prompt" htmlFor="pt-prompt">
            <Textarea id="pt-prompt" value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} maxLength={2000} rows={5} required />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Category" htmlFor="pt-cat">
              <Select id="pt-cat" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {PROMPT_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Style" htmlFor="pt-style">
              <Select id="pt-style" value={form.style} onChange={(e) => setForm({ ...form, style: e.target.value })}>
                {styles.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Ratio" htmlFor="pt-ratio">
              <Select id="pt-ratio" value={form.aspectRatio} onChange={(e) => setForm({ ...form, aspectRatio: e.target.value })}>
                {["1:1", "4:5", "2:3", "9:16", "3:2", "16:9"].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Button type="submit" className="w-full" loading={loading}>
            Share prompt
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
