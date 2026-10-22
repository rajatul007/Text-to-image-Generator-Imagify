"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { Button } from "../ui/button";
import { EmptyState, Skeleton } from "../ui/misc";
import { Pagination } from "../ui/pagination";
import { JobCard } from "../generate/job-card";
import { DateInput, FilterSelect, SearchBox } from "./filters";
import { api } from "@/lib/client/api";
import type { SerializedJob } from "@/lib/queries/jobs";
import { useQueryState } from "@/hooks/use-query-state";

const KEYS = ["q", "status", "type", "model", "style", "from", "to", "sort"] as const;

export function HistoryList({ models, styles }: { models: { id: string; displayName: string }[]; styles: { id: string; label: string }[] }) {
  const router = useRouter();
  const [f, set, sp] = useQueryState(KEYS);
  const page = Number(sp.get("page") ?? 1) || 1;
  const focus = sp.get("job");
  const [q, setQ] = useState(f.q);
  const [data, setData] = useState<{ items: SerializedJob[]; pages: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => q !== f.q && set({ q }), 300);
    return () => clearTimeout(t);
  }, [q, f.q, set]);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: "12" });
    for (const k of KEYS) if (f[k]) params.set(k, f[k]);
    try {
      setError(null);
      setData(await api(`/api/generations?${params}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [f, page]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetching on filter change
    void load();
  }, [load]);

  useEffect(() => {
    if (focus && data) document.getElementById(`job-${focus}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focus, data]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchBox value={q} onChange={setQ} placeholder="Search prompts" />
        <FilterSelect label="Status" value={f.status} onChange={(v) => set({ status: v })}>
          <option value="">Any status</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="QUEUED">Queued</option>
          <option value="PROCESSING">Processing</option>
        </FilterSelect>
        <FilterSelect label="Type" value={f.type} onChange={(v) => set({ type: v })}>
          <option value="">All types</option>
          <option value="GENERATE">Generations</option>
          <option value="EDIT">Edits</option>
          <option value="VARIATION">Variations</option>
          <option value="UPSCALE">Upscales</option>
          <option value="REMOVE_BACKGROUND">Background removal</option>
        </FilterSelect>
        <FilterSelect label="Model" value={f.model} onChange={(v) => set({ model: v })}>
          <option value="">All models</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.displayName}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Style" value={f.style} onChange={(v) => set({ style: v })}>
          <option value="">All styles</option>
          {styles.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </FilterSelect>
        <DateInput label="From date" value={f.from} onChange={(v) => set({ from: v })} />
        <DateInput label="To date" value={f.to} onChange={(v) => set({ to: v })} />
        <FilterSelect label="Sort" value={f.sort || "newest"} onChange={(v) => set({ sort: v === "newest" ? "" : v })}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </FilterSelect>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {!data && !error && (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      )}
      {data?.items.length === 0 && (
        <EmptyState icon={<Clock className="size-5" />} title="No generations found" action={<Button asChild><Link href="/generate">Generate an image</Link></Button>}>
          Every generation – successful, failed or cancelled – is recorded here with its prompt, seed, model version and cost.
        </EmptyState>
      )}
      {data && data.items.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.items.map((job) => (
            <div key={job.id} id={`job-${job.id}`} className={focus === job.id ? "rounded-[var(--radius-panel)] ring-2 ring-violet" : undefined}>
              <JobCard
                initial={job}
                compact
                onReuse={(j) => router.push(j.type === "GENERATE" ? `/generate?fromJob=${j.id}` : `/editor/${j.sourceImageId}`)}
                onRetried={(j) => {
                  setData((d) => (d ? { ...d, items: [j, ...d.items] } : d));
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            </div>
          ))}
        </div>
      )}
      {data && <Pagination page={page} pages={data.pages} onChange={(p) => set({ page: String(p) })} />}
    </div>
  );
}
