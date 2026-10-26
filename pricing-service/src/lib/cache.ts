import { randomUUID } from "node:crypto";
import { createClient } from "redis";

const client = process.env.REDIS_URL ? createClient({ url: process.env.REDIS_URL, socket: { connectTimeout: 1_000, reconnectStrategy: (retries) => retries < 2 ? 250 : false } }) : null;
let connectPromise: Promise<void> | null = null;
let cacheVersion = new Map<string, Promise<unknown>>();
client?.on("error", (error) => console.warn(JSON.stringify({ event: "redis_error", service: "pricing", message: error.message })));

async function redisClient() {
  if (!client) return null;
  if (!client.isOpen) {
    connectPromise ??= client.connect().then(() => undefined).finally(() => { connectPromise = null; });
    try { await connectPromise; } catch { return null; }
  }
  return client.isReady ? client : null;
}

function bounded<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), 300);
    promise.then(resolve, () => resolve(fallback)).finally(() => clearTimeout(timer));
  });
}

async function version(redis: NonNullable<Awaited<ReturnType<typeof redisClient>>>, namespace: string) {
  const key = `cache:version:${namespace}`;
  let value = await redis.get(key);
  if (value) return value;
  const candidate = randomUUID();
  await redis.set(key, candidate, { NX: true });
  value = await redis.get(key);
  return value ?? candidate;
}

export async function getOrLoad<T>(key: string, namespace: string, ttl: number, loader: () => Promise<T>): Promise<T> {
  let redis;
  try { redis = await redisClient(); } catch { return loader(); }
  if (!redis) return loader();
  let revision: string;
  try {
    revision = await bounded(version(redis, namespace), "");
    if (!revision) return loader();
    const cached = await bounded(redis.get(`cache:${namespace}:${revision}:${key}`), null);
    if (cached !== null) return JSON.parse(cached) as T;
  } catch { return loader(); }
  const flightKey = `${namespace}:${revision}:${key}`;
  const pending = cacheVersion.get(flightKey) as Promise<T> | undefined;
  if (pending) return pending;
  const flight = (async () => {
    let readRevision = revision;
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await loader();
      try {
        const latest = await bounded(version(redis, namespace), "");
        if (latest && latest !== readRevision) { readRevision = latest; continue; }
        if (latest === readRevision) await bounded(redis.set(`cache:${namespace}:${latest}:${key}`, JSON.stringify(result), { EX: ttl }), undefined);
      } catch { /* Cache failures are isolated from the request path. */ }
      return result;
    }
    return loader();
  })();
  cacheVersion.set(flightKey, flight);
  try { return await flight; } finally { cacheVersion.delete(flightKey); }
}

export async function invalidateCache(...namespaces: string[]) {
  try {
    const redis = await redisClient();
    if (!redis) return;
    await Promise.all(namespaces.map((namespace) => bounded(redis.set(`cache:version:${namespace}`, randomUUID()), undefined)));
  } catch { /* A committed price write must succeed when Redis is unavailable. */ }
}

export async function commitThenInvalidate<T>(commit: () => Promise<T>, ...namespaces: string[]): Promise<T> {
  const result = await commit();
  await invalidateCache(...namespaces);
  return result;
}
