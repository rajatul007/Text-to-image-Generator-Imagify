import Redis from "ioredis";

const g = globalThis as unknown as { __redis?: Redis | null };

/** Shared Redis connection, or null when REDIS_URL is not configured. */
export function getRedis(): Redis | null {
  if (g.__redis !== undefined) return g.__redis;
  const url = process.env.REDIS_URL;
  if (!url) {
    g.__redis = null;
    return null;
  }
  const client = new Redis(url, { maxRetriesPerRequest: 2, enableOfflineQueue: false, lazyConnect: false });
  client.on("error", (err) => console.error(JSON.stringify({ level: "error", msg: "redis error", error: err.message })));
  g.__redis = client;
  return client;
}
