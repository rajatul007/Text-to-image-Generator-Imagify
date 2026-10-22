"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Download, LogOut } from "lucide-react";
import { Button } from "../ui/button";
import { Field, Input } from "../ui/field";
import { Alert, Panel } from "../ui/misc";
import { Switch } from "../ui/switch";
import { Dialog, DialogContent, DialogTrigger } from "../ui/dialog";
import { api } from "@/lib/client/api";

type Prefs = Record<"emailGenerationComplete" | "emailGenerationFailed" | "emailLowCredits" | "emailPayments" | "emailProductUpdates" | "inAppNotifications" | "defaultShowPrompt" | "defaultShowCreator", boolean>;

const PREF_LABELS: { key: keyof Prefs; label: string; help: string; essential?: boolean }[] = [
  { key: "inAppNotifications", label: "In-app notifications", help: "Show updates in your notification center." },
  { key: "emailGenerationComplete", label: "Email when images are ready", help: "Useful for long-running generations." },
  { key: "emailGenerationFailed", label: "Email when a generation fails", help: "Includes the automatic refund." },
  { key: "emailLowCredits", label: "Low-credit alerts", help: "When your balance drops below the threshold." },
  { key: "emailPayments", label: "Payment receipts & refunds", help: "Confirmation of purchases, failures and refunds." },
  { key: "emailProductUpdates", label: "Product updates", help: "Occasional news about new models and features." },
];

export function NotificationPrefs({ initial }: { initial: Prefs }) {
  const [prefs, setPrefs] = useState(initial);
  const update = async (key: keyof Prefs, value: boolean) => {
    setPrefs((p) => ({ ...p, [key]: value }));
    try {
      await api("/api/profile", { method: "PATCH", body: { [key]: value } });
      toast.success("Preference saved");
    } catch (e) {
      setPrefs((p) => ({ ...p, [key]: !value }));
      toast.error((e as Error).message);
    }
  };
  return (
    <Panel className="divide-y divide-line">
      <h2 className="font-display px-5 py-4 text-lg font-semibold">Notifications</h2>
      {PREF_LABELS.map((p) => (
        <div key={p.key} className="flex items-center justify-between gap-4 px-5 py-3.5">
          <div>
            <label htmlFor={p.key} className="text-sm font-medium">
              {p.label}
            </label>
            <p className="text-xs text-muted">{p.help}</p>
          </div>
          <Switch id={p.key} checked={prefs[p.key]} onCheckedChange={(v) => update(p.key, v)} />
        </div>
      ))}
      <p className="px-5 py-3 text-xs text-faint">Security emails (verification, password resets and changes) are always sent.</p>
      <h2 className="font-display px-5 py-4 text-lg font-semibold">Publishing defaults</h2>
      {(
        [
          ["defaultShowPrompt", "Show prompts on new public images"],
          ["defaultShowCreator", "Show my name on new public images"],
        ] as const
      ).map(([key, label]) => (
        <div key={key} className="flex items-center justify-between gap-4 px-5 py-3.5">
          <label htmlFor={key} className="text-sm font-medium">
            {label}
          </label>
          <Switch id={key} checked={prefs[key]} onCheckedChange={(v) => update(key, v)} />
        </div>
      ))}
    </Panel>
  );
}

export function PasswordPanel({ hasPassword }: { hasPassword: boolean }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ message: string }>("/api/account/password", { body: { currentPassword: hasPassword ? current : undefined, newPassword: next } });
      toast.success(res.message);
      setCurrent("");
      setNext("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Panel className="p-5">
      <h2 className="font-display text-lg font-semibold">{hasPassword ? "Change password" : "Set a password"}</h2>
      {!hasPassword && <p className="mt-1 text-sm text-muted">You sign in with Google. Set a password to also sign in with email.</p>}
      <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
        {error && <Alert tone="danger" className="sm:col-span-2">{error}</Alert>}
        {hasPassword && (
          <Field label="Current password" htmlFor="cur">
            <Input id="cur" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </Field>
        )}
        <Field label="New password" htmlFor="new" hint="8+ characters, letters and numbers">
          <Input id="new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
        </Field>
        <div className="sm:col-span-2">
          <Button type="submit" loading={loading}>
            {hasPassword ? "Change password" : "Set password"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

export function SessionsPanel({ count }: { count: number }) {
  const [loading, setLoading] = useState(false);
  const signOutOthers = async () => {
    setLoading(true);
    try {
      await api("/api/account/sessions", { method: "DELETE" });
      toast.success("Signed out of all other devices");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Panel className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="font-display text-lg font-semibold">Sessions</h2>
        <p className="text-sm text-muted">You&apos;re signed in on {count} device{count === 1 ? "" : "s"}.</p>
      </div>
      <Button variant="secondary" onClick={signOutOthers} loading={loading} disabled={count <= 1}>
        <LogOut className="size-4" /> Sign out other devices
      </Button>
    </Panel>
  );
}

export function DataPanel({ hasPassword }: { hasPassword: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const del = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api("/api/account", { method: "DELETE", body: { password: hasPassword ? password : undefined, confirm } });
      toast.success("Your account was deleted");
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };
  return (
    <Panel className="space-y-4 p-5">
      <h2 className="font-display text-lg font-semibold">Your data</h2>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">Download everything we store about you – account, prompts, generation settings, credit ledger and payments – as JSON.</p>
        <Button asChild variant="secondary">
          <a href="/api/account/export">
            <Download className="size-4" /> Export data
          </a>
        </Button>
      </div>
      <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-danger">Delete account</p>
          <p className="text-sm text-muted">Permanently deletes your profile, images and prompts and cancels any subscription. Remaining credits are lost.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="danger">Delete account</Button>
          </DialogTrigger>
          <DialogContent title="Delete your account?" description="This can't be undone. Payment records are kept in anonymised form for tax compliance.">
            <form onSubmit={del} className="space-y-4">
              {error && <Alert tone="danger">{error}</Alert>}
              {hasPassword && (
                <Field label="Password" htmlFor="del-pw">
                  <Input id="del-pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </Field>
              )}
              <Field label='Type "DELETE" to confirm' htmlFor="del-confirm">
                <Input id="del-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="off" />
              </Field>
              <Button type="submit" variant="danger" className="w-full" loading={loading} disabled={confirm !== "DELETE"}>
                Permanently delete my account
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Panel>
  );
}
