"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Compass, X } from "lucide-react";
import { Button } from "../ui/button";
import { EmptyState, Skeleton } from "../ui/misc";
import { Segmented } from "../ui/segmented";
import { PublicImageGrid } from "../images/public-image-grid";
import { FilterSelect, SearchBox } from "../library/filters";
import { api } from "@/lib/client/api";
import type { PublicImage } from "@/lib/images/access";
import { useQueryState } from "@/hooks/use-query-state";
import { cn } from "@/lib/utils";

const KEYS = ["q", "style", "sort", "creator", "model"] as const;

export function ExploreGallery({ styles, models }: { styles: { id: string; label: string }[]; models: { id: string; displayName: string }[] }) {
  const [f, set] = useQueryState(KEYS);
  const [q, setQ] = useState(f.q);
  const [items, setItems] = useState<PublicImage[] | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sort = (f.sort || "trending") as "trending" | "recent" | "top";

  useEffect(() => {
    const t = setTimeout(() => q !== f.q && set({ q }), 300);
    return () => clearTimeout(t);
  }, [q, f.q, set]);

  const fetchPage = useCallback(
    async (p: number) => {
      const params = new URLSearchParams({ sort, page: String(p) });
      for (const k of ["q", "style", "creator", "model"] as const) if (f[k]) params.set(k, f[k]);
      return api<{ items: PublicImage[]; pages: number }>(`/api/explore?${params}`);
    },
    [f, sort],
  );

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when filters change
    setItems(null);
    setError(null);
    fetchPage(1)
      .then((r) => {
        if (cancelled) return;
        setItems(r.items);
        setPages(r.pages);
        setPage(1);
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [fetchPage]);

  const more = async () => {
    setLoadingMore(true);
    try {
      const r = await fetchPage(page + 1);
      setItems((xs) => [...(xs ?? []), ...r.items.filter((i) => !xs?.some((x) => x.id === i.id))]);
      setPage(page + 1);
      setPages(r.pages);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchBox value={q} onChange={setQ} placeholder="Search public prompts" />
        <Segmented
          label="Sort"
          value={sort}
          onChange={(v) => set({ sort: v === "trending" ? "" : v })}
          options={[
            { value: "trending", label: "Trending" },
            { value: "recent", label: "Recent" },
            { value: "top", label: "Most liked" },
          ]}
        />
        <FilterSelect label="Model" value={f.model} onChange={(v) => set({ model: v })}>
          <option value="">All models</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.displayName}
            </option>
          ))}
        </FilterSelect>
        {f.creator && (
          <button onClick={() => set({ creator: "" })} className="flex items-center gap-1 rounded-full border border-violet bg-violet/12 px-3 py-1.5 text-sm">
            @{f.creator} <X className="size-3.5" aria-label="Clear creator filter" />
          </button>
        )}
      </div>
      <div className="mb-6 flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin" aria-label="Popular styles">
        <button onClick={() => set({ style: "" })} className={cn("shrink-0 rounded-full border px-3 py-1 text-sm", !f.style ? "border-violet bg-violet/12" : "border-line text-muted hover:text-text")}>
          All styles
        </button>
        {styles.map((s) => (
          <button key={s.id} onClick={() => set({ style: s.id })} className={cn("shrink-0 rounded-full border px-3 py-1 text-sm", f.style === s.id ? "border-violet bg-violet/12" : "border-line text-muted hover:text-text")}>
            {s.label}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {!items && !error && (
        <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className={cn("mb-3 break-inside-avoid", i % 3 === 0 ? "h-72" : i % 3 === 1 ? "h-48" : "h-60")} />
          ))}
        </div>
      )}
      {items?.length === 0 && (
        <EmptyState icon={<Compass className="size-5" />} title="Nothing here yet" action={<Button asChild><Link href="/generate">Create and publish an image</Link></Button>}>
          Only images their creators chose to publish appear in Explore.
        </EmptyState>
      )}
      {items && items.length > 0 && <PublicImageGrid images={items} />}
      {items && page < pages && (
        <div className="mt-6 flex justify-center">
          <Button variant="secondary" onClick={more} loading={loadingMore}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
