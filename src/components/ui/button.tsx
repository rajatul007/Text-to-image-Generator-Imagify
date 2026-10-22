import { Slot } from "./slot";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background,color,box-shadow,transform,opacity] duration-150 disabled:pointer-events-none disabled:opacity-50 active:translate-y-px select-none",
  {
    variants: {
      variant: {
        primary: "spectrum text-on-accent shadow-[0_8px_24px_-10px_var(--violet)] hover:brightness-110",
        secondary: "bg-panel-2 text-text border border-line hover:border-violet/50",
        ghost: "text-muted hover:text-text hover:bg-panel-2",
        outline: "border border-line text-text hover:bg-panel-2",
        danger: "bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25",
        link: "text-violet underline-offset-4 hover:underline px-0",
      },
      size: {
        sm: "h-8 px-3 text-sm rounded-lg",
        md: "h-10 px-4 text-sm rounded-[var(--radius-field)]",
        lg: "h-12 px-6 text-base rounded-[var(--radius-field)]",
        icon: "h-9 w-9 rounded-lg",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, loading, children, disabled, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {asChild ? (
        children
      ) : (
        <>
          {loading && <Spinner className="size-4" />}
          {children}
        </>
      )}
    </Comp>
  );
});
Button.displayName = "Button";
