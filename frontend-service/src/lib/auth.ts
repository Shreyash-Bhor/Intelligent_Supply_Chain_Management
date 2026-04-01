export type AppRole = "warehouse_manager" | "user";

export type AuthSession = {
  role: AppRole;
  email: string;
  name?: string;
};

type RegisteredUser = {
  name: string;
  email: string;
  password: string;
};

const AUTH_SESSION_KEY = "app_auth_session";
const AUTH_USERS_KEY = "app_auth_users";
const AUTH_EVENT = "app-auth-changed";

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

export function getRegisteredUsers(): RegisteredUser[] {
  const stored = window.localStorage.getItem(AUTH_USERS_KEY);
  if (!stored) return [];

  try {
    return JSON.parse(stored) as RegisteredUser[];
  } catch {
    window.localStorage.removeItem(AUTH_USERS_KEY);
    return [];
  }
}

export function registerUser(user: RegisteredUser) {
  const normalizedEmail = user.email.trim().toLowerCase();
  const users = getRegisteredUsers();
  const exists = users.some(
    (item) => item.email.toLowerCase() === normalizedEmail,
  );

  if (exists) {
    throw new Error("User already exists. Please login instead.");
  }

  const updatedUsers = [
    ...users,
    {
      name: user.name.trim(),
      email: normalizedEmail,
      password: user.password,
    },
  ];

  window.localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(updatedUsers));
}

export function loginUser(email: string, password: string): AuthSession {
  const normalizedEmail = email.trim().toLowerCase();
  const user = getRegisteredUsers().find(
    (item) => item.email.toLowerCase() === normalizedEmail,
  );

  if (!user || user.password !== password) {
    throw new Error("Invalid email or password.");
  }

  const session: AuthSession = {
    role: "user",
    email: user.email,
    name: user.name,
  };

  setAuthSession(session);
  return session;
}

export const authStorageKeys = {
  AUTH_EVENT,
};
