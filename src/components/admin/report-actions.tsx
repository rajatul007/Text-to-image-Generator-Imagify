"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { useConfirm } from "../ui/dialog";
import { api } from "@/lib/client/api";

export function ReportActions({ reportId }: { reportId: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);
  const act = async (action: "dismiss" | "remove") => {
    if (action === "remove" && !(await confirm({ title: "Remove from Explore?", description: "The image becomes private, share links are revoked and the creator is notified. It stays in their private gallery.", confirmLabel: "Remove image", danger: true }))) return;
    setBusy(action);
    try {
      await api(`/api/admin/reports/${reportId}`, { method: "PATCH", body: { action } });
      toast.success(action === "remove" ? "Image removed from public gallery" : "Report dismissed");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="secondary" onClick={() => act("dismiss")} loading={busy === "dismiss"}>
        Dismiss
      </Button>
      <Button size="sm" variant="danger" onClick={() => act("remove")} loading={busy === "remove"}>
        Remove image
      </Button>
    </div>
  );
}
