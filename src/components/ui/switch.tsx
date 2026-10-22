"use client";

import * as S from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export function Switch({ id, checked, onCheckedChange, disabled, label }: { id?: string; checked: boolean; onCheckedChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <S.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={label}
      className={cn("relative h-6 w-11 shrink-0 rounded-full border border-line bg-panel-2 transition-colors data-[state=checked]:border-transparent data-[state=checked]:bg-violet disabled:opacity-50")}
    >
      <S.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[1.3rem]" />
    </S.Root>
  );
}
