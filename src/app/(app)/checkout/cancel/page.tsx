import Link from "next/link";
import { XCircle } from "lucide-react";
import { requirePageUser } from "@/lib/auth/current";
import { Panel } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Checkout cancelled" };

export default async function CheckoutCancel() {
  await requirePageUser("/credits");
  return (
    <div className="mx-auto max-w-2xl py-6">
      <Panel className="flex items-start gap-4 p-6 sm:p-8">
        <XCircle className="size-8 shrink-0 text-faint" />
        <div>
          <h1 className="font-display text-2xl font-semibold">Checkout cancelled</h1>
          <p className="mt-1 text-sm text-muted">You closed the payment window, so nothing was charged. Your credits haven&apos;t changed.</p>
          <div className="mt-6 flex gap-2">
            <Button asChild>
              <Link href="/credits">Choose a pack</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
