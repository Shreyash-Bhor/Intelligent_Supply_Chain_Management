"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/hooks/useAuthSession";
import { Navbar } from "@/components/Navbar";
import { RagChatbot } from "@/components/RagChatbot";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, hydrated } = useAuthSession();
  const role = session?.role;
  const email = session?.email;
  const assistantPage = pathname === "/assistant";
  const canUseAssistant = session?.role === "user";

  useEffect(() => {
    if (!hydrated || !role) return;

    const routes = role === "warehouse_manager"
      ? ["/manager", "/inventory", "/reorder", "/warehouse", "/product", "/pricing"]
      : ["/assistant", "/user", "/cart", "/orders"];
    const [priority, ...deferred] = routes;
    let cancelled = false;
    let idleHandle: number | undefined;
    let timeoutHandle: number | undefined;

    // Warm the role's landing page first, then schedule only that role's routes.
    const safePrefetch = (route: string) => {
      try { router.prefetch(route); } catch { /* A later navigation can still load the route normally. */ }
    };
    safePrefetch(priority);
    const preloadDeferred = () => {
      if (cancelled) return;
      for (const route of deferred) safePrefetch(route);
    };
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (idleWindow.requestIdleCallback) {
      idleHandle = idleWindow.requestIdleCallback(preloadDeferred, { timeout: 2500 });
    } else {
      timeoutHandle = window.setTimeout(preloadDeferred, 1200);
    }

    return () => {
      cancelled = true;
      if (idleHandle !== undefined) idleWindow.cancelIdleCallback?.(idleHandle);
      if (timeoutHandle !== undefined) window.clearTimeout(timeoutHandle);
    };
  }, [email, hydrated, role, router]);

  return <>
    {!assistantPage && <Navbar />}
    {children}
    {!assistantPage && canUseAssistant && <RagChatbot />}
  </>;
}
