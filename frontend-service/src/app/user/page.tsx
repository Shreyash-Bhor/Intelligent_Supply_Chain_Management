"use client";

import { type FormEvent, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { loginUser, registerUser, type UserAccount } from "@/lib/api";

type AuthMode = "signup" | "login";

function getAccountMessage(user: UserAccount, mode: AuthMode) {
  if (!user.isActive) {
    return "Your account is currently inactive. Please contact support for help.";
  }

  if (!user.isEmailVerified) {
    return mode === "signup"
      ? "Registration complete. Please verify your email before logging in."
      : "Please verify your email to continue.";
  }

  return mode === "signup"
    ? "Registration complete. You can now log in."
    : "Login successful. Your account is ready to use.";
}

export default function UserAccountPage() {
  const [mode, setMode] = useState<AuthMode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accountState, setAccountState] = useState<UserAccount | null>(null);

  const canSubmit = useMemo(
    () => email.trim().length > 0 && password.trim().length >= 8,
    [email, password],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    try {
      setLoading(true);

      if (mode === "signup") {
        const response = await registerUser({
          email: email.trim(),
          password: password.trim(),
        });

        setAccountState(response.newUser);
        setMessage(getAccountMessage(response.newUser, "signup"));
        return;
      }

      const response = await loginUser({
        email: email.trim(),
        password: password.trim(),
      });

      setAccountState(response.user);
      setMessage(getAccountMessage(response.user, "login"));
    } catch (err) {
      setAccountState(null);
      setError(
        err instanceof Error ? err.message : "Unable to process request",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="bg-muted/20 flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>User Account</CardTitle>
          <CardDescription>
            Create your account or sign in. For your safety, sensitive account
            details are never displayed on this page.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={mode === "signup" ? "default" : "outline"}
              onClick={() => {
                setMode("signup");
                setMessage(null);
                setError(null);
              }}
              disabled={loading}
            >
              Create account
            </Button>
            <Button
              type="button"
              variant={mode === "login" ? "default" : "outline"}
              onClick={() => {
                setMode("login");
                setMessage(null);
                setError(null);
              }}
              disabled={loading}
            >
              Sign in
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="user-email" className="text-sm font-medium">
                Email
              </label>
              <input
                id="user-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="user-password" className="text-sm font-medium">
                Password
              </label>
              <input
                id="user-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                minLength={8}
                required
              />
              <p className="text-muted-foreground text-xs">
                Use at least 8 characters.
              </p>
            </div>

            {error ? <p className="text-destructive text-sm">{error}</p> : null}
            {message ? (
              <p className="text-sm text-emerald-600">{message}</p>
            ) : null}

            <Button
              type="submit"
              className="w-full"
              disabled={loading || !canSubmit}
            >
              {loading
                ? "Please wait..."
                : mode === "signup"
                  ? "Create account"
                  : "Sign in"}
            </Button>
          </form>

          {accountState ? (
            <div className="bg-muted rounded-md border p-3 text-sm">
              <p>
                Account status:{" "}
                <strong>{accountState.isActive ? "Active" : "Inactive"}</strong>
              </p>
              <p>
                Email verification:{" "}
                <strong>
                  {accountState.isEmailVerified ? "Verified" : "Pending"}
                </strong>
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
