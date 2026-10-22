"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Download, Globe, Heart, Images, PenTool, Repeat, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { Badge, EmptyState, Skeleton } from "../ui/misc";
import { Pagination } from "../ui/pagination";
import { Segmented } from "../ui/segmented";
import { useConfirm } from "../ui/dialog";
import { ImageViewer } from "../images/image-viewer";
import { DateInput, FilterSelect, SearchBox } from "./filters";
import { api } from "@/lib/client/api";
import type { OwnImage } from "@/lib/images/access";
import { useQueryState } from "@/hooks/use-query-state";
import { cn, formatDate } from "@/lib/utils";

const KEYS = ["q", "style", "model", "origin", "visibility", "from", "to", "sort", "view"] as const;

export function ImageLibrary({ favoritesOnly, styles, models }: { favoritesOnly?: boolean; styles: { id: string; label: string }[]; models: { id: string; displayName: string }[] }) {
  const [f, set, sp] = useQueryState(KEYS);
  const page = Number(sp.get("page") ?? 1) || 1;
  const openId = sp.get("open");
  const [q, setQ] = useState(f.q);
  const [data, setData] = useState<{ items: OwnImage[]; pages: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();
  const view = f.view === "list" ? "list" : "grid";

  // debounce search box → URL
  useEffect(() => {
    const t = setTimeout(() => q !== f.q && set({ q }), 300);
    return () => clearTimeout(t);
  }, [q, f.q, set]);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    for (const k of ["q", "style", "model", "origin", "visibility", "from", "to", "sort"] as const) if (f[k]) params.set(k, f[k]);
    if (favoritesOnly) params.set("favorites", "1");
    params.set("page", String(page));
    try {
      setError(null);
      setData(await api(`/api/images?${params}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [f, page, favoritesOnly]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetching on filter change
    void load();
  }, [load]);

  const patchItem = (img: OwnImage) => setData((d) => (d ? { ...d, items: d.items.map((i) => (i.id === img.id ? { ...i, ...img } : i)).filter((i) => !favoritesOnly || i.favorite) } : d));
  const removeItem = (id: string) => setData((d) => (d ? { ...d, items: d.items.filter((i) => i.id !== id), total: d.total - 1 } : d));

  const toggleFav = async (img: OwnImage) => {
    try {
      await api(`/api/images/${img.id}/favorite`, { method: img.favorite ? "DELETE" : "POST" });
      patchItem({ ...img, favorite: !img.favorite });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const toggleVisibility = async (img: OwnImage) => {
    try {
      const res = await api<{ image: OwnImage }>(`/api/images/${img.id}`, { method: "PATCH", body: { visibility: img.visibility === "PUBLIC" ? "PRIVATE" : "PUBLIC" } });
      patchItem({ ...img, ...res.image, favorite: img.favorite, shareToken: img.shareToken });
      toast.success(res.image.visibility === "PUBLIC" ? "Published to Explore" : "Image is private again");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const remove = async (img: OwnImage) => {
    if (!(await confirm({ title: "Delete this image?", description: "The file is permanently deleted and share links stop working.", confirmLabel: "Delete image", danger: true }))) return;
    try {
      await api(`/api/images/${img.id}`, { method: "DELETE" });
      removeItem(img.id);
      toast.success("Image deleted");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const hasFilters = KEYS.some((k) => k !== "view" && k !== "sort" && f[k]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchBox value={q} onChange={setQ} placeholder="Search by prompt" />
        <FilterSelect label="Style" value={f.style} onChange={(v) => set({ style: v })}>
          <option value="">All styles</option>
          {styles.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Model" value={f.model} onChange={(v) => set({ model: v })}>
          <option value="">All models</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.displayName}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Type" value={f.origin} onChange={(v) => set({ origin: v })}>
          <option value="">All types</option>
          <option value="GENERATED">Generated</option>
          <option value="EDITED">Edited</option>
          <option value="UPLOADED">Uploaded</option>
        </FilterSelect>
        <FilterSelect label="Visibility" value={f.visibility} onChange={(v) => set({ visibility: v })}>
          <option value="">Any visibility</option>
          <option value="PRIVATE">Private</option>
          <option value="PUBLIC">Public</option>
        </FilterSelect>
        <DateInput label="From date" value={f.from} onChange={(v) => set({ from: v })} />
        <DateInput label="To date" value={f.to} onChange={(v) => set({ to: v })} />
        <FilterSelect label="Sort" value={f.sort || "newest"} onChange={(v) => set({ sort: v === "newest" ? "" : v })}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </FilterSelect>
        <Segmented
          label="Layout"
          value={view}
          onChange={(v) => set({ view: v === "grid" ? "" : v, page: String(page) })}
          options={[
            { value: "grid", label: "Grid" },
            { value: "list", label: "List" },
          ]}
          className="ml-auto"
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {!data && !error && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
      )}
      {data && data.items.length === 0 && (
        <EmptyState
          icon={favoritesOnly ? <Heart className="size-5" /> : <Images className="size-5" />}
          title={hasFilters ? "No images match these filters" : favoritesOnly ? "No favorites yet" : "No creations yet"}
          action={
            hasFilters ? (
              <Button variant="secondary" onClick={() => set({ q: "", style: "", model: "", origin: "", visibility: "", from: "", to: "" })}>
                Clear filters
              </Button>
            ) : (
              <Button asChild>
                <Link href="/generate">Generate an image</Link>
              </Button>
            )
          }
        >
          {hasFilters ? "Try removing a filter or searching for a different word." : favoritesOnly ? "Tap the heart on any image to collect it here." : "Images you generate, edit or upload are saved here privately."}
        </EmptyState>
      )}

      {data && data.items.length > 0 && view === "grid" && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {data.items.map((img) => (
            <li key={img.id} className="group relative overflow-hidden rounded-xl border border-line bg-panel-2">
              <button type="button" className="block w-full" onClick={() => set({ open: img.id, page: String(page) })} aria-label="Open image details">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.thumbUrl} alt={img.prompt?.slice(0, 100) ?? "Uploaded image"} loading="lazy" className="aspect-square w-full object-cover" />
              </button>
              <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between p-2">
                {img.visibility === "PUBLIC" ? (
                  <Badge tone="ok" className="glass">
                    <Globe className="size-3" /> Public
                  </Badge>
                ) : (
                  <span />
                )}
                {img.favorite && <Heart className="size-4 fill-danger text-danger drop-shadow" aria-label="Favorite" />}
              </div>
              <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                <IconBtn label={img.favorite ? "Remove from favorites" : "Add to favorites"} onClick={() => toggleFav(img)}>
                  <Heart className={cn("size-4", img.favorite && "fill-current text-danger")} />
                </IconBtn>
                <IconLink label="Download" href={img.downloadUrl}>
                  <Download className="size-4" />
                </IconLink>
                <IconLink label="Edit" href={`/editor/${img.id}`} internal>
                  <PenTool className="size-4" />
                </IconLink>
                {img.job?.type === "GENERATE" && (
                  <IconLink label="Reuse settings" href={`/generate?fromJob=${img.job.id}&seed=${img.seed ?? ""}`} internal>
                    <Repeat className="size-4" />
                  </IconLink>
                )}
                <IconBtn label="Delete" onClick={() => remove(img)}>
                  <Trash2 className="size-4" />
                </IconBtn>
              </div>
            </li>
          ))}
        </ul>
      )}

      {data && data.items.length > 0 && view === "list" && (
        <ul className="divide-y divide-line rounded-[var(--radius-panel)] border border-line bg-panel">
          {data.items.map((img) => (
            <li key={img.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
              <button type="button" onClick={() => set({ open: img.id, page: String(page) })} className="shrink-0" aria-label="Open image details">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.thumbUrl} alt="" className="size-20 rounded-lg object-cover" loading="lazy" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm">{img.prompt ?? <span className="text-muted">Uploaded image</span>}</p>
                <p className="mt-1 text-xs text-faint">
                  {formatDate(img.createdAt, true)} · {img.width}×{img.height}
                  {img.seed != null && ` · seed ${img.seed}`}
                  {img.job && ` · ${img.job.modelVersion}`}
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                <Button variant="ghost" size="sm" onClick={() => toggleFav(img)} aria-pressed={img.favorite}>
                  <Heart className={cn("size-4", img.favorite && "fill-current text-danger")} />
                </Button>
                {img.prompt && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      void navigator.clipboard.writeText(img.prompt!);
                      toast.success("Prompt copied");
                    }}
                  >
                    <Copy className="size-4" /> Prompt
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => toggleVisibility(img)} disabled={img.moderationStatus === "REMOVED"}>
                  <Globe className="size-4" /> {img.visibility === "PUBLIC" ? "Make private" : "Publish"}
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <a href={img.downloadUrl}>
                    <Download className="size-4" />
                  </a>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => remove(img)} aria-label="Delete">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {data && <Pagination page={page} pages={data.pages} onChange={(p) => set({ page: String(p) })} />}
      {openId && <ImageViewer imageId={openId} open onOpenChange={(o) => !o && set({ open: "", page: String(page) })} onChanged={patchItem} onDeleted={removeItem} />}
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="glass grid size-8 place-items-center rounded-lg text-text">
      {children}
    </button>
  );
}
function IconLink({ label, href, children, internal }: { label: string; href: string; children: React.ReactNode; internal?: boolean }) {
  const cls = "glass grid size-8 place-items-center rounded-lg text-text";
  return internal ? (
    <Link href={href} aria-label={label} title={label} className={cls}>
      {children}
    </Link>
  ) : (
    <a href={href} aria-label={label} title={label} className={cls}>
      {children}
    </a>
  );
}
