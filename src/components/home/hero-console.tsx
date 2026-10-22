"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Wand2 } from "lucide-react";
import { Button } from "../ui/button";
import { SuggestionsDialog } from "../prompts/suggestions-dialog";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/utils";

interface StyleOption {
  id: string;
  label: string;
}

export function HeroConsole({ signedIn, verified, enhancerAvailable, styles }: { signedIn: boolean; verified: boolean; enhancerAvailable: boolean; styles: StyleOption[] }) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<string | null>(null);
  const [enhancing, setEnhancing] = useState(false);

  const target = () => {
    const p = new URLSearchParams();
    if (prompt.trim()) p.set("prompt", prompt.trim());
    if (style) p.set("style", style);
    return `/generate${p.size ? `?${p}` : ""}`;
  };

  const goGenerate = () => {
    if (!prompt.trim()) {
      toast.error("Describe the image you want first");
      return;
    }
    router.push(signedIn ? target() : `/signup?next=${encodeURIComponent(target())}`);
  };

  const enhance = async () => {
    if (!signedIn) {
      router.push(`/signup?next=${encodeURIComponent(target())}`);
      return;
    }
    if (prompt.trim().length < 2) {
      toast.error("Write a short idea first, like “a cat in space”");
      return;
    }
    setEnhancing(true);
    try {
      const res = await api<{ prompts: string[] }>("/api/prompts/enhance", { body: { prompt, mode: "detailed", count: 1, style } });
      setPrompt(res.prompts[0]);
      toast.success("Prompt enhanced – edit it as much as you like");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEnhancing(false);
    }
  };

  return (
    <div className="console mx-auto w-full max-w-3xl p-3 text-left shadow-[var(--shadow)] sm:p-4">
      <label htmlFor="hero-prompt" className="sr-only">
        Describe your image
      </label>
      <textarea
        id="hero-prompt"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) goGenerate();
        }}
        rows={3}
        maxLength={2000}
        placeholder="A lighthouse on a cliff during a thunderstorm, waves crashing, painted like an old maritime oil painting…"
        className="w-full resize-none bg-transparent px-2 py-2 text-base leading-relaxed text-text placeholder:text-faint focus:outline-none sm:text-lg"
      />
      <div className="mt-1 flex gap-1.5 overflow-x-auto px-1 pb-2 scrollbar-thin" role="radiogroup" aria-label="Style">
        {styles.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={style === s.id}
            onClick={() => setStyle(style === s.id ? null : s.id)}
            className={cn("shrink-0 rounded-full border px-3 py-1 text-xs transition-colors", style === s.id ? "border-violet bg-violet/15 text-text" : "border-line text-muted hover:text-text")}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2 border-t border-line pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={enhance} loading={enhancing} disabled={signedIn && !enhancerAvailable} title={signedIn && !enhancerAvailable ? "The prompt enhancer isn't configured on this server" : undefined}>
            {!enhancing && <Wand2 className="size-4" />} Enhance prompt
          </Button>
          <SuggestionsDialog
            onPick={(p) => {
              setPrompt(p.prompt);
              setStyle(p.style);
            }}
          />
        </div>
        <Button type="button" onClick={goGenerate} size="md" className="sm:px-6">
          <Sparkles className="size-4" /> {signedIn ? (verified ? "Generate image" : "Continue") : "Generate – it's free to start"}
        </Button>
      </div>
    </div>
  );
}
