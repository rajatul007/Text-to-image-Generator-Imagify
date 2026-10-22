import { LegalPage } from "@/components/legal";

export const metadata = { title: "Refund policy" };

export default function RefundPolicy() {
  return (
    <LegalPage title="Refund policy" updated="22 October 2026">
      <p>Replace this template with a policy reviewed by your legal counsel before launch.</p>
      <h2>Failed generations</h2>
      <p>If a generation or edit fails, or you cancel it before it starts, its credits are returned to your wallet automatically – exactly once – and the refund appears in your transaction history.</p>
      <h2>Credit pack purchases</h2>
      <p>You can request a refund of a credit pack within 7 days of purchase if no credits from that pack have been used. Partial refunds may be offered for partially used packs. Refunds are issued to the original payment method through Razorpay, and the matching credits are removed from your wallet.</p>
      <h2>Subscriptions</h2>
      <p>You can cancel a subscription at any time; it stays active until the end of the current billing period and won&apos;t renew. Monthly credits already added are not refunded but remain usable.</p>
      <h2>Failed or duplicate payments</h2>
      <p>If money was debited but your order failed, the amount is automatically reversed by your bank or Razorpay, typically within 5–7 working days. Contact us with your receipt number if it doesn&apos;t arrive.</p>
    </LegalPage>
  );
}
