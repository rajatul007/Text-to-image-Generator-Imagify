"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Undo2, Wand2 } from "lucide-react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/field";
import { Segmented } from "../ui/segmented";
import { api } from "@/lib/client/api";

const MODES = [
  { value: "concise", label: "Concise" },
  { value: "detailed", label: "Detailed" },
  { value: "cinematic", label: "Cinematic" },
  { value: "realistic", label: "Realistic" },
  { value: "artistic", label: "Artistic" },
] as const;
type Mode = (typeof MODES)[number]["value"];

/** Prompt Enhancer: sends the idea to the configured LLM, returns editable alternatives, applies one to the form. */
export function EnhancerPanel({ prompt, style, available, onApply, original, onRevert }: { prompt: string; style: string | null; available: boolean; onApply: (enhanced: string) => void; original: string | null; onRevert: () => void }) {
  const [mode, setMode] = useState<Mode>("detailed");
  const [count, setCount] = useState(1);
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (prompt.trim().length < 2) {
      setError("Write a short idea in the prompt box first, e.g. “a cat in space”.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ prompts: string[] }>("/api/prompts/enhance", { body: { prompt: original ?? prompt, mode, count, style } });
      setResults(res.prompts);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!available)
    return <p className="rounded-xl border border-dashed border-line p-3 text-xs text-muted">The prompt enhancer needs an LLM API key (LLM_API_KEY) on the server. Until it&apos;s configured, write your prompt by hand or start from a suggestion.</p>;

  return (
    <div className="space-y-3 rounded-xl border border-line bg-panel-2/50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented label="Enhancement mode" value={mode} onChange={setMode} options={[...MODES]} className="max-w-full overflow-x-auto" />
        <label className="flex items-center gap-2 text-xs text-muted">
          Versions
          <select value={count} onChange={(e) => setCount(Number(e.target.value))} className="rounded-lg border border-line bg-panel px-2 py-1 text-xs text-text">
            {[1, 2, 3].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <Button type="button" size="sm" onClick={run} loading={loading} className="ml-auto">
          {!loading && <Wand2 className="size-4" />} {results.length ? "Enhance again" : "Enhance prompt"}
        </Button>
      </div>
      {original && (
        <div className="flex items-center justify-between gap-2 text-xs text-muted">
          <span className="truncate">Original idea: “{original}”</span>
          <button type="button" onClick={onRevert} className="flex shrink-0 items-center gap-1 text-violet hover:underline">
            <Undo2 className="size-3" /> Restore original
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
      {results.map((r, i) => (
        <div key={i} className="space-y-2 rounded-lg border border-line bg-panel p-2.5">
          <Textarea
            aria-label={`Enhanced prompt ${i + 1}`}
            value={r}
            onChange={(e) => setResults((rs) => rs.map((x, j) => (j === i ? e.target.value : x)))}
            className="min-h-24 border-none bg-transparent p-0 focus:ring-0"
          />
          <div className="flex justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(r);
                toast.success("Prompt copied");
              }}
            >
              <Copy className="size-4" /> Copy
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => onApply(r)}>
              <Check className="size-4" /> Use this prompt
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
