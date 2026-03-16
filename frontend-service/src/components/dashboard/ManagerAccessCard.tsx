"use client";

import { type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
  return (
    <main className="bg-muted/20 flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" /> Warehouse Manager Access
          </CardTitle>
          <CardDescription>
            This SaaS dashboard is restricted to the configured warehouse
            manager account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="manager-email" className="text-sm font-medium">
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
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Verifying..." : "Open Dashboard"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
