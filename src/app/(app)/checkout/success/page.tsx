import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth/current";
import { CheckoutStatus } from "@/components/credits/checkout-status";

export const metadata = { title: "Payment status" };

export default async function CheckoutSuccess({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  await requirePageUser("/credits");
  const { order } = await searchParams;
  if (!order) redirect("/credits");
  return (
    <div className="mx-auto max-w-2xl py-6">
      <CheckoutStatus orderId={order} />
    </div>
  );
}
