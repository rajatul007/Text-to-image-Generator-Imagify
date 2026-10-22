import { LegalPage } from "@/components/legal";

export const metadata = { title: "Contact" };

export default function Contact() {
  const email = process.env.SUPPORT_EMAIL ?? "support@example.com";
  return (
    <LegalPage title="Contact us" updated="22 October 2026">
      <p>
        Email <a className="text-violet underline" href={`mailto:${email}`}>{email}</a> and include your account email and, for payment questions, the receipt number (it starts with PF-). We reply within two working days.
      </p>
      <h2>Report content</h2>
      <p>Use the Report button on any public or shared image. Our moderators review every report.</p>
    </LegalPage>
  );
}
