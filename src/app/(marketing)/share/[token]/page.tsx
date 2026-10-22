import type { Metadata } from "next";
import Link from "next/link";
import { Download, Link2Off } from "lucide-react";
import { currentUser } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { resolveShareToken } from "@/lib/images/manage";
import { getStyle } from "@/lib/ai/styles";
import { Button } from "@/components/ui/button";
import { CopyPromptButton, ReportButton, ShareButton, UsePromptButton } from "@/components/explore/public-actions";

export const metadata: Metadata = { title: "Shared image", robots: { index: false } };

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [link, user] = await Promise.all([resolveShareToken(token), currentUser()]);
  if (!link) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
        <Link2Off className="size-10 text-faint" aria-hidden />
        <h1 className="font-display mt-4 text-2xl font-semibold">This link isn&apos;t available</h1>
        <p className="mt-2 text-sm text-muted">The creator may have revoked it, or the image was deleted.</p>
        <Button asChild className="mt-6">
          <Link href="/explore">Browse public images</Link>
        </Button>
      </div>
    );
  }
  await db.shareLink.update({ where: { id: link.id }, data: { viewCount: { increment: 1 } } }).catch(() => undefined);
  const img = link.image;
  const fileUrl = `/api/share/${token}/file`;
  const creator = link.showCreator ? img.user.profile : null;
  const prompt = link.showPrompt ? img.prompt : null;
  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="overflow-hidden rounded-[var(--radius-panel)] border border-line bg-panel-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={fileUrl} alt={prompt?.slice(0, 140) ?? "Shared image"} width={img.width} height={img.height} className="mx-auto h-auto max-h-[80vh] w-auto" />
      </div>
      <div className="space-y-5">
        <div>
          <h1 className="font-display text-2xl font-semibold">{creator ? `Shared by ${creator.displayName}` : "A shared image"}</h1>
          <p className="mt-1 text-sm text-muted">Made with Text to Image Generator{img.style ? ` · ${getStyle(img.style)?.label ?? img.style}` : ""}{img.job ? ` · ${img.job.modelVersion}` : ""}</p>
        </div>
        {prompt ? (
          <div>
            <h2 className="text-xs text-faint">Prompt</h2>
            <p className="mt-1 leading-relaxed">{prompt}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <CopyPromptButton prompt={prompt} />
              <UsePromptButton prompt={prompt} style={img.style} signedIn={Boolean(user)} />
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">The creator kept the prompt private.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <ShareButton url={`/share/${token}`} title="Image made with Text to Image Generator" />
          <Button asChild variant="secondary">
            <a href={`${fileUrl}?download=1`}>
              <Download className="size-4" /> Download
            </a>
          </Button>
        </div>
        <div className="flex items-center justify-between border-t border-line pt-4 text-sm">
          <Link href="/signup" className="text-violet hover:underline">
            Create your own images
          </Link>
          {user?.id !== img.userId && <ReportButton imageId={img.id} signedIn={Boolean(user)} shareToken={token} />}
        </div>
      </div>
    </div>
  );
}
