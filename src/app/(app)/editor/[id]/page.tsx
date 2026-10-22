import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePageUser } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { listModels } from "@/lib/ai/registry";
import { getBalance } from "@/lib/credits/ledger";
import { serializeOwnImage } from "@/lib/images/access";
import { EditorWorkspace } from "@/components/editor/editor-workspace";
import { PageHeader } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Image Editor" };

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageUser(`/editor/${id}`);
  const image = await db.generatedImage.findFirst({ where: { id, userId: user.id, deletedAt: null }, include: { job: true, version: true } });
  if (!image) notFound();
  const rootId = image.version?.rootImageId ?? image.id;
  const [root, versions, models, balance] = await Promise.all([
    rootId === image.id ? image : db.generatedImage.findFirst({ where: { id: rootId, userId: user.id, deletedAt: null }, include: { job: true } }),
    db.imageVersion.findMany({ where: { rootImageId: rootId, image: { deletedAt: null } }, orderBy: { versionNumber: "asc" }, include: { image: { include: { job: true } } } }),
    listModels(),
    getBalance(user.id),
  ]);
  const rootImage = root ?? image;
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Image Editor"
        description="Edit, vary, upscale or cut out your image. Every result is saved as a new version – the original is never overwritten."
        actions={
          <Button asChild variant="secondary">
            <Link href="/editor">Choose another image</Link>
          </Button>
        }
      />
      <EditorWorkspace
        image={serializeOwnImage(image)}
        root={serializeOwnImage(rootImage)}
        versions={versions.map((v) => ({ versionNumber: v.versionNumber, operation: v.operation, instruction: v.instruction, parentImageId: v.parentImageId, createdAt: v.createdAt.toISOString(), image: serializeOwnImage(v.image) }))}
        models={models.filter((m) => m.kind !== "TEXT_TO_IMAGE")}
        balance={balance}
        verified={Boolean(user.emailVerified)}
      />
    </div>
  );
}
