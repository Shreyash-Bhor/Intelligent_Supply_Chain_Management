export type AppRole = "warehouse_manager" | "user";

export type AuthSession = {
  role: AppRole;
  email: string;
  name?: string;
  token?: string;
};

type AuthApiResponse = {
  status: string;
  message?: string;
  data?: { token: string; user: { name: string; email: string; role: "user" } };
};

const AUTH_SESSION_KEY = "app_auth_session";
const AUTH_EVENT = "app-auth-changed";
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:5000";

function emitAuthChanged() {
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export function getAuthSession(): AuthSession | null {
  const stored = window.localStorage.getItem(AUTH_SESSION_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as AuthSession;
  } catch {
    window.localStorage.removeItem(AUTH_SESSION_KEY);
    return null;
  }
}

export function setAuthSession(session: AuthSession) {
  window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  emitAuthChanged();
}

export function clearAuthSession() {
  window.localStorage.removeItem(AUTH_SESSION_KEY);
  emitAuthChanged();
}

async function authenticate(path: string, body: object) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as AuthApiResponse;
  if (!response.ok || payload.status !== "success" || !payload.data) {
    throw new Error(payload.message ?? "Authentication failed");
  }
  const session: AuthSession = {
    ...payload.data.user,
    token: payload.data.token,
  };
  setAuthSession(session);
  return session;
}

export function registerUser(user: {
  name: string;
  email: string;
  password: string;
}) {
  return authenticate("/api/auth/register", user);
}

export function loginUser(email: string, password: string) {
  return authenticate("/api/auth/login", { email, password });
}

export const authStorageKeys = { AUTH_EVENT };
