import type { ReactNode } from "react";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-4xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-faint">Last updated {updated}</p>
      <div className="mt-8 space-y-6 text-[15px] leading-7 text-muted [&_h2]:font-display [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-text [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-text">{children}</div>
    </article>
  );
}
