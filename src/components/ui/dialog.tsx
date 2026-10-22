"use client";

import * as D from "@radix-ui/react-dialog";
import * as AD from "@radix-ui/react-alert-dialog";
import { X } from "lucide-react";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({ title, description, children, className, wide }: { title: string; description?: ReactNode; children: ReactNode; className?: string; wide?: boolean }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
      <D.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-line bg-panel p-5 shadow-[var(--shadow)] scrollbar-thin sm:p-6",
          wide ? "max-w-4xl" : "max-w-lg",
          className,
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <D.Title className="font-display text-lg font-semibold">{title}</D.Title>
            {description ? <D.Description className="mt-1 text-sm text-muted">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
          </div>
          <D.Close className="rounded-lg p-1 text-muted hover:bg-panel-2 hover:text-text" aria-label="Close">
            <X className="size-5" />
          </D.Close>
        </div>
        {children}
      </D.Content>
    </D.Portal>
  );
}

interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

const ConfirmCtx = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false);

/** Accessible confirmation dialogs: `const confirm = useConfirm(); if (await confirm({...})) ...` */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const confirm = useCallback((o: ConfirmOptions) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => (resolver.current = resolve));
  }, []);
  const close = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setOpts(null);
  };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <AD.Root open={Boolean(opts)} onOpenChange={(o) => !o && close(false)}>
        <AD.Portal>
          <AD.Overlay className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" />
          <AD.Content className="fixed left-1/2 top-1/2 z-[60] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line bg-panel p-6 shadow-[var(--shadow)]">
            <AD.Title className="font-display text-lg font-semibold">{opts?.title}</AD.Title>
            {opts?.description ? <AD.Description className="mt-2 text-sm text-muted">{opts.description}</AD.Description> : <AD.Description className="sr-only">{opts?.title}</AD.Description>}
            <div className="mt-6 flex justify-end gap-2">
              <AD.Cancel asChild>
                <Button variant="ghost">{opts?.cancelLabel ?? "Cancel"}</Button>
              </AD.Cancel>
              <AD.Action asChild>
                <Button variant={opts?.danger ? "danger" : "primary"} onClick={() => close(true)}>
                  {opts?.confirmLabel ?? "Confirm"}
                </Button>
              </AD.Action>
            </div>
          </AD.Content>
        </AD.Portal>
      </AD.Root>
    </ConfirmCtx.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmCtx);
