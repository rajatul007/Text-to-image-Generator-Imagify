"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Download, Globe, Heart, Link2, Lock, PenTool, Repeat, Trash2 } from "lucide-react";
import { Dialog, DialogContent, useConfirm } from "../ui/dialog";
import { Button } from "../ui/button";
import { Badge, Skeleton } from "../ui/misc";
import { Switch } from "../ui/switch";
import { api } from "@/lib/client/api";
import type { OwnImage } from "@/lib/images/access";
import { formatDate } from "@/lib/utils";

interface Detail {
  image: OwnImage;
  parent: OwnImage | null;
}

/** Owner's image detail modal: metadata, download, favorite, visibility, sharing, delete. */
export function ImageViewer({ imageId, open, onOpenChange, onChanged, onDeleted }: { imageId: string; open: boolean; onOpenChange: (o: boolean) => void; onChanged?: (img: OwnImage) => void; onDeleted?: (id: string) => void }) {
  const confirm = useConfirm();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<Detail>(`/api/images/${imageId}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [imageId]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on open
    if (open) void load();
  }, [open, load]);

  const img = data?.image;
  const update = (next: OwnImage) => {
    setData((d) => (d ? { ...d, image: { ...d.image, ...next, favorite: d.image.favorite, shareToken: d.image.shareToken } } : d));
    onChanged?.(next);
  };

  const patch = async (body: Record<string, unknown>, okMsg: string) => {
    setBusy("patch");
    try {
      const res = await api<{ image: OwnImage }>(`/api/images/${imageId}`, { method: "PATCH", body });
      update(res.image);
      toast.success(okMsg);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const toggleFavorite = async () => {
    if (!img) return;
    const fav = !img.favorite;
    setData((d) => (d ? { ...d, image: { ...d.image, favorite: fav } } : d));
    try {
      await api(`/api/images/${imageId}/favorite`, { method: fav ? "POST" : "DELETE" });
      onChanged?.({ ...img, favorite: fav });
    } catch (e) {
      setData((d) => (d ? { ...d, image: { ...d.image, favorite: !fav } } : d));
      toast.error((e as Error).message);
    }
  };

  const share = async () => {
    setBusy("share");
    try {
      const res = await api<{ token: string; url: string }>(`/api/images/${imageId}/share`, { body: { showPrompt: img?.showPrompt ?? true, showCreator: img?.showCreator ?? true } });
      setData((d) => (d ? { ...d, image: { ...d.image, shareToken: res.token } } : d));
      await navigator.clipboard.writeText(res.url).catch(() => undefined);
      toast.success("Share link copied");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const revoke = async () => {
    if (!(await confirm({ title: "Revoke share link?", description: "Anyone with the current link will lose access immediately.", confirmLabel: "Revoke link", danger: true }))) return;
    setBusy("share");
    try {
      await api(`/api/images/${imageId}/share`, { method: "DELETE" });
      setData((d) => (d ? { ...d, image: { ...d.image, shareToken: null } } : d));
      toast.success("Share link revoked");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!(await confirm({ title: "Delete this image?", description: "The file is permanently deleted and any share links stop working. Your generation history keeps the prompt and settings.", confirmLabel: "Delete image", danger: true }))) return;
    setBusy("delete");
    try {
      await api(`/api/images/${imageId}`, { method: "DELETE" });
      toast.success("Image deleted");
      onDeleted?.(imageId);
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const shareUrl = img?.shareToken ? `${typeof window !== "undefined" ? window.location.origin : ""}/share/${img.shareToken}` : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Image details" wide>
        {error && <p className="text-sm text-danger">{error}</p>}
        {!img && !error && (
          <div className="grid gap-5 md:grid-cols-[1.4fr_1fr]">
            <Skeleton className="aspect-square" />
            <div className="space-y-3">
              <Skeleton className="h-6" />
              <Skeleton className="h-24" />
              <Skeleton className="h-10" />
            </div>
          </div>
        )}
        {img && (
          <div className="grid gap-5 md:grid-cols-[1.4fr_1fr]">
            <div className="overflow-hidden rounded-xl border border-line bg-panel-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.prompt ?? "Uploaded image"} width={img.width} height={img.height} className="mx-auto h-auto max-h-[70vh] w-auto" />
            </div>
            <div className="min-w-0 space-y-4 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge tone={img.visibility === "PUBLIC" ? "ok" : "neutral"}>{img.visibility === "PUBLIC" ? "Public" : "Private"}</Badge>
                <Badge>{img.origin === "UPLOADED" ? "Uploaded" : img.origin === "EDITED" ? "Edited version" : "Generated"}</Badge>
                {img.moderationStatus !== "OK" && <Badge tone="danger">{img.moderationStatus === "REMOVED" ? "Removed from Explore" : "Under review"}</Badge>}
              </div>
              {img.prompt && (
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs text-faint">
                    Prompt
                    <button
                      className="flex items-center gap-1 hover:text-text"
                      onClick={() => {
                        void navigator.clipboard.writeText(img.prompt!);
                        toast.success("Prompt copied");
                      }}
                    >
                      <Copy className="size-3" /> Copy
                    </button>
                  </div>
                  <p className="max-h-32 overflow-y-auto leading-relaxed scrollbar-thin">{img.prompt}</p>
                </div>
              )}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <dt className="text-faint">Size</dt>
                <dd className="tabular-nums">
                  {img.width} × {img.height}
                </dd>
                {img.job && (
                  <>
                    <dt className="text-faint">Model</dt>
                    <dd className="truncate">{img.job.modelVersion}</dd>
                  </>
                )}
                <dt className="text-faint">Seed</dt>
                <dd className="tabular-nums">{img.seed ?? "Not supported"}</dd>
                {img.job?.negativePrompt && (
                  <>
                    <dt className="text-faint">Negative</dt>
                    <dd className="line-clamp-2">{img.job.negativePrompt}</dd>
                  </>
                )}
                {img.style && (
                  <>
                    <dt className="text-faint">Style</dt>
                    <dd>{img.style}</dd>
                  </>
                )}
                <dt className="text-faint">Created</dt>
                <dd>{formatDate(img.createdAt, true)}</dd>
              </dl>

              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="secondary">
                  <a href={img.downloadUrl}>
                    <Download className="size-4" /> Download
                  </a>
                </Button>
                <Button size="sm" variant="secondary" onClick={toggleFavorite} aria-pressed={img.favorite}>
                  <Heart className={img.favorite ? "size-4 fill-current text-danger" : "size-4"} /> {img.favorite ? "Favorited" : "Favorite"}
                </Button>
                <Button asChild size="sm" variant="secondary">
                  <Link href={`/editor/${img.id}`}>
                    <PenTool className="size-4" /> Edit & compare
                  </Link>
                </Button>
                {img.job?.type === "GENERATE" && (
                  <Button asChild size="sm" variant="secondary">
                    <Link href={`/generate?fromJob=${img.job.id}&seed=${img.seed ?? ""}`}>
                      <Repeat className="size-4" /> Reuse settings
                    </Link>
                  </Button>
                )}
              </div>

              <div className="space-y-3 rounded-xl border border-line p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5 font-medium">{img.visibility === "PUBLIC" ? <Globe className="size-4 text-ok" /> : <Lock className="size-4" />} Show in Explore</div>
                    <p className="text-xs text-muted">Public images can be seen by anyone.</p>
                  </div>
                  <Switch
                    label="Show in Explore"
                    checked={img.visibility === "PUBLIC"}
                    disabled={busy === "patch" || img.moderationStatus === "REMOVED"}
                    onCheckedChange={(v) => patch({ visibility: v ? "PUBLIC" : "PRIVATE" }, v ? "Published to Explore" : "Image is private again")}
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted">Show my prompt publicly</span>
                  <Switch label="Show prompt" checked={img.showPrompt} disabled={busy === "patch"} onCheckedChange={(v) => patch({ showPrompt: v }, v ? "Prompt will be shown" : "Prompt hidden")} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted">Show my name publicly</span>
                  <Switch label="Show creator" checked={img.showCreator} disabled={busy === "patch"} onCheckedChange={(v) => patch({ showCreator: v }, v ? "Your name will be shown" : "Your name is hidden")} />
                </div>
              </div>

              <div className="space-y-2 rounded-xl border border-line p-3">
                <div className="flex items-center gap-1.5 font-medium">
                  <Link2 className="size-4" /> Share link
                </div>
                {shareUrl ? (
                  <>
                    <div className="flex gap-2">
                      <input readOnly value={shareUrl} className="min-w-0 flex-1 rounded-lg border border-line bg-panel-2 px-2 py-1.5 text-xs" aria-label="Share URL" onFocus={(e) => e.currentTarget.select()} />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          void navigator.clipboard.writeText(shareUrl);
                          toast.success("Link copied");
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <a className="text-xs text-violet hover:underline" target="_blank" rel="noopener noreferrer" href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent("Made with Text to Image Generator")}`}>
                        Share on X
                      </a>
                      <a className="text-xs text-violet hover:underline" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(shareUrl)}`}>
                        WhatsApp
                      </a>
                      <button className="ml-auto text-xs text-danger hover:underline" onClick={revoke}>
                        Revoke link
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-muted">Anyone with the link can view this image, even while it&apos;s private. Prompt and name follow the switches above.</p>
                    <Button size="sm" variant="secondary" onClick={share} loading={busy === "share"} disabled={img.moderationStatus === "REMOVED"}>
                      Create share link
                    </Button>
                  </>
                )}
              </div>

              <Button variant="danger" size="sm" onClick={remove} loading={busy === "delete"}>
                <Trash2 className="size-4" /> Delete image
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
