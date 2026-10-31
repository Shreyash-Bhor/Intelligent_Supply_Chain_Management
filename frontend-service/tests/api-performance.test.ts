import assert from "node:assert/strict";
import test from "node:test";
import { fetchApi } from "../src/lib/api.ts";

test("GET requests retry one transient server failure and then return the payload", async (context) => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify(calls === 1 ? { status: "error" } : { status: "success", data: [1] }), { status: calls === 1 ? 503 : 200 });
  };
  context.after(() => { globalThis.fetch = originalFetch; });

  assert.deepEqual(await fetchApi<number[]>("/perf"), [1]);
  assert.equal(calls, 2);
});

test("requests abort on timeout and mutations are not retried", async (context) => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (_input, init) => new Promise((_resolve, reject) => {
    calls += 1;
    init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
  });
  context.after(() => { globalThis.fetch = originalFetch; });

  await assert.rejects(() => fetchApi("/slow", { timeoutMs: 5 }));
  assert.equal(calls, 2, "bounded GET retry should be attempted once");

  calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ status: "error", message: "temporary failure" }), { status: 503 });
  };
  await assert.rejects(() => fetchApi("/write", { method: "POST", body: { value: 1 } }));
  assert.equal(calls, 1, "mutating requests must not be retried");
});
