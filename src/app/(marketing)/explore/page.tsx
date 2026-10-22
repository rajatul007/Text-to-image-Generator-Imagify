import { Suspense } from "react";
import { db } from "@/lib/db";
import { STYLES } from "@/lib/ai/styles";
import { ExploreGallery } from "@/components/explore/explore-gallery";

export const metadata = { title: "Explore", description: "Discover artwork the community chose to publish." };

export default async function ExplorePage() {
  const models = await db.aiModel.findMany({ where: { kind: "TEXT_TO_IMAGE" }, orderBy: { sortOrder: "asc" }, select: { id: true, displayName: true } });
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-semibold sm:text-4xl">Explore</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">Artwork the community chose to publish. Open any image to see its prompt and settings – when the creator shares them.</p>
      <div className="mt-8">
        <Suspense>
          <ExploreGallery styles={STYLES.map(({ id, label }) => ({ id, label }))} models={models} />
        </Suspense>
      </div>
    </div>
  );
}
