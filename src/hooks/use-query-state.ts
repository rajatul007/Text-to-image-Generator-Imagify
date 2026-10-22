"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

/** Keeps list filters in the URL so they survive reloads and can be shared/bookmarked. */
export function useQueryState<K extends string>(keys: readonly K[]) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const values = useMemo(() => Object.fromEntries(keys.map((k) => [k, sp.get(k) ?? ""])) as Record<K, string>, [sp, keys]);
  const set = useCallback(
    (patch: Partial<Record<K | "page" | "open", string>>) => {
      const next = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v) next.set(k, v as string);
        else next.delete(k);
      }
      if (!("page" in patch)) next.delete("page");
      router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
    },
    [sp, router, pathname],
  );
  return [values, set, sp] as const;
}
