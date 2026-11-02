"use client";

import { useEffect } from "react";

const services = ["inventory", "pricing", "rag"] as const;
type ServiceName = (typeof services)[number];

// Keep one startup loop across React Strict Mode's development remounts.
let wakeupStarted = false;

export function ServiceWakeup() {
  useEffect(() => {
    if (wakeupStarted) return;
    wakeupStarted = true;

    void (async () => {
      const pending = new Set<ServiceName>(services);
      let delayMs = 1_000;

      while (pending.size > 0) {
        try {
          const response = await fetch("/api/wakeup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ services: [...pending] }),
            cache: "no-store",
          });
          if (response.ok) {
            const body = (await response.json()) as {
              results?: Partial<Record<ServiceName, boolean>>;
            };
            for (const service of pending) {
              if (body.results?.[service]) pending.delete(service);
            }
          }
        } catch {
          // A later startup retry can still wake a service that is unavailable now.
        }

        if (pending.size > 0) {
          await new Promise((resolve) => window.setTimeout(resolve, delayMs));
          delayMs = Math.min(delayMs * 2, 30_000);
        }
      }
    })();
  }, []);

  return null;
}
