"use client";

import * as T from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

export const TooltipProvider = T.Provider;

export function Tooltip({ content, children, side = "top" }: { content: ReactNode; children: ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <T.Root delayDuration={250}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content side={side} sideOffset={6} className="z-50 max-w-64 rounded-lg border border-line bg-panel-2 px-2.5 py-1.5 text-xs text-text shadow-[var(--shadow)]">
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
