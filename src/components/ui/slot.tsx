import { Children, cloneElement, isValidElement, type HTMLAttributes, type ReactElement, type Ref } from "react";
import { cn } from "@/lib/utils";

/** Minimal Slot: merges props/className onto its single child element (for <Button asChild><Link/></Button>). */
export function Slot({ children, className, ref, ...props }: HTMLAttributes<HTMLElement> & { ref?: Ref<HTMLElement> }) {
  const child = Children.only(children);
  if (!isValidElement(child)) return null;
  const el = child as ReactElement<{ className?: string }>;
  // Spinner children are dropped for links – loading state is a button concern.
  return cloneElement(el, { ...props, ref, className: cn(className, el.props.className) } as never);
}
