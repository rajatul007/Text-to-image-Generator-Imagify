import { Suspense } from "react";
import { currentUser } from "@/lib/auth/current";
import { STYLES } from "@/lib/ai/styles";
import { getSettings } from "@/lib/settings";
import { PromptLibrary } from "@/components/prompts/prompt-library";
import { PageHeader } from "@/components/ui/misc";

export const metadata = { title: "Prompt Library" };

export default async function PromptLibraryPage() {
  const [user, settings] = await Promise.all([currentUser(), getSettings()]);
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Prompt Library" description="Ready-made prompts across 15 categories. Use one as-is or load it into the generator and make it yours." />
      <Suspense>
        <PromptLibrary signedIn={Boolean(user)} styles={STYLES.map(({ id, label, swatch }) => ({ id, label, swatch }))} allowCommunity={settings.publicUserPromptsEnabled} />
      </Suspense>
    </div>
  );
}
