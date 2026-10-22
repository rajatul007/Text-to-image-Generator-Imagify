import { Suspense } from "react";
import { requirePageUser } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { STYLES } from "@/lib/ai/styles";
import { HistoryList } from "@/components/library/history-list";
import { PageHeader } from "@/components/ui/misc";

export const metadata = { title: "Generation History" };

export default async function HistoryPage() {
  await requirePageUser("/history");
  const models = await db.aiModel.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, displayName: true } });
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Generation History" description="Every request with its prompt, seed, model version, settings and credit cost. Failed and cancelled jobs are refunded automatically." />
      <Suspense>
        <HistoryList models={models} styles={STYLES.map(({ id, label }) => ({ id, label }))} />
      </Suspense>
    </div>
  );
}
