import { LegalPage } from "@/components/legal";

export const metadata = { title: "Privacy policy" };

export default function Privacy() {
  return (
    <LegalPage title="Privacy policy" updated="22 October 2026">
      <p>This policy explains what Text to Image Generator collects, why, and the choices you have. Replace this template with text reviewed by your legal counsel before launch.</p>
      <h2>What we collect</h2>
      <ul>
        <li><strong>Account data:</strong> name, email, password hash (never the password itself), and Google account identifier if you sign in with Google.</li>
        <li><strong>Content:</strong> prompts, enhanced prompts, generation settings, seeds, and the images you generate, edit or upload.</li>
        <li><strong>Payments:</strong> order and payment identifiers from Razorpay. Card numbers, UPI PINs and bank credentials are handled by Razorpay and never reach our servers.</li>
        <li><strong>Technical data:</strong> IP address and browser user agent for sessions, security and abuse prevention.</li>
      </ul>
      <h2>How images are protected</h2>
      <p>Images are private by default and stored in private object storage. They are only served to you, to anyone you explicitly share a link with, or to the public if you publish them to Explore. You can make an image private again or revoke a share link at any time.</p>
      <h2>Third parties</h2>
      <p>To generate and edit images we send your prompt (and, for edits, your image) to the AI provider that powers the model you choose, such as Stability AI, OpenAI, Replicate or Clipdrop. Prompt enhancement sends your idea to the configured language model provider. Payments are processed by Razorpay; transactional email by our email provider.</p>
      <h2>Your rights</h2>
      <p>From Settings you can export all your data as JSON and delete your account. Deleting your account removes your profile, images, prompts and sessions. Financial records (the credit ledger and payment orders) are retained in anonymised form where the law requires it.</p>
      <h2>Contact</h2>
      <p>Questions about privacy? Use the contact page and we&apos;ll respond within 7 working days.</p>
    </LegalPage>
  );
}
