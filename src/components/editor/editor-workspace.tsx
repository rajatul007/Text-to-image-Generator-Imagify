"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Download, Eraser, Layers, Maximize, PenTool, Shuffle, Sparkles } from "lucide-react";
import { Button } from "../ui/button";
import { Field, Input, Select, Textarea } from "../ui/field";
import { Alert, Badge, Panel } from "../ui/misc";
import { CompareSlider } from "./compare-slider";
import { JobCard } from "../generate/job-card";
import { api, ApiClientError, newIdempotencyKey } from "@/lib/client/api";
import type { PublicModel } from "@/lib/ai/registry";
import type { OwnImage } from "@/lib/images/access";
import type { SerializedJob } from "@/lib/queries/jobs";
import { cn, formatDate } from "@/lib/utils";

type Op = "EDIT" | "VARIATION" | "UPSCALE" | "REMOVE_BACKGROUND";
const OPS: { id: Op; label: string; kind: PublicModel["kind"]; icon: typeof PenTool; help: string }[] = [
  { id: "EDIT", label: "Edit with text", kind: "IMAGE_EDIT", icon: PenTool, help: "Describe the change, e.g. “make it snowy” or “replace the background with a beach at sunset”." },
  { id: "VARIATION", label: "Variations", kind: "VARIATION", icon: Shuffle, help: "New takes that keep the subject and composition." },
  { id: "UPSCALE", label: "Upscale", kind: "UPSCALE", icon: Maximize, help: "Increase resolution while keeping details sharp." },
  { id: "REMOVE_BACKGROUND", label: "Remove background", kind: "REMOVE_BACKGROUND", icon: Eraser, help: "Cut out the subject as a transparent PNG." },
];

export interface Version {
  versionNumber: number;
  operation: string;
  instruction: string | null;
  parentImageId: string | null;
  createdAt: string;
  image: OwnImage;
}

const OP_LABEL: Record<string, string> = { EDIT: "Edit", VARIATION: "Variation", UPSCALE: "Upscale", REMOVE_BACKGROUND: "Background removed" };

export function EditorWorkspace({ image, root, versions, models, balance: initialBalance, verified }: { image: OwnImage; root: OwnImage; versions: Version[]; models: PublicModel[]; balance: number; verified: boolean }) {
  const router = useRouter();
  const [op, setOp] = useState<Op>("EDIT");
  const opModels = models.filter((m) => m.kind === OPS.find((o) => o.id === op)!.kind);
  const [modelId, setModelId] = useState<string | undefined>(undefined);
  const model = opModels.find((m) => m.id === modelId) ?? opModels.find((m) => m.available) ?? opModels[0];
  const [instruction, setInstruction] = useState("");
  const [strength, setStrength] = useState(0.6);
  const [count, setCount] = useState(1);
  const [seed, setSeed] = useState("");
  const [balance, setBalance] = useState(initialBalance);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<SerializedJob[]>([]);
  const key = useRef<string | null>(null);

  // Comparison: the selected (current) image vs. its parent. Only real edits are compared.
  const allVersions = [{ versionNumber: 0, operation: "ORIGINAL", instruction: null, parentImageId: null, createdAt: root.createdAt, image: root } as Version, ...versions];
  const current = allVersions.find((v) => v.image.id === image.id) ?? allVersions[0];
  const parent = current.parentImageId ? allVersions.find((v) => v.image.id === current.parentImageId)?.image : null;

  const n = op === "EDIT" || op === "VARIATION" ? Math.min(count, model?.maxImages ?? 1) : 1;
  const cost = model ? model.creditsPerImage * n : 0;
  const supportsStrength = model?.provider === "stability" && (op === "EDIT" || op === "VARIATION");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!model || submitting) return;
    if (op === "EDIT" && instruction.trim().length < 3) return setError("Describe the change you want to make.");
    setError(null);
    setSubmitting(true);
    key.current ??= newIdempotencyKey();
    try {
      const res = await api<{ job: SerializedJob; balance: number }>("/api/edits", {
        body: {
          sourceImageId: image.id,
          type: op,
          modelId: model.id,
          prompt: op === "EDIT" || op === "VARIATION" ? instruction.trim() || null : null,
          numImages: n,
          strength: supportsStrength ? strength : null,
          seed: model.supportsSeed && seed ? Number(seed) : null,
          idempotencyKey: key.current,
        },
      });
      key.current = null;
      setBalance(res.balance);
      setJobs((js) => [res.job, ...js]);
    } catch (err) {
      if (err instanceof ApiClientError && err.status < 500) key.current = null;
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-4">
        {parent ? (
          <>
            <CompareSlider before={parent.url} after={current.image.url} beforeLabel="Before" afterLabel={`After · ${OP_LABEL[current.operation] ?? "Edited"}`} aspect={parent.width / parent.height} />
            <Panel className="flex flex-col gap-3 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium">
                  {OP_LABEL[current.operation] ?? "Edited"} · version {current.versionNumber}
                </p>
                <p className="text-muted">
                  {current.instruction ? `“${current.instruction}”` : "No text instruction"} · {current.image.job?.modelVersion ?? ""} · {formatDate(current.createdAt, true)}
                  {current.image.seed != null && ` · seed ${current.image.seed}`}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button asChild size="sm" variant="secondary">
                  <a href={parent.downloadUrl}>
                    <Download className="size-4" /> Original
                  </a>
                </Button>
                <Button asChild size="sm" variant="secondary">
                  <a href={current.image.downloadUrl}>
                    <Download className="size-4" /> Edited
                  </a>
                </Button>
              </div>
            </Panel>
          </>
        ) : (
          <>
            <div className="overflow-hidden rounded-xl border border-line bg-panel-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt={image.prompt ?? "Source image"} className="mx-auto max-h-[70vh] w-auto" />
            </div>
            <p className="text-sm text-muted">This is the original. Run an edit and the before/after comparison appears here.</p>
          </>
        )}

        <section aria-labelledby="versions-heading">
          <h2 id="versions-heading" className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Layers className="size-4" /> Versions ({allVersions.length})
          </h2>
          <ul className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {allVersions.map((v) => (
              <li key={v.image.id} className="shrink-0">
                <Link href={`/editor/${v.image.id}`} aria-current={v.image.id === image.id ? "true" : undefined} className={cn("block w-28 overflow-hidden rounded-lg border", v.image.id === image.id ? "border-violet ring-2 ring-violet/40" : "border-line hover:border-violet/50")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.image.thumbUrl} alt="" className="aspect-square w-full object-cover" loading="lazy" />
                  <span className="block truncate px-2 py-1 text-xs text-muted">{v.versionNumber === 0 ? "Original" : `v${v.versionNumber} · ${OP_LABEL[v.operation]}`}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {jobs.map((j) => (
          <JobCard key={j.id} initial={j} compact onBalance={setBalance} onRetried={(nj) => setJobs((js) => [nj, ...js])} onDone={(d) => d.status === "COMPLETED" && router.refresh()} />
        ))}
      </div>

      <form onSubmit={submit} className="space-y-4">
        <Panel className="p-4">
          <div className="grid grid-cols-2 gap-1.5" role="tablist" aria-label="Editing tools">
            {OPS.map((o) => (
              <button
                key={o.id}
                type="button"
                role="tab"
                aria-selected={op === o.id}
                onClick={() => {
                  setOp(o.id);
                  setModelId(undefined);
                  setError(null);
                }}
                className={cn("flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm", op === o.id ? "border-violet bg-violet/12" : "border-line text-muted hover:text-text")}
              >
                <o.icon className="size-4 shrink-0" /> {o.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">{OPS.find((o) => o.id === op)!.help}</p>
        </Panel>

        <Panel className="space-y-4 p-4">
          {opModels.length === 0 ? (
            <p className="text-sm text-muted">No models are enabled for this tool.</p>
          ) : (
            <Field label="Model" htmlFor="edit-model" hint={model ? `${model.creditsPerImage} credits / image` : undefined}>
              <Select id="edit-model" value={model?.id} onChange={(e) => setModelId(e.target.value)}>
                {opModels.map((m) => (
                  <option key={m.id} value={m.id} disabled={!m.available}>
                    {m.displayName}
                    {m.available ? "" : " – not configured"}
                  </option>
                ))}
              </Select>
              {model?.description && <p className="mt-1.5 text-xs text-muted">{model.description}</p>}
            </Field>
          )}
          {(op === "EDIT" || op === "VARIATION") && (
            <Field label={op === "EDIT" ? "Instruction" : "Guidance (optional)"} htmlFor="instruction" hint={op === "VARIATION" ? "Defaults to the original prompt" : undefined}>
              <Textarea id="instruction" value={instruction} onChange={(e) => setInstruction(e.target.value)} rows={3} maxLength={2000} placeholder={op === "EDIT" ? "Turn the scene into a snowy winter evening" : image.prompt ?? "Describe the image"} />
            </Field>
          )}
          {supportsStrength && (
            <Field label="Change strength" htmlFor="strength" hint={`${Math.round(strength * 100)}% – higher changes more`}>
              <input id="strength" type="range" min={0.1} max={0.95} step={0.05} value={strength} onChange={(e) => setStrength(Number(e.target.value))} className="w-full accent-[var(--violet)]" />
            </Field>
          )}
          {(op === "EDIT" || op === "VARIATION") && (model?.maxImages ?? 1) > 1 && (
            <Field label="Images" htmlFor="edit-count">
              <Select id="edit-count" value={n} onChange={(e) => setCount(Number(e.target.value))}>
                {Array.from({ length: model?.maxImages ?? 1 }).map((_, i) => (
                  <option key={i} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {model?.supportsSeed && (
            <Field label="Seed" htmlFor="edit-seed" hint="Optional">
              <Input id="edit-seed" inputMode="numeric" value={seed} onChange={(e) => setSeed(e.target.value.replace(/[^\d]/g, "").slice(0, 10))} placeholder="Random" />
            </Field>
          )}
        </Panel>

        {!verified && <Alert tone="warn">Verify your email to use the editor.</Alert>}
        {error && <Alert tone="danger">{error}</Alert>}
        <Panel className="flex items-center justify-between gap-3 p-3">
          <div className="text-sm">
            <div className="font-medium tabular-nums">{cost} credits</div>
            <div className={cn("text-xs tabular-nums", cost > balance ? "text-danger" : "text-muted")}>{cost > balance ? "Not enough credits" : `${balance} available`}</div>
          </div>
          <Button type="submit" loading={submitting} disabled={!model?.available || cost > balance || !verified}>
            {!submitting && <Sparkles className="size-4" />} Run {OPS.find((o) => o.id === op)!.label.toLowerCase()}
          </Button>
        </Panel>
        <div className="flex flex-wrap gap-2 text-xs text-muted">
          <Badge>{image.width}×{image.height}</Badge>
          {image.origin === "UPLOADED" && <Badge>Uploaded</Badge>}
          <Link href={`/creations?open=${image.id}`} className="text-violet hover:underline">
            Sharing & visibility
          </Link>
        </div>
      </form>
    </div>
  );
}
