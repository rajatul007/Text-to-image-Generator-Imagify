"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, Copy, Download, PenTool, RefreshCw, Repeat, X } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/misc";
import { Tooltip } from "../ui/tooltip";
import { useConfirm } from "../ui/dialog";
import { ImageViewer } from "../images/image-viewer";
import { api, newIdempotencyKey } from "@/lib/client/api";
import { isActive, useJobPolling } from "@/hooks/use-job";
import type { SerializedJob } from "@/lib/queries/jobs";
import { cn, timeAgo } from "@/lib/utils";

const STAGES = [
  { key: "QUEUED", label: "Queued" },
  { key: "PROCESSING", label: "Generating" },
  { key: "UPLOADING", label: "Saving" },
  { key: "COMPLETED", label: "Done" },
] as const;

const TYPE_LABEL: Record<string, string> = { GENERATE: "Generation", EDIT: "Edit", VARIATION: "Variations", UPSCALE: "Upscale", REMOVE_BACKGROUND: "Background removal" };

export function StatusBadge({ status }: { status: SerializedJob["status"] }) {
  const map = {
    QUEUED: ["neutral", "Queued"],
    PROCESSING: ["violet", "Generating"],
    UPLOADING: ["blue", "Saving"],
    COMPLETED: ["ok", "Completed"],
    FAILED: ["danger", "Failed"],
    CANCELLED: ["neutral", "Cancelled"],
  } as const;
  const [tone, label] = map[status];
  return <Badge tone={tone}>{label}</Badge>;
}

function Stepper({ status }: { status: SerializedJob["status"] }) {
  const idx = STAGES.findIndex((s) => s.key === status);
  return (
    <ol className="flex items-center gap-2 text-xs" aria-label="Progress">
      {STAGES.map((s, i) => (
        <li key={s.key} className="flex items-center gap-2" aria-current={i === idx ? "step" : undefined}>
          <span className={cn("grid size-5 place-items-center rounded-full border text-[10px]", i < idx ? "border-ok bg-ok/15 text-ok" : i === idx ? "border-violet text-violet" : "border-line text-faint")}>
            {i < idx ? <Check className="size-3" /> : i + 1}
          </span>
          <span className={cn(i === idx ? "text-text" : "text-faint", "hidden sm:inline")}>{s.label}</span>
          {i < STAGES.length - 1 && <span className={cn("h-px w-4 sm:w-6", i < idx ? "bg-ok" : "bg-line")} />}
        </li>
      ))}
    </ol>
  );
}

export function JobCard({
  initial,
  onReuse,
  onReuseSeed,
  onBalance,
  onRetried,
  onDone,
  compact,
}: {
  initial: SerializedJob;
  onReuse?: (job: SerializedJob) => void;
  onReuseSeed?: (seed: number) => void;
  onBalance?: (b: number) => void;
  onRetried?: (job: SerializedJob) => void;
  onDone?: (job: SerializedJob) => void;
  compact?: boolean;
}) {
  const confirm = useConfirm();
  const { job, setJob, pollError } = useJobPolling(initial, (done) => {
    if (done.status === "COMPLETED") toast.success(done.type === "GENERATE" ? "Your images are ready" : "Your edit is ready");
    else if (done.status === "FAILED") toast.error(done.errorMessage ?? "Generation failed. Your credits were refunded.");
    void api<{ balance: number }>("/api/credits").then((r) => onBalance?.(r.balance)).catch(() => undefined);
    onDone?.(done);
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);

  const cancel = async () => {
    if (!(await confirm({ title: "Cancel this generation?", description: `It hasn't started yet, so ${job.creditsCharged} credits will be refunded.`, confirmLabel: "Cancel generation", cancelLabel: "Keep it" }))) return;
    setBusy("cancel");
    try {
      const res = await api<{ job: SerializedJob; balance: number }>(`/api/generations/${job.id}/cancel`, { method: "POST" });
      setJob(res.job);
      onBalance?.(res.balance);
      toast.success("Generation cancelled and credits refunded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const retry = async (newSeed: boolean) => {
    setBusy(newSeed ? "regen" : "retry");
    try {
      const res = await api<{ job: SerializedJob; balance: number }>(`/api/generations/${job.id}/retry`, { body: { idempotencyKey: newIdempotencyKey(), newSeed } });
      onBalance?.(res.balance);
      onRetried?.(res.job);
      toast.success(newSeed ? "Regenerating with a new seed" : "Started again with the same settings");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const active = isActive(job);
  const ratio = job.aspectRatio?.split(":").map(Number) ?? [1, 1];

  return (
    <article className="rounded-[var(--radius-panel)] border border-line bg-panel p-4" aria-live="polite">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={job.status} />
            <span className="text-xs text-faint">
              {TYPE_LABEL[job.type]} · {job.modelName} · {timeAgo(job.createdAt)}
            </span>
          </div>
          <p className={cn("mt-2 text-sm", compact ? "line-clamp-2" : "line-clamp-3")}>{job.enhancedPrompt ?? job.prompt}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          {job.status === "QUEUED" && (
            <Button variant="ghost" size="sm" onClick={cancel} loading={busy === "cancel"}>
              <X className="size-4" /> Cancel
            </Button>
          )}
          {onReuse && !active && (
            <Tooltip content="Load these settings into the form">
              <Button variant="ghost" size="sm" onClick={() => onReuse(job)}>
                <Repeat className="size-4" /> Reuse settings
              </Button>
            </Tooltip>
          )}
        </div>
      </header>

      {active && (
        <div className="mt-4 space-y-3">
          <Stepper status={job.status} />
          <div className="indeterminate h-1.5 rounded-full bg-panel-2" role="progressbar" aria-label="Working" aria-valuetext={job.status.toLowerCase()} />
          <p className="text-xs text-muted">
            {job.status === "QUEUED" && job.attempts > 0
              ? `Retrying after a temporary problem (attempt ${job.attempts + 1} of ${job.maxAttempts}).`
              : job.status === "QUEUED"
                ? "Waiting for a free worker…"
                : job.status === "PROCESSING"
                  ? `The model is working on ${job.numImages > 1 ? `${job.numImages} images` : "your image"}. This usually takes a few seconds to a minute.`
                  : "Saving to your private gallery…"}
            {pollError && <span className="text-warn"> Connection hiccup – still checking.</span>}
          </p>
          <div className={cn("grid gap-2", job.numImages > 1 ? "grid-cols-2" : "grid-cols-1")}>
            {Array.from({ length: job.numImages }).map((_, i) => (
              <div key={i} className="skeleton rounded-xl" style={{ aspectRatio: `${ratio[0] || 1}/${ratio[1] || 1}`, maxHeight: 420 }} />
            ))}
          </div>
        </div>
      )}

      {job.status === "FAILED" && (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-danger/30 bg-danger/8 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex gap-2 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
            <span>
              {job.errorMessage ?? "Generation failed."} <span className="text-muted">{job.creditsCharged} credits were refunded. Your prompt is kept.</span>
            </span>
          </p>
          <Button variant="secondary" size="sm" onClick={() => retry(false)} loading={busy === "retry"}>
            <RefreshCw className="size-4" /> Try again
          </Button>
        </div>
      )}

      {job.status === "COMPLETED" && job.images.length > 0 && (
        <div className="mt-4">
          <div className={cn("grid gap-2", job.images.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
            {job.images.map((img, i) => (
              <figure key={img.id} className="group relative overflow-hidden rounded-xl border border-line bg-panel-2">
                <button type="button" onClick={() => setViewer(i)} className="block w-full" aria-label={`View image ${i + 1}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.thumbUrl} alt={`Result ${i + 1}: ${job.prompt.slice(0, 80)}`} width={img.width} height={img.height} className="h-auto w-full" style={{ aspectRatio: `${img.width}/${img.height}` }} />
                </button>
                <figcaption className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                  {img.seed != null ? (
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(String(img.seed));
                        toast.success(`Seed ${img.seed} copied`);
                      }}
                      className="glass flex items-center gap-1 rounded-lg px-2 py-1 text-xs"
                      title="Copy seed"
                    >
                      <Copy className="size-3" /> {img.seed}
                    </button>
                  ) : (
                    <span />
                  )}
                  <span className="flex gap-1">
                    <a href={img.downloadUrl} className="glass grid size-8 place-items-center rounded-lg" aria-label="Download">
                      <Download className="size-4" />
                    </a>
                    <Link href={`/editor/${img.id}`} className="glass grid size-8 place-items-center rounded-lg" aria-label="Edit">
                      <PenTool className="size-4" />
                    </Link>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
          <footer className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <span>
              {job.modelVersion} · {job.aspectRatio ?? "original size"} · {job.creditsCharged} credits
              {job.seed != null && ` · seed ${job.seed}${job.numImages > 1 ? `–${job.seed + job.numImages - 1}` : ""}`}
            </span>
            <span className="flex gap-1">
              {onReuseSeed && job.seed != null && (
                <Button variant="ghost" size="sm" onClick={() => onReuseSeed(job.seed!)}>
                  Reuse seed
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => retry(false)} loading={busy === "retry"}>
                <RefreshCw className="size-4" /> {job.seed != null ? "Same seed" : "Regenerate"}
              </Button>
              {job.seed != null && (
                <Button variant="ghost" size="sm" onClick={() => retry(true)} loading={busy === "regen"}>
                  New seed
                </Button>
              )}
            </span>
          </footer>
        </div>
      )}
      {job.status === "COMPLETED" && job.images.length === 0 && <p className="mt-3 text-sm text-muted">The images from this generation were deleted.</p>}
      {viewer !== null && job.images[viewer] && <ImageViewer imageId={job.images[viewer].id} open onOpenChange={(o) => !o && setViewer(null)} />}
    </article>
  );
}
