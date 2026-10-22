import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-[var(--radius-panel)] border border-line bg-panel", className)} {...props} />;
}

export function Badge({ className, tone = "neutral", ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "violet" | "ok" | "warn" | "danger" | "blue" }) {
  const tones = {
    neutral: "bg-panel-2 text-muted border-line",
    violet: "bg-violet/12 text-violet border-violet/25",
    blue: "bg-blue/12 text-blue border-blue/25",
    ok: "bg-ok/12 text-ok border-ok/25",
    warn: "bg-warn/12 text-warn border-warn/25",
    danger: "bg-danger/12 text-danger border-danger/25",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", tones[tone], className)} {...props} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-lg", className)} aria-hidden />;
}

export function EmptyState({ icon, title, children, action, className }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-[var(--radius-panel)] border border-dashed border-line px-6 py-14 text-center", className)}>
      {icon && <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-panel-2 text-violet">{icon}</div>}
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {children && <div className="mt-1.5 max-w-sm text-sm text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, className }: { label: string; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <Panel className={cn("p-4", className)}>
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-faint">{hint}</div>}
    </Panel>
  );
}

export function Alert({ tone = "neutral", title, children, className, action }: { tone?: "neutral" | "warn" | "danger" | "ok" | "violet"; title?: string; children?: ReactNode; className?: string; action?: ReactNode }) {
  const tones = {
    neutral: "border-line bg-panel-2",
    violet: "border-violet/30 bg-violet/8",
    warn: "border-warn/30 bg-warn/8",
    danger: "border-danger/30 bg-danger/8",
    ok: "border-ok/30 bg-ok/8",
  };
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex flex-col gap-3 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between", tones[tone], className)}>
      <div>
        {title && <div className="font-medium">{title}</div>}
        {children && <div className="text-muted">{children}</div>}
      </div>
      {action}
    </div>
  );
}
