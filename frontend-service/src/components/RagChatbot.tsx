"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUp, Check, ChevronRight, LoaderCircle, PackageSearch,
  RotateCcw, Sparkles, X, ShoppingCart, Store, ClipboardList,
} from "lucide-react";
import { useAuthSession } from "@/hooks/useAuthSession";
import { fetchUserDashboardProducts, type UserInventoryProduct } from "@/lib/api";
import { AssistantAnswer } from "@/components/chat/AssistantAnswer";
import { ChatActionView } from "@/components/chat/ChatActionView";
import { parseChatPayload, restoreMessages, type ChatAction } from "@/components/chat/protocol";

type Message = { id: string; role: "assistant" | "user"; text: string; actions?: ChatAction[]; retryQuery?: string };
const STARTER_QUESTIONS = ["Find something for my home", "What’s in stock?", "How does ordering work?"];

export function RagChatbot({ fullPage = false }: { fullPage?: boolean }) {
  const { session, hydrated } = useAuthSession();
  const [open, setOpen] = useState(fullPage);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const conversationId = useRef(crypto.randomUUID());
  const [products, setProducts] = useState<UserInventoryProduct[]>([]);
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "assistant", text: "Hi there! I’m SupplySync’s shopping assistant. Tell me what you’re looking for, or ask me about products, stock, and ordering." },
  ]);
  const listRef = useRef<HTMLDivElement>(null);
  const catalogToken = session?.role === "user" ? session.token : undefined;
  const restored = useRef(false);

  useEffect(() => {
    if (!hydrated) return;
    const key = session?.role === "user" ? `supplysync-chat:${session.email}` : null;
    if (key) {
      try {
        const saved = window.localStorage.getItem(key);
        if (saved) {
          const parsed = JSON.parse(saved) as { conversationId?: string; messages?: unknown };
          const validMessages = restoreMessages(parsed.messages);
          if (parsed.conversationId && validMessages.length) {
            conversationId.current = parsed.conversationId;
            setMessages(validMessages);
          }
        }
      } catch { window.localStorage.removeItem(key); }
    }
    restored.current = true;
  }, [hydrated, session?.email, session?.role]);

  useEffect(() => {
    if (!restored.current || session?.role !== "user") return;
    try { window.localStorage.setItem(`supplysync-chat:${session.email}`, JSON.stringify({ conversationId: conversationId.current, messages: messages.slice(-60) })); } catch { /* Conversation remains usable when browser storage is unavailable. */ }
  }, [messages, session?.email, session?.role]);

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

  async function sendMessage(value = draft): Promise<boolean> {
    const query = value.trim();
    if (!query || busy) return false;
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
      const raw = payload.data?.answer;
      const structured = parseChatPayload(typeof raw === "string" ? { answer: raw, actions: payload.data?.actions } : raw);
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text: structured.answer, actions: structured.actions }]);
      return true;
    } catch (error) {
      const text = error instanceof Error ? error.message : "The assistant is unavailable. Please try again.";
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text, retryQuery: query }]);
      return false;
    } finally { setBusy(false); }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage();
  }

  async function submitStructuredForm(action: Extract<ChatAction, { type: "structured_form" }>, values: Record<string, string | number | boolean>) {
    if (action.action === "show_product_filters") {
      const filters = Object.fromEntries(Object.entries(values).filter(([key, value]) => {
        if (value === "" || value === false) return false;
        if (typeof value === "string" && (value.length > 120 || /[^\s@]+@[^\s@]+\.[^\s@]+|(?:\+?\d[\d ().-]{7,}\d)/.test(value))) return false;
        return ["query", "category", "min_price", "max_price", "in_stock", "sort"].includes(key);
      }));
      if (!await sendMessage(`Apply these product filters: ${JSON.stringify(filters)}`)) throw new Error("The assistant could not apply those filters. Retry the submission.");
      return;
    }
    if (!await sendMessage("I submitted the requested form.")) throw new Error("The assistant could not process this form. Retry the submission.");
  }

  return (
    <>
      {!fullPage && !open && <button type="button" onClick={() => setOpen(true)} aria-label="Open shopping assistant" className="fixed bottom-5 right-5 z-[60] flex items-center gap-3 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-xl shadow-primary/25 transition hover:-translate-y-0.5 hover:shadow-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30">
        <span className="relative grid size-9 place-items-center rounded-full bg-white/15"><Sparkles className="size-4" /><span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-primary bg-emerald-300" /></span>
        <span className="pr-1 text-left"><span className="block text-sm font-semibold">Ask SupplySync</span><span className="block text-[11px] text-primary-foreground/75">Your product assistant</span></span>
      </button>}

      <aside aria-label="SupplySync shopping assistant" aria-hidden={!open} className={fullPage ? "assistant-chat relative flex h-[100dvh] w-full flex-col bg-background text-foreground" : `fixed inset-y-0 right-0 z-[70] flex w-full flex-col border-l border-border/70 bg-background shadow-2xl transition-transform duration-300 sm:w-[min(760px,calc(100%-2rem))] ${open ? "translate-x-0" : "pointer-events-none translate-x-full"}`}>
        <header className={fullPage ? "sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between bg-background/95 px-4 backdrop-blur sm:px-6" : "relative overflow-hidden border-b border-border/70 bg-card px-5 pb-5 pt-5"}>
          {!fullPage && <div className="pointer-events-none absolute -right-10 -top-16 size-44 rounded-full bg-primary/10 blur-3xl" />}
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              {!fullPage && <div className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/20"><Sparkles className="size-5" /></div>}
              <div><div className="flex items-center gap-2"><h2 className={fullPage ? "text-base font-semibold tracking-tight" : "text-sm font-semibold"}>SupplySync assistant</h2>{!fullPage && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">ONLINE</span>}</div>{!fullPage && <p className="mt-0.5 text-xs text-muted-foreground">Product discovery, made easy</p>}</div>
            </div>
            <div className="flex items-center gap-1">
              {session?.role === "user" && <>
                <Link href="/user" aria-label="Browse storefront" title="Storefront" className="grid size-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"><Store className="size-4"/></Link>
                <Link href="/cart" aria-label="Open cart" title="Cart" className="grid size-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"><ShoppingCart className="size-4"/></Link>
                <Link href="/orders" aria-label="Order history" title="Orders" className="grid size-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"><ClipboardList className="size-4"/></Link>
              </>}
              <button type="button" onClick={() => { conversationId.current = crypto.randomUUID(); setMessages([{ id: crypto.randomUUID(), role: "assistant", text: "Hi there! I’m SupplySync’s shopping assistant. Tell me what you’re looking for, or ask me about products, stock, and ordering." }]); }} aria-label="Start a new conversation" className="grid size-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"><RotateCcw className="size-4" /></button>
              {!fullPage && <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant" className="grid size-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"><X className="size-4" /></button>}
            </div>
          </div>
          {!fullPage && <div className="relative mt-4 flex items-center gap-2 rounded-xl border border-border/60 bg-background/80 px-3 py-2 text-xs text-muted-foreground"><span className="grid size-6 place-items-center rounded-md bg-primary/10 text-primary"><Check className="size-3.5" /></span>Answers grounded in your supply catalog</div>}
        </header>

        <div ref={listRef} className={`scrollbar-hidden flex-1 overflow-y-auto ${fullPage ? "px-4 pb-8 pt-10 sm:px-6" : "space-y-7 px-5 py-6 sm:px-7"}`} aria-live="polite">
          <div className={fullPage ? "mx-auto flex min-h-full w-full max-w-3xl flex-col gap-8" : "space-y-7"}>
          {messages.map((message) => <article key={message.id} className={`mx-auto flex w-full max-w-3xl gap-3 ${message.role === "user" ? (fullPage ? "justify-end" : "justify-end") : "justify-start"}`}>
            {message.role === "assistant" && !fullPage && <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Sparkles className="size-4" /></span>}
            <div className={message.role === "user" ? (fullPage ? "max-w-[85%] rounded-3xl bg-muted px-5 py-3 text-[15px] leading-6 text-foreground sm:max-w-[75%]" : "max-w-[88%] rounded-3xl bg-muted px-4 py-2.5 text-sm leading-6 text-foreground") : "min-w-0 flex-1 pt-0.5"}>
              {message.role === "assistant" ? <><AssistantAnswer text={message.text} products={session?.role === "user" ? productMatches : []} onProductClick={() => setOpen(false)} spacious={fullPage} />{message.actions?.map((action, index) => <ChatActionView key={`${message.id}-${index}`} instanceId={`${message.id}-${index}`} action={action} busy={busy} onConfirm={() => void sendMessage("I confirm this order")} onFormSubmit={submitStructuredForm} />)}{message.retryQuery && <button type="button" disabled={busy} onClick={() => void sendMessage(message.retryQuery)} className="mt-3 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50"><RotateCcw className="size-3.5"/>Retry request</button>}</> : <p className="whitespace-pre-wrap">{message.text}</p>}
              {message.role === "assistant" && session?.role !== "user" && message.id !== "welcome" && <Link href="/user" onClick={() => setOpen(false)} className="mt-3 flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">Browse the user store <ChevronRight className="size-3.5" /></Link>}
            </div>
          </article>)}
          {busy && <div className="mx-auto flex w-full max-w-3xl gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Sparkles className="size-4" /></span><div className="flex items-center gap-2 pt-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin text-primary" /> Finding the right answer…</div></div>}
          {messages.length === 1 && <div className={`mx-auto grid w-full max-w-3xl grid-cols-1 gap-2 ${fullPage ? "sm:grid-cols-3" : "pl-11 sm:grid-cols-3"}`}><p className="col-span-full text-xs font-medium text-muted-foreground">Try asking</p>{STARTER_QUESTIONS.map((question) => <button key={question} onClick={() => void sendMessage(question)} className="flex items-center justify-between gap-2 rounded-2xl border border-border/70 bg-card px-4 py-3 text-left text-sm text-foreground transition hover:border-border hover:bg-muted/50">{question}<ChevronRight className="size-3.5 shrink-0 text-muted-foreground" /></button>)}</div>}
          </div>
        </div>

        <footer className={fullPage ? "sticky bottom-0 z-10 shrink-0 bg-background px-4 pb-3 pt-3 sm:px-6 sm:pb-5" : "border-t border-border/70 bg-background px-4 pb-4 pt-3"}>
          {session?.role === "user" && products.length > 0 && <Link href="/user" onClick={() => setOpen(false)} className="mb-2 flex items-center gap-2 rounded-lg px-1 py-1 text-[11px] text-muted-foreground transition hover:text-primary"><PackageSearch className="size-3.5" />{products.length} products in your store<span className="ml-auto">Browse <ChevronRight className="inline size-3" /></span></Link>}
          <form onSubmit={handleSubmit} className={fullPage ? "mx-auto flex max-w-3xl items-end gap-2 rounded-[28px] border border-border/80 bg-card px-3 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition focus-within:border-border focus-within:ring-1 focus-within:ring-border" : "flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm transition focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/10"}>
            <label className="sr-only" htmlFor="rag-chat-input">Message the assistant</label><textarea id="rag-chat-input" rows={1} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder="Message SupplySync" className={fullPage ? "max-h-48 min-h-11 flex-1 resize-none bg-transparent px-3 py-3 text-[15px] leading-6 outline-none placeholder:text-muted-foreground" : "max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground"} />
            <button type="submit" disabled={!draft.trim() || busy} aria-label="Send message" className={fullPage ? "mb-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-foreground text-background transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30" : "grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"}><ArrowUp className="size-4" /></button>
          </form>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">AI can make mistakes. Check product details before ordering.</p>
        </footer>
      </aside>
      {!fullPage && open && <button aria-label="Close assistant panel" onClick={() => setOpen(false)} className="fixed inset-0 z-[65] bg-black/20 backdrop-blur-[1px] sm:bg-transparent sm:backdrop-blur-none" />}
      {!fullPage && open && <button onClick={() => setOpen(false)} className="fixed bottom-5 right-5 z-[60] grid size-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-xl sm:hidden" aria-label="Close assistant"><X className="size-5" /></button>}
    </>
  );
}
