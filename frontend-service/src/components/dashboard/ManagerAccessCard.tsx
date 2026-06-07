"use client";

import { type FormEvent, useState } from "react";
import { ShieldCheck, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { loginUser, registerUser, setAuthSession } from "@/lib/auth";

type Props = {
  email: string;
  accessKey: string;
  loading: boolean;
  error: string | null;
  onEmailChange: (value: string) => void;
  onAccessKeyChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function ManagerAccessCard({
  email,
  accessKey,
  loading,
  error,
  onEmailChange,
  onAccessKeyChange,
  onSubmit,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [role, setRole] = useState<"warehouse_manager" | "user">("user");
  const [name, setName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const handleUserLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (role === "warehouse_manager") {
      setMessage("Enter hardcoded warehouse manager credentials below.");
      return;
    }

    try {
      await loginUser(userEmail, userPassword);
      setMessage(null);
      router.push("/user");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to login user");
    }
  };

  const handleSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (role === "warehouse_manager") {
      setAuthSession({
        role: "warehouse_manager",
        email: userEmail.trim() || "manager@company.com",
      });
      setMode("login");
      setMessage(
        "Admin signup selected. Continue with warehouse manager credentials.",
      );
      return;
    }

    try {
      registerUser({
        name: name.trim(),
        email: userEmail,
        password: userPassword,
      });
      await loginUser(userEmail, userPassword);
      setMessage(null);
      router.push("/user");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to signup user");
    }
  };

  return (
    <main className="bg-muted/20 flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" /> Access Portal
          </CardTitle>
          <CardDescription>
            Role-based access for warehouse manager and user dashboard.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="bg-muted inline-flex rounded-md p-1">
            <Button
              type="button"
              variant={mode === "login" ? "default" : "ghost"}
              size="sm"
              onClick={() => {
                setMode("login");
                setMessage(null);
              }}
            >
              Login
            </Button>
            <Button
              type="button"
              variant={mode === "signup" ? "default" : "ghost"}
              size="sm"
              onClick={() => {
                setMode("signup");
                setMessage(null);
              }}
            >
              Signup
            </Button>
          </div>

          <div className="space-y-2">
            <label htmlFor="role" className="text-sm font-medium">
              Select role
            </label>
            <select
              id="role"
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              value={role}
              onChange={(event) =>
                setRole(event.target.value as "warehouse_manager" | "user")
              }
            >
              <option value="user">User</option>
              <option value="warehouse_manager">
                Warehouse Manager (Admin)
              </option>
            </select>
          </div>

          {mode === "login" ? (
            <form onSubmit={handleUserLogin} className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="user-email" className="text-sm font-medium">
                  Email
                </label>
                <input
                  id="user-email"
                  type="email"
                  value={userEmail}
                  onChange={(event) => setUserEmail(event.target.value)}
                  className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
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
                  value={userPassword}
                  onChange={(event) => setUserPassword(event.target.value)}
                  className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                  required
                />
              </div>

              <Button type="submit" className="w-full">
                <UserRound className="mr-2 h-4 w-4" />
                {role === "user"
                  ? "Login to User Dashboard"
                  : "Continue as Warehouse Manager"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              {role === "user" ? (
                <div className="space-y-1">
                  <label htmlFor="user-name" className="text-sm font-medium">
                    Name
                  </label>
                  <input
                    id="user-name"
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                    required
                  />
                </div>
              ) : null}

              <div className="space-y-1">
                <label htmlFor="signup-email" className="text-sm font-medium">
                  Email
                </label>
                <input
                  id="signup-email"
                  type="email"
                  value={userEmail}
                  onChange={(event) => setUserEmail(event.target.value)}
                  className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                  required
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="signup-password"
                  className="text-sm font-medium"
                >
                  Password
                </label>
                <input
                  id="signup-password"
                  type="password"
                  value={userPassword}
                  onChange={(event) => setUserPassword(event.target.value)}
                  className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                  required
                />
              </div>

              <Button type="submit" className="w-full">
                {role === "user" ? "Create User Account" : "Continue as Admin"}
              </Button>
            </form>
          )}

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">
                Warehouse Manager Login
              </CardTitle>
              <CardDescription>
                Required for admin access to warehouse manager modules.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label
                    htmlFor="manager-email"
                    className="text-sm font-medium"
                  >
                    Manager Email
                  </label>
                  <input
                    id="manager-email"
                    type="email"
                    value={email}
                    onChange={(event) => onEmailChange(event.target.value)}
                    className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="manager-access-key"
                    className="text-sm font-medium"
                  >
                    Access Key
                  </label>
                  <input
                    id="manager-access-key"
                    type="password"
                    value={accessKey}
                    onChange={(event) => onAccessKeyChange(event.target.value)}
                    className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                    required
                  />
                </div>
                {error ? (
                  <p className="text-destructive text-sm">{error}</p>
                ) : null}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Verifying..." : "Open Manager Dashboard"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {message ? (
            <p className="text-muted-foreground text-sm">{message}</p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
