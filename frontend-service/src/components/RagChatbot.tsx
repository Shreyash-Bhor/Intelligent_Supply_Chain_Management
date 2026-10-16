"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUp, Check, ChevronRight, LoaderCircle, PackageSearch,
  RotateCcw, Sparkles, X,
} from "lucide-react";
import { useAuthSession } from "@/hooks/useAuthSession";
import { fetchUserDashboardProducts, type UserInventoryProduct } from "@/lib/api";
import { AssistantAnswer } from "@/components/chat/AssistantAnswer";

type Message = { id: string; role: "assistant" | "user"; text: string };
const STARTER_QUESTIONS = ["Find something for my home", "What’s in stock?", "How does ordering work?"];

export function RagChatbot() {
  const { session } = useAuthSession();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const conversationId = useRef(crypto.randomUUID());
  const [products, setProducts] = useState<UserInventoryProduct[]>([]);
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "assistant", text: "Hi there! I’m SupplySync’s shopping assistant. Tell me what you’re looking for, or ask me about products, stock, and ordering." },
  ]);
  const listRef = useRef<HTMLDivElement>(null);
  const catalogToken = session?.role === "user" ? session.token : undefined;

  useEffect(() => {
    if (!catalogToken) { setProducts([]); return; }
    let active = true;
    fetchUserDashboardProducts(catalogToken).then((data) => { if (active) setProducts(data); }).catch(() => { if (active) setProducts([]); });
    return () => { active = false; };
  }, [catalogToken]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, open]);

  const productMatches = useMemo(() => [...products].sort((a, b) => b.name.length - a.name.length), [products]);

  async function sendMessage(value = draft) {
    const query = value.trim();
    if (!query || busy) return;
    setDraft("");
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text: query }]);
    setBusy(true);
    try {
      const response = await fetch("/api/rag/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
        },
        body: JSON.stringify({ query, conversationId: conversationId.current }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? payload.detail ?? "I couldn’t get an answer just now.");
      const answer = payload.data?.answer;
      if (typeof answer !== "string" || !answer.trim()) throw new Error("I didn’t receive an answer. Please try again.");
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text: answer }]);
    } catch (error) {
      const text = error instanceof Error ? error.message : "The assistant is unavailable. Please try again.";
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text }]);
    } finally { setBusy(false); }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage();
  }

  return (
    <>
      {!open && <button type="button" onClick={() => setOpen(true)} aria-label="Open shopping assistant" className="fixed bottom-5 right-5 z-[60] flex items-center gap-3 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-xl shadow-primary/25 transition hover:-translate-y-0.5 hover:shadow-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30">
        <span className="relative grid size-9 place-items-center rounded-full bg-white/15"><Sparkles className="size-4" /><span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-primary bg-emerald-300" /></span>
        <span className="pr-1 text-left"><span className="block text-sm font-semibold">Ask SupplySync</span><span className="block text-[11px] text-primary-foreground/75">Your product assistant</span></span>
      </button>}

      <aside aria-label="SupplySync shopping assistant" aria-hidden={!open} className={`fixed inset-y-0 right-0 z-[70] flex w-full flex-col border-l border-border/70 bg-background shadow-2xl transition-transform duration-300 sm:w-[min(760px,calc(100%-2rem))] ${open ? "translate-x-0" : "pointer-events-none translate-x-full"}`}>
        <header className="relative overflow-hidden border-b border-border/70 bg-card px-5 pb-5 pt-5">
          <div className="pointer-events-none absolute -right-10 -top-16 size-44 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/20"><Sparkles className="size-5" /></div>
              <div><div className="flex items-center gap-2"><h2 className="text-sm font-semibold">SupplySync assistant</h2><span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">ONLINE</span></div><p className="mt-0.5 text-xs text-muted-foreground">Product discovery, made easy</p></div>
            </div>
            <div className="flex items-center gap-1"><button type="button" onClick={() => { conversationId.current = crypto.randomUUID(); setMessages([{ id: crypto.randomUUID(), role: "assistant", text: "Hi there! I’m SupplySync’s shopping assistant. Tell me what you’re looking for, or ask me about products, stock, and ordering." }]); }} aria-label="Start a new conversation" className="grid size-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"><RotateCcw className="size-4" /></button><button type="button" onClick={() => setOpen(false)} aria-label="Close assistant" className="grid size-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"><X className="size-4" /></button></div>
          </div>
          <div className="relative mt-4 flex items-center gap-2 rounded-xl border border-border/60 bg-background/80 px-3 py-2 text-xs text-muted-foreground"><span className="grid size-6 place-items-center rounded-md bg-primary/10 text-primary"><Check className="size-3.5" /></span>Answers grounded in your supply catalog</div>
        </header>

        <div ref={listRef} className="scrollbar-hidden flex-1 space-y-7 overflow-y-auto px-5 py-6 sm:px-7" aria-live="polite">
          {messages.map((message) => <article key={message.id} className={`mx-auto flex w-full max-w-3xl gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            {message.role === "assistant" && <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Sparkles className="size-4" /></span>}
            <div className={message.role === "user" ? "max-w-[88%] rounded-3xl bg-muted px-4 py-2.5 text-sm leading-6 text-foreground" : "min-w-0 flex-1 pt-0.5"}>
              {message.role === "assistant" ? <AssistantAnswer text={message.text} products={session?.role === "user" ? productMatches : []} onProductClick={() => setOpen(false)} /> : <p className="whitespace-pre-wrap">{message.text}</p>}
              {message.role === "assistant" && session?.role !== "user" && message.id !== "welcome" && <Link href="/user" onClick={() => setOpen(false)} className="mt-3 flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">Browse the user store <ChevronRight className="size-3.5" /></Link>}
            </div>
          </article>)}
          {busy && <div className="mx-auto flex w-full max-w-3xl gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Sparkles className="size-4" /></span><div className="flex items-center gap-2 pt-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin text-primary" /> Finding the right answer…</div></div>}
          {messages.length === 1 && <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-2 pl-11 sm:grid-cols-3"><p className="col-span-full text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Try asking</p>{STARTER_QUESTIONS.map((question) => <button key={question} onClick={() => void sendMessage(question)} className="flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-card px-3 py-2.5 text-left text-xs text-foreground transition hover:border-primary/40 hover:bg-primary/5">{question}<ChevronRight className="size-3.5 shrink-0 text-muted-foreground" /></button>)}</div>}
        </div>

        <footer className="border-t border-border/70 bg-background px-4 pb-4 pt-3">
          {session?.role === "user" && products.length > 0 && <Link href="/user" onClick={() => setOpen(false)} className="mb-2 flex items-center gap-2 rounded-lg px-1 py-1 text-[11px] text-muted-foreground transition hover:text-primary"><PackageSearch className="size-3.5" />{products.length} products in your store<span className="ml-auto">Browse <ChevronRight className="inline size-3" /></span></Link>}
          <form onSubmit={handleSubmit} className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm transition focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/10">
            <label className="sr-only" htmlFor="rag-chat-input">Message the assistant</label><textarea id="rag-chat-input" rows={1} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder="Ask about products, stock…" className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground" />
            <button type="submit" disabled={!draft.trim() || busy} aria-label="Send message" className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"><ArrowUp className="size-4" /></button>
          </form>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">AI can make mistakes. Check product details before ordering.</p>
        </footer>
      </aside>
      {open && <button aria-label="Close assistant panel" onClick={() => setOpen(false)} className="fixed inset-0 z-[65] bg-black/20 backdrop-blur-[1px] sm:bg-transparent sm:backdrop-blur-none" />}
      {open && <button onClick={() => setOpen(false)} className="fixed bottom-5 right-5 z-[60] grid size-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-xl sm:hidden" aria-label="Close assistant"><X className="size-5" /></button>}
    </>
  );
}
