import Link from "next/link";
import { requirePageUser } from "@/lib/auth/current";
import { Faq } from "@/components/home/faq";
import { PageHeader, Panel } from "@/components/ui/misc";

export const metadata = { title: "Help & Support" };

const TROUBLE = [
  ["A generation failed", "Failed jobs are retried automatically for temporary provider problems. If it still fails, the credits are refunded and your prompt is kept – open Generation History and press Try again, or pick another model."],
  ["“Blocked by the provider's safety filter”", "The model's provider rejected the prompt. Rephrase it without explicit, violent or real-person content."],
  ["My payment went through but credits are missing", "Credits are added once Razorpay confirms the payment, usually within seconds. Check Transactions → Payment orders. If an order shows Pending for more than an hour, contact us with the receipt number."],
  ["The same seed gave a different image", "Seeds reproduce results only with the same model version and settings. Providers occasionally update models, which changes outputs."],
  ["I can't see the prompt enhancer", "The enhancer needs a language model configured by the site administrator. You can still write prompts by hand or use the Prompt Library."],
];

export default async function HelpPage() {
  await requirePageUser("/help");
  const email = process.env.SUPPORT_EMAIL ?? "support@example.com";
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader title="Help & Support" description="Answers to common questions, and how to reach us." />
      <section>
        <h2 className="font-display mb-3 text-xl font-semibold">Troubleshooting</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {TROUBLE.map(([t, d]) => (
            <Panel key={t} className="p-4">
              <h3 className="font-medium">{t}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{d}</p>
            </Panel>
          ))}
        </div>
      </section>
      <section>
        <h2 className="font-display mb-3 text-xl font-semibold">FAQ</h2>
        <Faq />
      </section>
      <Panel className="p-5">
        <h2 className="font-display text-lg font-semibold">Still stuck?</h2>
        <p className="mt-1 text-sm text-muted">
          Email{" "}
          <a href={`mailto:${email}`} className="text-violet underline">
            {email}
          </a>{" "}
          with your account email and what happened. Read our{" "}
          <Link href="/refund-policy" className="text-violet underline">
            refund policy
          </Link>{" "}
          for payment questions.
        </p>
      </Panel>
    </div>
  );
}
