import { Suspense } from "react";
import Link from "next/link";
import { requirePageUser } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { STYLES } from "@/lib/ai/styles";
import { ImageLibrary } from "@/components/library/image-library";
import { PageHeader } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Favorites" };

export default async function Page() {
  await requirePageUser("/favorites");
  const models = await db.aiModel.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, displayName: true } });
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Favorites"
        description="Images you've marked with a heart."
        actions={
          <Button asChild variant="secondary">
            <Link href="/editor">Upload & edit</Link>
          </Button>
        }
      />
      <Suspense>
        <ImageLibrary favoritesOnly styles={STYLES.map(({ id, label }) => ({ id, label }))} models={models} />
      </Suspense>
    </div>
  );
}
