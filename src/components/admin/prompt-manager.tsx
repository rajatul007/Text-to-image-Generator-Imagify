"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Star, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { Field, Input, Select, Textarea } from "../ui/field";
import { Badge } from "../ui/misc";
import { Dialog, DialogContent, useConfirm } from "../ui/dialog";
import { api } from "@/lib/client/api";
import { PROMPT_CATEGORIES, categoryLabel } from "@/data/prompt-categories";

export interface AdminTemplate {
  id: string;
  title: string;
  prompt: string;
  negativePrompt: string | null;
  category: string;
  style: string;
  aspectRatio: string;
  previewImageUrl: string | null;
  tags: string[];
  featured: boolean;
  status: "PUBLISHED" | "PENDING" | "ARCHIVED";
  usageCount: number;
  authorEmail: string | null;
}

const EMPTY: Omit<AdminTemplate, "id" | "usageCount" | "authorEmail"> = { title: "", prompt: "", negativePrompt: "", category: "portraits", style: "photorealistic", aspectRatio: "1:1", previewImageUrl: "", tags: [], featured: false, status: "PUBLISHED" };

export function PromptManager({ items, styles }: { items: AdminTemplate[]; styles: { id: string; label: string }[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<(typeof EMPTY & { id?: string }) | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    const { id, ...body } = editing;
    try {
      await api(id ? `/api/admin/prompts/${id}` : "/api/admin/prompts", { method: id ? "PATCH" : "POST", body: { ...body, negativePrompt: body.negativePrompt || null, previewImageUrl: body.previewImageUrl || null } });
      toast.success(id ? "Template updated" : "Template created");
      setEditing(null);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const toggleFeatured = async (t: AdminTemplate) => {
    try {
      await api(`/api/admin/prompts/${t.id}`, { method: "PATCH", body: { featured: !t.featured } });
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };
  const remove = async (t: AdminTemplate) => {
    if (!(await confirm({ title: `Delete “${t.title}”?`, description: "Users who favorited it will lose it. Consider archiving instead.", confirmLabel: "Delete", danger: true }))) return;
    try {
      await api(`/api/admin/prompts/${t.id}`, { method: "DELETE" });
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing({ ...EMPTY })}>
          <Plus className="size-4" /> New template
        </Button>
      </div>
      <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-line">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-panel-2 text-left text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Uses</th>
              <th className="px-4 py-3 font-medium">Author</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-panel">
            {items.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-2.5">
                  <div className="font-medium">{t.title}</div>
                  <div className="max-w-md truncate text-xs text-muted">{t.prompt}</div>
                </td>
                <td className="px-4 py-2.5 text-muted">{categoryLabel(t.category)}</td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-1">
                    <Badge tone={t.status === "PUBLISHED" ? "ok" : "neutral"}>{t.status.toLowerCase()}</Badge>
                    {t.featured && <Badge tone="violet">featured</Badge>}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{t.usageCount}</td>
                <td className="px-4 py-2.5 text-xs text-muted">{t.authorEmail ?? "Team"}</td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => toggleFeatured(t)} aria-label={t.featured ? "Unfeature" : "Feature"}>
                      <Star className={t.featured ? "size-4 fill-current text-violet" : "size-4"} />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditing({ ...t, negativePrompt: t.negativePrompt ?? "", previewImageUrl: t.previewImageUrl ?? "" })} aria-label="Edit">
                      <Pencil className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(t)} aria-label="Delete">
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent title={editing.id ? "Edit template" : "New template"} wide>
            <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
              <Field label="Title" htmlFor="t-title" className="sm:col-span-2">
                <Input id="t-title" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} required />
              </Field>
              <Field label="Prompt" htmlFor="t-prompt" className="sm:col-span-2">
                <Textarea id="t-prompt" value={editing.prompt} onChange={(e) => setEditing({ ...editing, prompt: e.target.value })} rows={4} required />
              </Field>
              <Field label="Negative prompt" htmlFor="t-neg" className="sm:col-span-2">
                <Input id="t-neg" value={editing.negativePrompt ?? ""} onChange={(e) => setEditing({ ...editing, negativePrompt: e.target.value })} />
              </Field>
              <Field label="Category" htmlFor="t-cat">
                <Select id="t-cat" value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>
                  {PROMPT_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Suggested style" htmlFor="t-style">
                <Select id="t-style" value={editing.style} onChange={(e) => setEditing({ ...editing, style: e.target.value })}>
                  {styles.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Aspect ratio" htmlFor="t-ar">
                <Select id="t-ar" value={editing.aspectRatio} onChange={(e) => setEditing({ ...editing, aspectRatio: e.target.value })}>
                  {["1:1", "4:5", "2:3", "9:16", "5:4", "3:2", "16:9", "21:9"].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Status" htmlFor="t-status">
                <Select id="t-status" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as AdminTemplate["status"] })}>
                  <option value="PUBLISHED">Published</option>
                  <option value="PENDING">Pending</option>
                  <option value="ARCHIVED">Archived</option>
                </Select>
              </Field>
              <Field label="Preview image URL" htmlFor="t-prev" hint="https:// or /path – e.g. a public image's /api/images/…/file?variant=thumb">
                <Input id="t-prev" value={editing.previewImageUrl ?? ""} onChange={(e) => setEditing({ ...editing, previewImageUrl: e.target.value })} />
              </Field>
              <Field label="Tags" htmlFor="t-tags" hint="Comma separated">
                <Input id="t-tags" value={editing.tags.join(", ")} onChange={(e) => setEditing({ ...editing, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
              </Field>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" checked={editing.featured} onChange={(e) => setEditing({ ...editing, featured: e.target.checked })} className="accent-[var(--violet)]" /> Featured
              </label>
              <Button type="submit" loading={saving} className="sm:col-span-2">
                {editing.id ? "Save changes" : "Create template"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
