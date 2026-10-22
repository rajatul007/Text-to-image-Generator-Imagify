import { db } from "./db";

type Level = "debug" | "info" | "warn" | "error";

function emit(level: Level, msg: string, ctx?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "test" && level !== "error" && process.env.LOG_IN_TESTS !== "1") return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...sanitize(ctx) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

const SECRET_KEYS = /pass(word)?|secret|token|authorization|api[-_]?key|signature|cookie/i;

function sanitize(ctx?: Record<string, unknown>): Record<string, unknown> {
  if (!ctx) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (SECRET_KEYS.test(k)) out[k] = "[redacted]";
    else if (v instanceof Error) out[k] = { name: v.name, message: v.message };
    else out[k] = v;
  }
  return out;
}

export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => emit("debug", msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => emit("info", msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => emit("warn", msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => emit("error", msg, ctx),
};

/** Logs and persists an application error so administrators can review it. Never throws. */
export async function recordError(source: string, err: unknown, context: Record<string, unknown> = {}, userId?: string) {
  const message = err instanceof Error ? err.message : String(err);
  logger.error(`[${source}] ${message}`, { ...context, stack: err instanceof Error ? err.stack?.split("\n").slice(0, 6).join(" | ") : undefined });
  try {
    await db.errorLog.create({
      data: {
        level: "error",
        source,
        message: message.slice(0, 2000),
        context: JSON.parse(JSON.stringify(sanitize(context))),
        userId,
      },
    });
  } catch {
    /* logging must never break the request */
  }
}
