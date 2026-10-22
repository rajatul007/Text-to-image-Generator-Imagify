"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Field, Input, Textarea } from "../ui/field";
import { Dialog, DialogContent, DialogTrigger } from "../ui/dialog";
import { api } from "@/lib/client/api";
import { formatInr } from "@/lib/utils";

export function RefundDialog({ orderId, refundablePaise }: { orderId: string; refundablePaise: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rupees, setRupees] = useState(String(refundablePaise / 100));
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api(`/api/admin/payments/${orderId}/refund`, { body: { amountPaise: Math.round(Number(rupees) * 100), reason } });
      toast.success("Refund issued and recorded");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          Refund
        </Button>
      </DialogTrigger>
      <DialogContent title="Issue refund" description={`Refunds go back to the original payment method through Razorpay. Up to ${formatInr(refundablePaise)} is refundable. The matching share of credits is removed from the user's wallet.`}>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Amount (₹)" htmlFor="amt">
            <Input id="amt" type="number" step="0.01" min="1" max={refundablePaise / 100} value={rupees} onChange={(e) => setRupees(e.target.value)} required />
          </Field>
          <Field label="Reason" htmlFor="refund-reason">
            <Textarea id="refund-reason" value={reason} onChange={(e) => setReason(e.target.value)} minLength={5} required rows={2} />
          </Field>
          <Button type="submit" variant="danger" className="w-full" loading={loading}>
            Refund {rupees ? formatInr(Math.round(Number(rupees) * 100)) : ""}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
