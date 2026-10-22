import { requirePageUser } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { imageUrls } from "@/lib/images/access";
import { getSettings } from "@/lib/settings";
import { EditorPicker } from "@/components/editor/editor-picker";
import { PageHeader } from "@/components/ui/misc";

export const metadata = { title: "Image Editor" };

export default async function EditorIndex() {
  const user = await requirePageUser("/editor");
  const [recent, settings] = await Promise.all([
    db.generatedImage.findMany({ where: { userId: user.id, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 18, select: { id: true, prompt: true } }),
    getSettings(),
  ]);
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Image Editor" description="Edit with text, create variations, upscale, or remove backgrounds – then compare before and after." />
      <EditorPicker recent={recent.map((r) => ({ id: r.id, prompt: r.prompt, thumbUrl: imageUrls(r.id).thumbUrl }))} maxMb={process.env.VERCEL ? Math.min(settings.maxUploadMb, 4) : settings.maxUploadMb} verified={Boolean(user.emailVerified)} />
    </div>
  );
}
