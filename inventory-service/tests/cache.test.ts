import assert from "node:assert/strict";
import test from "node:test";
import { afterSuccessfulCommit, createCacheStore } from "../src/lib/cache.ts";

function fakeRedis() {
  const values = new Map<string, string>();
  return {
    values,
    async get(key: string) { return values.get(key) ?? null; },
    async set(key: string, value: string, options?: { NX?: boolean }) {
      if (options?.NX && values.has(key)) return null;
      values.set(key, value);
      return "OK";
    },
  };
}

test("cache invalidation switches namespace version and reloads data", async () => {
  const redis = fakeRedis();
  const cache = createCacheStore(async () => redis);
  let loads = 0;
  const load = () => cache.getOrLoad("list", "products", 60, async () => ++loads);

  assert.equal(await load(), 1);
  assert.equal(await load(), 1);
  await cache.invalidate("products");
  assert.equal(await load(), 2);
  assert.equal(loads, 2);
});

test("concurrent cache misses share one database load", async () => {
  const redis = fakeRedis();
  const cache = createCacheStore(async () => redis);
  let loads = 0;
  let resolveLoad!: (value: string) => void;
  const loader = () => {
    loads += 1;
    return new Promise<string>((resolve) => { resolveLoad = resolve; });
  };
  const first = cache.getOrLoad("summary", "dashboard", 10, loader);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const second = cache.getOrLoad("summary", "dashboard", 10, loader);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(loads, 1);
  resolveLoad("current");
  assert.deepEqual(await Promise.all([first, second]), ["current", "current"]);
});

test("a write during a cache fill forces a fresh load and prevents stale fill", async () => {
  const redis = fakeRedis();
  const cache = createCacheStore(async () => redis);
  let resolveFirst!: (value: string) => void;
  let loads = 0;
  const pending = cache.getOrLoad("inventory", "inventory", 10, async () => {
    loads += 1;
    if (loads === 1) return new Promise<string>((resolve) => { resolveFirst = resolve; });
    return "after-write";
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  await cache.invalidate("inventory");
  resolveFirst("before-write");
  assert.equal(await pending, "after-write");
  assert.equal(loads, 2);
});

test("Redis outage falls back to the loader and a failed transaction does not invalidate", async () => {
  const cache = createCacheStore(async () => { throw new Error("Redis unavailable"); });
  assert.equal(await cache.getOrLoad("p1", "products", 10, async () => "database"), "database");

  let invalidations = 0;
  await assert.rejects(() => afterSuccessfulCommit(async () => { throw new Error("database transaction failed"); }, async () => { invalidations += 1; }, "products"));
  assert.equal(invalidations, 0);
});
