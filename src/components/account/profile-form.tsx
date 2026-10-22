"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Camera } from "lucide-react";
import { Button } from "../ui/button";
import { Field, Input, Textarea } from "../ui/field";
import { Panel } from "../ui/misc";
import { Avatar } from "../layout/app-shell";
import { api, ApiClientError } from "@/lib/client/api";

export function ProfileForm({ initial }: { initial: { name: string; displayName: string; username: string; bio: string; email: string; avatarUrl: string | null } }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [avatar, setAvatar] = useState(initial.avatarUrl);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const file = useRef<HTMLInputElement>(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFields({});
    try {
      await api("/api/profile", { method: "PATCH", body: { name: form.name, displayName: form.displayName, username: form.username, bio: form.bio || null } });
      toast.success("Profile saved");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.fields) setFields(err.fields);
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const upload = async (f?: File) => {
    if (!f) return;
    const data = new FormData();
    data.append("file", f);
    try {
      const res = await api<{ avatarUrl: string }>("/api/profile/avatar", { form: data });
      setAvatar(res.avatarUrl);
      toast.success("Profile picture updated");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const removeAvatar = async () => {
    try {
      await api("/api/profile/avatar", { method: "DELETE" });
      setAvatar(null);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <form onSubmit={save} className="space-y-6">
      <Panel className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <Avatar name={form.displayName || form.name} url={avatar} size={72} />
        <div className="flex flex-wrap gap-2">
          <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} aria-label="Upload profile picture" />
          <Button type="button" variant="secondary" size="sm" onClick={() => file.current?.click()}>
            <Camera className="size-4" /> Upload picture
          </Button>
          {avatar && (
            <Button type="button" variant="ghost" size="sm" onClick={removeAvatar}>
              Remove
            </Button>
          )}
        </div>
      </Panel>
      <Panel className="grid gap-4 p-5 sm:grid-cols-2">
        <Field label="Full name" htmlFor="name" error={fields.name}>
          <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={60} required />
        </Field>
        <Field label="Display name" htmlFor="displayName" hint="Shown on public images" error={fields.displayName}>
          <Input id="displayName" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} maxLength={60} required />
        </Field>
        <Field label="Username" htmlFor="username" hint="Used in your creator link" error={fields.username}>
          <Input id="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} maxLength={24} required />
        </Field>
        <Field label="Email" htmlFor="email" hint="Contact support to change">
          <Input id="email" value={form.email} disabled />
        </Field>
        <Field label="Bio" htmlFor="bio" hint={`${form.bio.length}/280`} className="sm:col-span-2" error={fields.bio}>
          <Textarea id="bio" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} maxLength={280} rows={3} />
        </Field>
      </Panel>
      <div className="flex justify-end">
        <Button type="submit" loading={saving}>
          Save profile
        </Button>
      </div>
    </form>
  );
}
