"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="main" className="flex min-h-[60dvh] flex-col items-center justify-center px-4 text-center">
      <h1 className="font-display text-3xl font-semibold">This page failed to load</h1>
      <p className="mt-2 max-w-md text-sm text-muted">Something went wrong on our side. Your work is saved. Try again, and if it keeps happening, contact support{error.digest ? ` with code ${error.digest}` : ""}.</p>
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
