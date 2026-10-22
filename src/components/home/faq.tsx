const FAQ: [string, string][] = [
  ["How do credits work?", "Every action has a credit cost that's shown before you start – for example 1 credit per image with FLUX.1 [schnell] or 3 with Stable Image Core. Credits are only deducted when you start a generation, and if it fails we refund them automatically."],
  ["Are my images private?", "Yes. Everything you create is private by default and stored in private storage. An image appears in Explore only if you publish it, and you can make it private again at any time. Share links can be revoked instantly."],
  ["What does the prompt enhancer do?", "It uses a language model to turn a short idea into a detailed, image-ready prompt – adding lighting, composition, mood and style while keeping your original idea. You can edit the result before generating."],
  ["Can I reproduce an image exactly?", "On models that support seeds, every image records its seed, model version and settings so you can regenerate with the same values. The result can still differ if the provider updates the model or parameters change."],
  ["Which payment methods do you accept?", "Payments are processed securely by Razorpay in INR: UPI, cards, net banking and wallets, depending on what's enabled. We never see or store your card details or UPI PIN."],
  ["Can I use the images commercially?", "You can use images you create according to our Terms and the licence of the model you used. Avoid prompts that copy trademarks, real people or other artists' protected work."],
  ["Do credits expire?", "No. Purchased credits and subscription credits roll over and never expire while your account is active."],
];

export function Faq() {
  return (
    <div className="divide-y divide-line rounded-[var(--radius-panel)] border border-line bg-panel">
      {FAQ.map(([q, a]) => (
        <details key={q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
            {q}
            <span className="text-xl leading-none text-muted transition-transform group-open:rotate-45" aria-hidden>
              +
            </span>
          </summary>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">{a}</p>
        </details>
      ))}
    </div>
  );
}
