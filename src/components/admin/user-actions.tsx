"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Field, Input, Select, Textarea } from "../ui/field";
import { Dialog, DialogContent, DialogTrigger } from "../ui/dialog";
import { api, newIdempotencyKey } from "@/lib/client/api";

export function SuspendDialog({ userId, suspended }: { userId: string; suspended: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api(`/api/admin/users/${userId}`, { method: "PATCH", body: { action: suspended ? "reactivate" : "suspend", reason } });
      toast.success(suspended ? "Account reactivated" : "Account suspended and signed out");
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
        <Button variant={suspended ? "secondary" : "danger"} size="sm">
          {suspended ? "Reactivate" : "Suspend"}
        </Button>
      </DialogTrigger>
      <DialogContent title={suspended ? "Reactivate account" : "Suspend account"} description="This action is recorded in the audit log.">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Reason" htmlFor="reason">
            <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} minLength={5} maxLength={500} required rows={3} />
          </Field>
          <Button type="submit" variant={suspended ? "primary" : "danger"} className="w-full" loading={loading}>
            {suspended ? "Reactivate account" : "Suspend account"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CreditDialog({ userId }: { userId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<"PROMOTIONAL" | "ADMIN_ADJUSTMENT">("PROMOTIONAL");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const key = useRef(newIdempotencyKey());
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api<{ balanceAfter: number; duplicate: boolean }>(`/api/admin/users/${userId}/credits`, { body: { amount: Number(amount), kind, reason, idempotencyKey: key.current } });
      toast.success(res.duplicate ? "Already applied" : `Done – new balance ${res.balanceAfter}`);
      key.current = newIdempotencyKey();
      setOpen(false);
      setAmount("");
      setReason("");
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
        <Button variant="secondary" size="sm">
          Adjust credits
        </Button>
      </DialogTrigger>
      <DialogContent title="Adjust credits" description="Recorded in the user's ledger and the audit log. A reason is required.">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type" htmlFor="kind">
              <Select id="kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
                <option value="PROMOTIONAL">Promotional grant</option>
                <option value="ADMIN_ADJUSTMENT">Manual adjustment (±)</option>
              </Select>
            </Field>
            <Field label="Credits" htmlFor="amount" hint={kind === "ADMIN_ADJUSTMENT" ? "Negative to deduct" : undefined}>
              <Input id="amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required min={kind === "PROMOTIONAL" ? 1 : undefined} />
            </Field>
          </div>
          <Field label="Reason" htmlFor="credit-reason" hint="Visible to the user">
            <Textarea id="credit-reason" value={reason} onChange={(e) => setReason(e.target.value)} minLength={5} required rows={2} />
          </Field>
          <Button type="submit" className="w-full" loading={loading}>
            Apply
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
