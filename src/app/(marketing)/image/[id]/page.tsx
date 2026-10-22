import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Lock } from "lucide-react";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth/current";
import { canViewImage, imageUrls, isPubliclyVisible } from "@/lib/images/access";
import { getStyle } from "@/lib/ai/styles";
import { Alert, Badge } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { CopyPromptButton, LikeButton, ReportButton, ShareButton, UsePromptButton } from "@/components/explore/public-actions";
import { formatDate } from "@/lib/utils";

async function load(id: string) {
  return db.generatedImage.findUnique({
    where: { id },
    include: { user: { select: { status: true, name: true, profile: { select: { username: true, displayName: true } } } }, job: { select: { modelVersion: true, aspectRatio: true, negativePrompt: true } } },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const img = await load(id);
  if (!img || !isPubliclyVisible(img)) return { title: "Image", robots: { index: false } };
  const title = img.showPrompt && img.prompt ? img.prompt.slice(0, 60) : "Community artwork";
  return { title, openGraph: { title: `${title} · Text to Image Generator`, images: [{ url: imageUrls(img.id).url, width: img.width, height: img.height }] } };
}

export default async function ImagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [img, user] = await Promise.all([load(id), currentUser()]);
  // Access is enforced on the server: private images 404 for everyone except their owner (and admins).
  if (!img || !canViewImage(img, user) || (img.user.status !== "ACTIVE" && img.userId !== user?.id && user?.role !== "ADMIN")) notFound();
  const isOwner = user?.id === img.userId;
  const isPublic = isPubliclyVisible(img);
  if (isPublic && !isOwner) await db.generatedImage.update({ where: { id }, data: { viewCount: { increment: 1 } } }).catch(() => undefined);
  const liked = user ? Boolean(await db.imageInteraction.findUnique({ where: { userId_imageId_type: { userId: user.id, imageId: id, type: "LIKE" } } })) : false;
  const showPrompt = (img.showPrompt || isOwner) && img.prompt;
  const creator = img.showCreator && img.user.profile ? img.user.profile : null;
  const urls = imageUrls(img.id);

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="overflow-hidden rounded-[var(--radius-panel)] border border-line bg-panel-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={urls.url} alt={showPrompt ? img.prompt!.slice(0, 140) : "Community artwork"} width={img.width} height={img.height} className="mx-auto h-auto max-h-[80vh] w-auto" />
      </div>
      <div className="space-y-5">
        {!isPublic && (
          <Alert tone={img.moderationStatus === "OK" ? "neutral" : "warn"} title={img.moderationStatus === "OK" ? "Only you can see this" : "Hidden from Explore"}>
            {img.moderationStatus === "OK" ? (
              <span className="flex items-center gap-1">
                <Lock className="size-3.5" /> This image is private. Publish it from{" "}
                <Link href={`/creations?open=${img.id}`} className="text-violet underline">
                  My Creations
                </Link>
                .
              </span>
            ) : (
              "This image is under moderator review or was removed from the public gallery."
            )}
          </Alert>
        )}
        <div>
          {creator ? (
            <Link href={`/explore?creator=${creator.username}`} className="text-sm text-violet hover:underline">
              by {creator.displayName} (@{creator.username})
            </Link>
          ) : (
            <span className="text-sm text-muted">by an anonymous creator</span>
          )}
          <p className="mt-1 text-xs text-faint">Published {formatDate(img.publishedAt ?? img.createdAt)}</p>
        </div>
        {showPrompt ? (
          <div>
            <h1 className="text-xs text-faint">Prompt</h1>
            <p className="mt-1 leading-relaxed">{img.prompt}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <CopyPromptButton prompt={img.prompt!} />
              <UsePromptButton prompt={img.prompt!} style={img.style} signedIn={Boolean(user)} />
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">The creator chose not to share the prompt for this image.</p>
        )}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {img.style && (
            <>
              <dt className="text-faint">Style</dt>
              <dd>{getStyle(img.style)?.label ?? img.style}</dd>
            </>
          )}
          {img.job && (
            <>
              <dt className="text-faint">Model</dt>
              <dd>{img.job.modelVersion}</dd>
            </>
          )}
          <dt className="text-faint">Size</dt>
          <dd className="tabular-nums">
            {img.width} × {img.height}
          </dd>
          {(img.showPrompt || isOwner) && img.seed != null && (
            <>
              <dt className="text-faint">Seed</dt>
              <dd className="tabular-nums">{img.seed}</dd>
            </>
          )}
        </dl>
        <div className="flex flex-wrap gap-2">
          {isPublic && <LikeButton imageId={img.id} liked={liked} count={img.likeCount} signedIn={Boolean(user)} />}
          {isPublic && <ShareButton url={`/image/${img.id}`} title="Artwork on Text to Image Generator" />}
          <Button asChild variant="secondary">
            <a href={urls.downloadUrl}>
              <Download className="size-4" /> Download
            </a>
          </Button>
        </div>
        <div className="flex items-center justify-between border-t border-line pt-4">
          {img.origin === "EDITED" ? <Badge>Edited image</Badge> : <span />}
          {isPublic && !isOwner && <ReportButton imageId={img.id} signedIn={Boolean(user)} />}
        </div>
      </div>
    </div>
  );
}
