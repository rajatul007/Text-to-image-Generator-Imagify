"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { Alert } from "../ui/misc";
import { Spinner } from "../ui/spinner";
import { api } from "@/lib/client/api";

/** Verification happens on an explicit POST (not on GET) so email link scanners can't consume the token. */
export function VerifyEmail({ token }: { token: string | null }) {
  const [state, setState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const started = useRef(false);

  const verify = async () => {
    if (!token) return;
    setState("loading");
    try {
      const res = await api<{ balance: number }>("/api/auth/verify-email", { body: { token } });
      setBalance(res.balance);
      setState("ok");
    } catch (e) {
      setMessage((e as Error).message);
      setState("error");
    }
  };

  useEffect(() => {
    if (token && !started.current) {
      started.current = true;
       
      void verify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token)
    return (
      <Alert tone="danger" title="Missing verification link">
        Open the link from your email, or resend it from your dashboard.
      </Alert>
    );
  if (state === "loading" || state === "idle")
    return (
      <div className="flex items-center gap-3 text-sm text-muted">
        <Spinner className="size-5 text-violet" /> Verifying your email…
      </div>
    );
  if (state === "error")
    return (
      <div className="space-y-4">
        <Alert tone="danger" title="We couldn't verify your email">
          {message}
        </Alert>
        <Button asChild variant="secondary" className="w-full">
          <Link href="/dashboard">Go to dashboard to resend</Link>
        </Button>
      </div>
    );
  return (
    <div className="space-y-4">
      <Alert tone="ok" title="Email verified">
        {balance !== null ? `Your wallet now has ${balance} credits.` : "You're all set."}
      </Alert>
      <Button asChild className="w-full" size="lg">
        <Link href="/generate">Create your first image</Link>
      </Button>
    </div>
  );
}
