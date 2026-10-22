"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import type { ReactNode } from "react";
import { TooltipProvider } from "./ui/tooltip";
import { ConfirmProvider } from "./ui/dialog";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} themes={["dark", "light"]} disableTransitionOnChange>
      <TooltipProvider>
        <ConfirmProvider>{children}</ConfirmProvider>
      </TooltipProvider>
      <Toaster
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast: "!bg-panel !border !border-line !text-text !rounded-xl !shadow-[var(--shadow)]",
            description: "!text-muted",
            error: "!border-danger/40",
            success: "!border-ok/40",
          },
        }}
      />
    </ThemeProvider>
  );
}
