"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "../ui/button";
import { EmptyState, Panel } from "../ui/misc";
import { api } from "@/lib/client/api";

export function EditorPicker({ recent, maxMb, verified }: { recent: { id: string; thumbUrl: string; prompt: string | null }[]; maxMb: number; verified: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return toast.error("Use a PNG, JPEG or WebP image");
    if (file.size > maxMb * 1024 * 1024) return toast.error(`Image must be smaller than ${maxMb} MB`);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api<{ image: { id: string } }>("/api/uploads", { form });
      router.push(`/editor/${res.image.id}`);
    } catch (e) {
      toast.error((e as Error).message);
      setUploading(false);
    }
  };

  return (
    <div className="space-y-8">
      <Panel
        className={`flex flex-col items-center justify-center border-dashed px-6 py-12 text-center transition-colors ${drag ? "border-violet bg-violet/5" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (verified) void upload(e.dataTransfer.files[0]);
        }}
      >
        <Upload className="size-8 text-violet" aria-hidden />
        <h2 className="font-display mt-3 text-lg font-semibold">Upload an image to edit</h2>
        <p className="mt-1 text-sm text-muted">PNG, JPEG or WebP up to {maxMb} MB. Uploads are private and stripped of location metadata.</p>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} aria-label="Choose image file" />
        <Button className="mt-5" onClick={() => input.current?.click()} loading={uploading} disabled={!verified}>
          Choose image
        </Button>
        {!verified && <p className="mt-2 text-xs text-warn">Verify your email to upload images.</p>}
      </Panel>
      <section>
        <h2 className="font-display mb-3 text-lg font-semibold">Or pick one of your images</h2>
        {recent.length === 0 ? (
          <EmptyState title="No images yet" action={<Button asChild><Link href="/generate">Generate one</Link></Button>}>
            Generate or upload an image to start editing.
          </EmptyState>
        ) : (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {recent.map((r) => (
              <li key={r.id}>
                <Link href={`/editor/${r.id}`} className="block overflow-hidden rounded-lg border border-line hover:border-violet">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.thumbUrl} alt={r.prompt?.slice(0, 80) ?? "Image"} className="aspect-square w-full object-cover" loading="lazy" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
