"use client";

import { useEffect, useState } from "react";
import { verifyManagerAccess, type ManagerSession } from "@/lib/api";

const SESSION_KEY = "warehouse_manager_session";

export function useManagerSession() {
  const [managerSession, setManagerSession] = useState<ManagerSession | null>(
    null,
  );
  const [email, setEmail] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(SESSION_KEY);
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored) as ManagerSession;
      if (parsed.email && parsed.accessKey) {
        setManagerSession(parsed);
      }
    } catch {
      window.localStorage.removeItem(SESSION_KEY);
    }
  }, []);

  const login = async () => {
    const session = {
      email: email.trim(),
      accessKey: accessKey.trim(),
    };

    try {
      setAuthLoading(true);
      await verifyManagerAccess(session);
      setManagerSession(session);
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      setAuthError(null);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : "Invalid manager credentials",
      );
      setManagerSession(null);
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = () => {
    window.localStorage.removeItem(SESSION_KEY);
    setManagerSession(null);
    setAuthError(null);
  };

  return {
    managerSession,
    email,
    setEmail,
    accessKey,
    setAccessKey,
    authLoading,
    authError,
    setAuthError,
    login,
    logout,
  };
}
