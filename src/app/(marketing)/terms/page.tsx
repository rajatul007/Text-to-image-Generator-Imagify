import { LegalPage } from "@/components/legal";

export const metadata = { title: "Terms of service" };

export default function Terms() {
  return (
    <LegalPage title="Terms of service" updated="22 October 2026">
      <p>These terms govern your use of Text to Image Generator. Replace this template with terms reviewed by your legal counsel before launch.</p>
      <h2>Your account</h2>
      <p>You must provide accurate information, keep your password secure, and be at least 18 years old (or the age of majority where you live).</p>
      <h2>Acceptable use</h2>
      <ul>
        <li>No sexual content involving minors, non-consensual intimate imagery, or content that sexualises real people.</li>
        <li>No content that harasses, defames or impersonates real people, or promotes violence or hatred.</li>
        <li>No attempts to bypass safety filters, rate limits, payments or another user&apos;s privacy.</li>
      </ul>
      <p>We may remove content from the public gallery and suspend accounts that break these rules.</p>
      <h2>Your content</h2>
      <p>You keep the rights you have in your prompts, uploads and outputs, subject to the licence terms of the model provider used. You give us the limited permissions needed to store, process and display your content as you direct (for example when you publish or share it).</p>
      <h2>Credits</h2>
      <p>Credits are a prepaid, non-transferable balance used to pay for actions in the service. They have no cash value. Costs are shown before each action. Credits for generations that fail are refunded to your wallet automatically.</p>
      <h2>Availability</h2>
      <p>The service depends on third-party AI providers that may be unavailable or change their models. Using the same seed does not guarantee identical results if a provider updates its model.</p>
    </LegalPage>
  );
}
