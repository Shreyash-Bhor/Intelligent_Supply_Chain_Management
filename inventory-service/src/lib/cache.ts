import { randomUUID } from "node:crypto";
import { createClient } from "redis";

type CacheRedis = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { EX?: number; NX?: boolean }): Promise<unknown>;
};
type CacheProvider = () => Promise<CacheRedis | null>;

const redisUrl = process.env.REDIS_URL;
const client = redisUrl
  ? createClient({ url: redisUrl, socket: { connectTimeout: 1_000, reconnectStrategy: (retries) => retries < 2 ? 250 : false } })
  : null;
let connectPromise: Promise<void> | null = null;
if (client) client.on("error", (error) => console.warn(JSON.stringify({ event: "redis_error", message: error.message })));

async function getClient(): Promise<CacheRedis | null> {
  if (!client) return null;
  if (!client.isOpen) {
    connectPromise ??= client.connect().then(() => undefined).finally(() => { connectPromise = null; });
    try { await connectPromise; } catch { return null; }
  }
  return client.isReady ? client : null;
}

/** Injectable cache operations make invalidation and concurrency behavior testable without Redis. */
export function createCacheStore(provider: CacheProvider, timeoutMs = 300) {
  const inFlight = new Map<string, Promise<unknown>>();
  const bounded = <T>(operation: Promise<T>, fallback: T): Promise<T> => new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(fallback), timeoutMs);
    operation.then(resolve, () => resolve(fallback)).finally(() => clearTimeout(timeout));
  });
  const versionFor = async (redis: CacheRedis, namespace: string) => {
    const key = `cache:version:${namespace}`;
    let version = await redis.get(key);
    if (version) return version;
    const candidate = randomUUID();
    await redis.set(key, candidate, { NX: true });
    version = await redis.get(key);
    return version ?? candidate;
  };
  const invalidate = async (...namespaces: string[]) => {
    try {
      const redis = await provider();
      if (!redis) return;
      await Promise.all(namespaces.map((namespace) => bounded(redis.set(`cache:version:${namespace}`, randomUUID()), undefined)));
    } catch { /* Cache errors never fail a committed write. */ }
  };
  const readThrough = async <T>(key: string, namespace: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> => {
    let redis: CacheRedis | null;
    try { redis = await provider(); } catch { return loader(); }
    if (!redis) return loader();
    let version: string;
    try {
      version = await bounded(versionFor(redis, namespace), "");
      if (!version) return loader();
      const cached = await bounded(redis.get(`cache:${namespace}:${version}:${key}`), null);
      if (cached !== null) return JSON.parse(cached) as T;
    } catch { return loader(); }

    const flightKey = `${namespace}:${version}:${key}`;
    const pending = inFlight.get(flightKey) as Promise<T> | undefined;
    if (pending) return pending;
    const load = (async () => {
      let readVersion = version;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const value = await loader();
        try {
          const latestVersion = await bounded(versionFor(redis, namespace), "");
          if (latestVersion && latestVersion !== readVersion) { readVersion = latestVersion; continue; }
          if (latestVersion === readVersion) await bounded(redis.set(`cache:${namespace}:${readVersion}:${key}`, JSON.stringify(value), { EX: ttlSeconds }), undefined);
        } catch { /* Cache errors never fail a database-backed request. */ }
        return value;
      }
      return loader();
    })();
    inFlight.set(flightKey, load);
    try { return await load; } finally { inFlight.delete(flightKey); }
  };
  return { getOrLoad: readThrough, invalidate };
}

const cacheStore = createCacheStore(getClient);
export const getOrLoad = cacheStore.getOrLoad;
export const invalidateCache = cacheStore.invalidate;

/** Call invalidation only after the supplied database transaction commits. */
export async function commitThenInvalidate<T>(commit: () => Promise<T>, ...namespaces: string[]): Promise<T> {
  return afterSuccessfulCommit(commit, invalidateCache, ...namespaces);
}

export async function afterSuccessfulCommit<T>(commit: () => Promise<T>, invalidate: (...namespaces: string[]) => Promise<void>, ...namespaces: string[]): Promise<T> {
  const result = await commit();
  await invalidate(...namespaces);
  return result;
}
