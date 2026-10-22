"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Button } from "../ui/button";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/utils";

export function VerifyBanner({ email, welcomeCredits }: { email: string; welcomeCredits: number }) {
  const [loading, setLoading] = useState(false);
  const resend = async () => {
    setLoading(true);
    try {
      await api("/api/auth/resend-verification", { method: "POST" });
      toast.success(`Verification email sent to ${email}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="mb-6 flex flex-col gap-3 rounded-xl border border-warn/40 bg-warn/8 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between" role="status">
      <p>
        <span className="font-medium">Verify your email to start generating.</span>{" "}
        <span className="text-muted">
          We sent a link to {email}.{welcomeCredits > 0 ? ` Verifying adds ${welcomeCredits} free credits.` : ""}
        </span>
      </p>
      <Button variant="secondary" size="sm" onClick={resend} loading={loading}>
        Resend email
      </Button>
    </div>
  );
}

export function AnnouncementBanner({ id, title, body, level }: { id: string; title: string; body: string; level: string }) {
  const key = `pf_ann_${id}`;
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read per-viewer dismissal after hydration
      if (localStorage.getItem(key) === "1") setHidden(true);
    } catch {
      /* storage unavailable */
    }
  }, [key]);
  if (hidden) return null;
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm", level === "warning" ? "border-warn/40 bg-warn/8" : level === "success" ? "border-ok/40 bg-ok/8" : "border-violet/30 bg-violet/8")} role="status">
      <p>
        <span className="font-medium">{title}</span> <span className="text-muted">{body}</span>
      </p>
      <button
        onClick={() => {
          try {
            localStorage.setItem(key, "1");
          } catch {
            /* ignore */
          }
          setHidden(true);
        }}
        className="rounded p-0.5 text-muted hover:text-text"
        aria-label="Dismiss announcement"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
