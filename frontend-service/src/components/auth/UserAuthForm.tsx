"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LoaderCircle, Sparkles } from "lucide-react";
import { loginUser, registerUser } from "@/lib/auth";

export function UserAuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signup = mode === "signup";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(null);
    try {
      if (signup) await registerUser({ name: name.trim(), email: email.trim(), password });
      else await loginUser(email.trim(), password);
      window.localStorage.removeItem("warehouse_manager_session");
      router.replace("/assistant");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "We couldn’t complete sign in. Please try again."); }
    finally { setLoading(false); }
  }
  return <div className="auth-card rounded-2xl border-2 border-foreground/80 bg-card p-6 shadow-xl shadow-primary/5 sm:p-8">
    <span className="grid size-11 place-items-center rounded-xl bg-secondary/20 text-secondary-foreground"><Sparkles className="size-5"/></span>
    <p className="mt-5 text-xs font-semibold uppercase tracking-[.16em] text-secondary-foreground">Shopper account</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">{signup ? "Create your account" : "Welcome back"}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{signup ? "Set up your account and let your AI assistant help with the rest." : "Sign in to continue your conversation and explore what’s in stock."}</p>
    <form onSubmit={submit} className="mt-7 space-y-4">{signup && <div className="space-y-1.5"><label htmlFor="shopper-name" className="text-sm font-medium">Name</label><input id="shopper-name" autoComplete="name" value={name} onChange={e=>setName(e.target.value)} required className="auth-input" placeholder="Your name"/></div>}
      <div className="space-y-1.5"><label htmlFor="shopper-email" className="text-sm font-medium">Email address</label><input id="shopper-email" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required className="auth-input" placeholder="you@example.com"/></div>
      <div className="space-y-1.5"><label htmlFor="shopper-password" className="text-sm font-medium">Password</label><div className="relative"><input id="shopper-password" type={showPassword?"text":"password"} autoComplete={signup?"new-password":"current-password"} value={password} onChange={e=>setPassword(e.target.value)} minLength={signup?8:undefined} required className="auth-input pr-12" placeholder={signup?"At least 8 characters":"Enter your password"}/><button type="button" onClick={()=>setShowPassword(s=>!s)} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground hover:text-foreground" aria-label={showPassword?"Hide password":"Show password"}>{showPassword?<EyeOff className="size-4"/>:<Eye className="size-4"/>}</button></div></div>
      {error&&<p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      <button disabled={loading} type="submit" className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:pointer-events-none disabled:opacity-60">{loading?<><LoaderCircle className="size-4 animate-spin"/>Please wait…</>:<>{signup?"Create account":"Sign in"}<ArrowRight className="size-4"/></>}</button>
    </form>
    <p className="mt-6 text-center text-sm text-muted-foreground">{signup?"Already have an account?":"New to SupplySync?"} <Link className="font-semibold text-primary hover:underline" href={signup?"/login/user":"/signup/user"}>{signup?"Sign in":"Create an account"}</Link></p>
    <div className="my-6 border-t border-border"/><p className="text-center text-xs text-muted-foreground">Managing a warehouse? <Link href="/login/manager" className="font-semibold text-foreground underline decoration-secondary decoration-2 underline-offset-4">Manager sign in</Link></p>
  </div>;
}
