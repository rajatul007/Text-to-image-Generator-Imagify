"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Copy, Flag, Heart, Share2, Sparkles } from "lucide-react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogTrigger } from "../ui/dialog";
import { Field, Select, Textarea } from "../ui/field";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/utils";

export function LikeButton({ imageId, liked: initialLiked, count: initialCount, signedIn }: { imageId: string; liked: boolean; count: number; signedIn: boolean }) {
  const router = useRouter();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const toggle = async () => {
    if (!signedIn) return router.push(`/login?next=/image/${imageId}`);
    const next = !liked;
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));
    try {
      const res = await api<{ likeCount: number }>(`/api/images/${imageId}/like`, { method: next ? "POST" : "DELETE" });
      setCount(res.likeCount);
    } catch (e) {
      setLiked(!next);
      setCount((c) => c + (next ? -1 : 1));
      toast.error((e as Error).message);
    }
  };
  return (
    <Button variant="secondary" onClick={toggle} aria-pressed={liked}>
      <Heart className={cn("size-4", liked && "fill-danger text-danger")} /> {count} {count === 1 ? "like" : "likes"}
    </Button>
  );
}

export function CopyPromptButton({ prompt }: { prompt: string }) {
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => {
        void navigator.clipboard.writeText(prompt);
        toast.success("Prompt copied");
      }}
    >
      <Copy className="size-4" /> Copy prompt
    </Button>
  );
}

export function UsePromptButton({ prompt, style, signedIn }: { prompt: string; style?: string | null; signedIn: boolean }) {
  const target = `/generate?${new URLSearchParams({ prompt, ...(style ? { style } : {}) })}`;
  return (
    <Button asChild size="sm">
      <Link href={signedIn ? target : `/signup?next=${encodeURIComponent(target)}`}>
        <Sparkles className="size-4" /> Try this prompt
      </Link>
    </Button>
  );
}

export function ShareButton({ url, title }: { url: string; title: string }) {
  const share = async () => {
    const full = url.startsWith("http") ? url : `${window.location.origin}${url}`;
    if (navigator.share) {
      try {
        await navigator.share({ url: full, title });
        return;
      } catch {
        /* cancelled – fall back to copy */
      }
    }
    await navigator.clipboard.writeText(full);
    toast.success("Link copied");
  };
  return (
    <Button variant="secondary" onClick={share}>
      <Share2 className="size-4" /> Share
    </Button>
  );
}

const REASONS = [
  ["SEXUAL_CONTENT", "Sexual or explicit content"],
  ["VIOLENCE", "Violence or gore"],
  ["HATE", "Hate or extremism"],
  ["HARASSMENT", "Harassment or a real person without consent"],
  ["COPYRIGHT", "Copyright or trademark infringement"],
  ["SPAM", "Spam"],
  ["OTHER", "Something else"],
] as const;

export function ReportButton({ imageId, signedIn, shareToken }: { imageId: string; signedIn: boolean; shareToken?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("SEXUAL_CONTENT");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api<{ message: string }>(`/api/images/${imageId}/report`, { body: { reason, details: details || undefined, shareToken } });
      toast.success(res.message);
      setOpen(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };
  if (!signedIn)
    return (
      <Button variant="ghost" size="sm" onClick={() => router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`)}>
        <Flag className="size-4" /> Report
      </Button>
    );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Flag className="size-4" /> Report
        </Button>
      </DialogTrigger>
      <DialogContent title="Report this image" description="Moderators review every report. Images reported by several people are hidden while under review.">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Reason" htmlFor="reason">
            <Select id="reason" value={reason} onChange={(e) => setReason(e.target.value)}>
              {REASONS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Details" htmlFor="details" hint="Optional">
            <Textarea id="details" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} rows={3} />
          </Field>
          <Button type="submit" className="w-full" loading={loading}>
            Send report
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
