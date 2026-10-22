"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";

export function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <nav className="mt-8 flex items-center justify-center gap-3" aria-label="Pagination">
      <Button variant="outline" size="sm" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
        <ChevronLeft className="size-4" /> Previous
      </Button>
      <span className="text-sm text-muted tabular-nums">
        Page {page} of {pages}
      </span>
      <Button variant="outline" size="sm" onClick={() => onChange(page + 1)} disabled={page >= pages} aria-label="Next page">
        Next <ChevronRight className="size-4" />
      </Button>
    </nav>
  );
}
