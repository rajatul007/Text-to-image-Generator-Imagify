"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Field, Input, Select, Textarea } from "../ui/field";
import { Badge, Panel } from "../ui/misc";
import { Switch } from "../ui/switch";
import { useConfirm } from "../ui/dialog";
import { api } from "@/lib/client/api";
import { formatInr } from "@/lib/utils";

function useSaver() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (id: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(id);
    try {
      await fn();
      toast.success(ok);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  return { busy, run };
}

export interface Settings {
  welcomeCredits: number;
  lowCreditThreshold: number;
  maxActiveJobsPerUser: number;
  reportAutoHideThreshold: number;
  publicUserPromptsEnabled: boolean;
  maxUploadMb: number;
}

export function SettingsForm({ initial }: { initial: Settings }) {
  const [s, setS] = useState(initial);
  const { busy, run } = useSaver();
  const num = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) => setS({ ...s, [k]: Number(e.target.value) });
  return (
    <Panel className="p-5">
      <h2 className="font-display font-semibold">Platform settings</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run("settings", () => api("/api/admin/settings", { method: "PATCH", body: s }), "Settings saved");
        }}
        className="mt-4 grid gap-4 sm:grid-cols-3"
      >
        <Field label="Welcome credits" htmlFor="wc" hint="Granted once, on email verification">
          <Input id="wc" type="number" min={0} value={s.welcomeCredits} onChange={num("welcomeCredits")} />
        </Field>
        <Field label="Low-credit threshold" htmlFor="lct">
          <Input id="lct" type="number" min={0} value={s.lowCreditThreshold} onChange={num("lowCreditThreshold")} />
        </Field>
        <Field label="Concurrent jobs per user" htmlFor="mj">
          <Input id="mj" type="number" min={1} max={20} value={s.maxActiveJobsPerUser} onChange={num("maxActiveJobsPerUser")} />
        </Field>
        <Field label="Reports before auto-hide" htmlFor="rh">
          <Input id="rh" type="number" min={1} value={s.reportAutoHideThreshold} onChange={num("reportAutoHideThreshold")} />
        </Field>
        <Field label="Max upload size (MB)" htmlFor="mu">
          <Input id="mu" type="number" min={1} max={25} value={s.maxUploadMb} onChange={num("maxUploadMb")} />
        </Field>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-line px-3">
          <label htmlFor="pp" className="text-sm">
            Community prompts
          </label>
          <Switch id="pp" checked={s.publicUserPromptsEnabled} onCheckedChange={(v) => setS({ ...s, publicUserPromptsEnabled: v })} />
        </div>
        <div className="sm:col-span-3">
          <Button type="submit" loading={busy === "settings"}>
            Save settings
          </Button>
        </div>
      </form>
    </Panel>
  );
}

export interface ModelRow {
  id: string;
  displayName: string;
  provider: string;
  kind: string;
  enabled: boolean;
  available: boolean;
  creditsPerImage: number;
  hdMultiplier: number;
  maxImages: number;
  estimatedCostUsd: number;
  modelVersion: string;
}

export function ModelsTable({ models }: { models: ModelRow[] }) {
  const [rows, setRows] = useState(models);
  const { busy, run } = useSaver();
  const set = (id: string, patch: Partial<ModelRow>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  return (
    <Panel className="overflow-x-auto p-5">
      <h2 className="font-display font-semibold">AI models & credit costs</h2>
      <p className="mt-1 text-sm text-muted">Costs apply to new requests immediately. A model is offered to users only when it is enabled and its provider key is configured.</p>
      <table className="mt-4 w-full min-w-[920px] text-sm">
        <thead className="text-left text-muted">
          <tr>
            <th className="py-2 font-medium">Model</th>
            <th className="py-2 font-medium">Enabled</th>
            <th className="py-2 font-medium">Credits / image</th>
            <th className="py-2 font-medium">HD ×</th>
            <th className="py-2 font-medium">Max images</th>
            <th className="py-2 font-medium">Est. USD / image</th>
            <th className="py-2 font-medium">Version label</th>
            <th />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((m) => (
            <tr key={m.id}>
              <td className="py-2 pr-3">
                <div className="font-medium">{m.displayName}</div>
                <div className="text-xs text-muted">
                  {m.provider} · {m.kind.toLowerCase().replace("_", " ")} {!m.available && m.enabled && <Badge tone="warn">no API key</Badge>}
                </div>
              </td>
              <td className="py-2 pr-3">
                <Switch label={`Enable ${m.displayName}`} checked={m.enabled} onCheckedChange={(v) => set(m.id, { enabled: v })} />
              </td>
              <td className="py-2 pr-3">
                <Input type="number" min={0} className="h-8 w-20" value={m.creditsPerImage} onChange={(e) => set(m.id, { creditsPerImage: Number(e.target.value) })} aria-label="Credits per image" />
              </td>
              <td className="py-2 pr-3">
                <Input type="number" min={1} max={10} className="h-8 w-16" value={m.hdMultiplier} onChange={(e) => set(m.id, { hdMultiplier: Number(e.target.value) })} aria-label="HD multiplier" />
              </td>
              <td className="py-2 pr-3">
                <Input type="number" min={1} max={8} className="h-8 w-16" value={m.maxImages} onChange={(e) => set(m.id, { maxImages: Number(e.target.value) })} aria-label="Max images" />
              </td>
              <td className="py-2 pr-3">
                <Input type="number" min={0} step="0.001" className="h-8 w-24" value={m.estimatedCostUsd} onChange={(e) => set(m.id, { estimatedCostUsd: Number(e.target.value) })} aria-label="Estimated cost" />
              </td>
              <td className="py-2 pr-3">
                <Input className="h-8 w-48" value={m.modelVersion} onChange={(e) => set(m.id, { modelVersion: e.target.value })} aria-label="Model version" />
              </td>
              <td className="py-2">
                <Button
                  size="sm"
                  variant="secondary"
                  loading={busy === m.id}
                  onClick={() =>
                    run(m.id, () => api(`/api/admin/models/${m.id}`, { method: "PATCH", body: { enabled: m.enabled, creditsPerImage: m.creditsPerImage, hdMultiplier: m.hdMultiplier, maxImages: m.maxImages, estimatedCostUsd: m.estimatedCostUsd, modelVersion: m.modelVersion } }), `${m.displayName} saved`)
                  }
                >
                  Save
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

export interface PackageRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  credits: number;
  pricePaise: number;
  active: boolean;
  highlight: boolean;
  sortOrder: number;
}

export function PackagesTable({ packages }: { packages: PackageRow[] }) {
  const [rows, setRows] = useState(packages);
  const [draft, setDraft] = useState({ slug: "", name: "", credits: 100, rupees: 99 });
  const { busy, run } = useSaver();
  const set = (id: string, patch: Partial<PackageRow>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const create = (e: FormEvent) => {
    e.preventDefault();
    void run("new", () => api("/api/admin/packages", { body: { slug: draft.slug, name: draft.name, credits: draft.credits, pricePaise: Math.round(draft.rupees * 100), sortOrder: rows.length + 1 } }), "Package created");
  };
  return (
    <Panel className="overflow-x-auto p-5">
      <h2 className="font-display font-semibold">Credit packages</h2>
      <p className="mt-1 text-sm text-muted">Price changes apply to new checkouts. Existing orders keep the price they were created with. Disable a package instead of deleting it.</p>
      <table className="mt-4 w-full min-w-[760px] text-sm">
        <thead className="text-left text-muted">
          <tr>
            <th className="py-2 font-medium">Name</th>
            <th className="py-2 font-medium">Credits</th>
            <th className="py-2 font-medium">Price (₹)</th>
            <th className="py-2 font-medium">Active</th>
            <th className="py-2 font-medium">Highlight</th>
            <th />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((p) => (
            <tr key={p.id}>
              <td className="py-2 pr-3">
                <Input className="h-8 w-40" value={p.name} onChange={(e) => set(p.id, { name: e.target.value })} aria-label="Name" />
                <div className="mt-1 text-xs text-faint">{p.slug}</div>
              </td>
              <td className="py-2 pr-3">
                <Input type="number" min={1} className="h-8 w-24" value={p.credits} onChange={(e) => set(p.id, { credits: Number(e.target.value) })} aria-label="Credits" />
              </td>
              <td className="py-2 pr-3">
                <Input type="number" min={1} step="1" className="h-8 w-24" value={p.pricePaise / 100} onChange={(e) => set(p.id, { pricePaise: Math.round(Number(e.target.value) * 100) })} aria-label="Price in rupees" />
                <div className="mt-1 text-xs text-faint">{formatInr(Math.round(p.pricePaise / Math.max(1, p.credits)))} / credit</div>
              </td>
              <td className="py-2 pr-3">
                <Switch label="Active" checked={p.active} onCheckedChange={(v) => set(p.id, { active: v })} />
              </td>
              <td className="py-2 pr-3">
                <Switch label="Highlight" checked={p.highlight} onCheckedChange={(v) => set(p.id, { highlight: v })} />
              </td>
              <td className="py-2">
                <Button size="sm" variant="secondary" loading={busy === p.id} onClick={() => run(p.id, () => api(`/api/admin/packages/${p.id}`, { method: "PATCH", body: { name: p.name, credits: p.credits, pricePaise: p.pricePaise, active: p.active, highlight: p.highlight } }), "Package saved")}>
                  Save
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form onSubmit={create} className="mt-5 flex flex-wrap items-end gap-2 border-t border-line pt-4">
        <Field label="Slug" htmlFor="np-slug">
          <Input id="np-slug" className="w-32" value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} required />
        </Field>
        <Field label="Name" htmlFor="np-name">
          <Input id="np-name" className="w-36" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
        </Field>
        <Field label="Credits" htmlFor="np-cr">
          <Input id="np-cr" type="number" className="w-24" value={draft.credits} onChange={(e) => setDraft({ ...draft, credits: Number(e.target.value) })} />
        </Field>
        <Field label="Price ₹" htmlFor="np-pr">
          <Input id="np-pr" type="number" className="w-24" value={draft.rupees} onChange={(e) => setDraft({ ...draft, rupees: Number(e.target.value) })} />
        </Field>
        <Button type="submit" loading={busy === "new"}>
          Add package
        </Button>
      </form>
    </Panel>
  );
}

export interface PlanRow {
  id: string;
  name: string;
  monthlyCredits: number;
  pricePaise: number;
  razorpayPlanId: string | null;
  active: boolean;
}

export function PlansTable({ plans }: { plans: PlanRow[] }) {
  const [rows, setRows] = useState(plans);
  const { busy, run } = useSaver();
  const set = (id: string, patch: Partial<PlanRow>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  return (
    <Panel className="overflow-x-auto p-5">
      <h2 className="font-display font-semibold">Subscription plans</h2>
      <p className="mt-1 text-sm text-muted">Create a matching monthly plan in the Razorpay dashboard (Subscriptions → Plans) with the same price, then paste its plan ID here. Plans without an ID are shown as “coming soon”.</p>
      <table className="mt-4 w-full min-w-[760px] text-sm">
        <thead className="text-left text-muted">
          <tr>
            <th className="py-2 font-medium">Plan</th>
            <th className="py-2 font-medium">Credits / month</th>
            <th className="py-2 font-medium">Price (₹)</th>
            <th className="py-2 font-medium">Razorpay plan ID</th>
            <th className="py-2 font-medium">Active</th>
            <th />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((p) => (
            <tr key={p.id}>
              <td className="py-2 pr-3 font-medium">{p.name}</td>
              <td className="py-2 pr-3">
                <Input type="number" className="h-8 w-24" value={p.monthlyCredits} onChange={(e) => set(p.id, { monthlyCredits: Number(e.target.value) })} aria-label="Monthly credits" />
              </td>
              <td className="py-2 pr-3">
                <Input type="number" className="h-8 w-24" value={p.pricePaise / 100} onChange={(e) => set(p.id, { pricePaise: Math.round(Number(e.target.value) * 100) })} aria-label="Price" />
              </td>
              <td className="py-2 pr-3">
                <Input className="h-8 w-48 font-mono text-xs" placeholder="plan_XXXXXXXX" value={p.razorpayPlanId ?? ""} onChange={(e) => set(p.id, { razorpayPlanId: e.target.value || null })} aria-label="Razorpay plan ID" />
              </td>
              <td className="py-2 pr-3">
                <Switch label="Active" checked={p.active} onCheckedChange={(v) => set(p.id, { active: v })} />
              </td>
              <td className="py-2">
                <Button size="sm" variant="secondary" loading={busy === p.id} onClick={() => run(p.id, () => api(`/api/admin/plans/${p.id}`, { method: "PATCH", body: { monthlyCredits: p.monthlyCredits, pricePaise: p.pricePaise, razorpayPlanId: p.razorpayPlanId, active: p.active } }), "Plan saved")}>
                  Save
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

export interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  level: string;
  active: boolean;
}

export function Announcements({ items }: { items: AnnouncementRow[] }) {
  const confirm = useConfirm();
  const [draft, setDraft] = useState({ title: "", body: "", level: "info" });
  const { busy, run } = useSaver();
  return (
    <Panel className="p-5">
      <h2 className="font-display font-semibold">Announcements</h2>
      <p className="mt-1 text-sm text-muted">Active announcements appear as a dismissible banner in the dashboard.</p>
      <ul className="mt-4 divide-y divide-line">
        {items.map((a) => (
          <li key={a.id} className="flex items-start justify-between gap-3 py-3 text-sm">
            <div>
              <p className="font-medium">
                {a.title} <Badge tone={a.active ? "ok" : "neutral"}>{a.active ? "active" : "hidden"}</Badge> <Badge>{a.level}</Badge>
              </p>
              <p className="text-muted">{a.body}</p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button size="sm" variant="ghost" loading={busy === a.id} onClick={() => run(a.id, () => api(`/api/admin/announcements/${a.id}`, { method: "PATCH", body: { active: !a.active } }), a.active ? "Hidden" : "Activated")}>
                {a.active ? "Hide" : "Show"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  if (await confirm({ title: "Delete announcement?", confirmLabel: "Delete", danger: true })) void run(`d${a.id}`, () => api(`/api/admin/announcements/${a.id}`, { method: "DELETE" }), "Deleted");
                }}
              >
                Delete
              </Button>
            </div>
          </li>
        ))}
        {items.length === 0 && <li className="py-3 text-sm text-muted">No announcements.</li>}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run("new-ann", () => api("/api/admin/announcements", { body: draft }), "Announcement published").then(() => setDraft({ title: "", body: "", level: "info" }));
        }}
        className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-[1fr_140px]"
      >
        <Input placeholder="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} required aria-label="Title" />
        <Select value={draft.level} onChange={(e) => setDraft({ ...draft, level: e.target.value })} aria-label="Level">
          <option value="info">Info</option>
          <option value="success">Success</option>
          <option value="warning">Warning</option>
        </Select>
        <Textarea placeholder="Message" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} required rows={2} className="sm:col-span-2" aria-label="Message" />
        <div>
          <Button type="submit" loading={busy === "new-ann"}>
            Publish announcement
          </Button>
        </div>
      </form>
    </Panel>
  );
}
