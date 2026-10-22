import { db } from "@/lib/db";
import { STYLES } from "@/lib/ai/styles";
import { PromptManager } from "@/components/admin/prompt-manager";
import { PageHeader } from "@/components/ui/misc";

export const metadata = { title: "Prompt templates" };

export default async function AdminPrompts() {
  const items = await db.promptTemplate.findMany({ orderBy: [{ featured: "desc" }, { usageCount: "desc" }], take: 300, include: { author: { select: { email: true } } } });
  return (
    <div>
      <PageHeader title="Prompt templates" description={`${items.length} templates. Featured templates appear in the library's Featured tab and on the homepage.`} />
      <PromptManager
        styles={STYLES.map(({ id, label }) => ({ id, label }))}
        items={items.map((t) => ({ id: t.id, title: t.title, prompt: t.prompt, negativePrompt: t.negativePrompt, category: t.category, style: t.style, aspectRatio: t.aspectRatio, previewImageUrl: t.previewImageUrl, tags: t.tags, featured: t.featured, status: t.status, usageCount: t.usageCount, authorEmail: t.author?.email ?? null }))}
      />
    </div>
  );
}
