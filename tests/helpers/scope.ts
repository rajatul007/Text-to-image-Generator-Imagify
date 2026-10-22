import { AsyncLocalStorage } from "node:async_hooks";

/** Per-request scope used by the next/headers mock, isolated across concurrent calls. */
export interface Scope {
  cookies: Map<string, string>;
  headers: Headers;
  setCookies: { name: string; value: string; opts: Record<string, unknown> }[];
}

export const storage = new AsyncLocalStorage<Scope>();
const fallback: Scope = { cookies: new Map(), headers: new Headers(), setCookies: [] };

export const scope = () => storage.getStore() ?? fallback;
