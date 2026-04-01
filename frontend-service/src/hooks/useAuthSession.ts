"use client";

import { useEffect, useState } from "react";
import { authStorageKeys, getAuthSession, type AuthSession } from "@/lib/auth";

export function useAuthSession() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const sync = () => {
      setSession(getAuthSession());
      setHydrated(true);
    };

    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(authStorageKeys.AUTH_EVENT, sync);

    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(authStorageKeys.AUTH_EVENT, sync);
    };
  }, []);

  return { session, hydrated };
}
