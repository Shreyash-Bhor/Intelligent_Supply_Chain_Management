"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUp,
  Check,
  ChevronRight,
  LoaderCircle,
  PackageSearch,
  RotateCcw,
  Sparkles,
  X,
  ShoppingCart,
  Store,
  ClipboardList,
  Maximize2,
  Minimize2,
  Grip,
} from "lucide-react";
import { useAuthSession } from "@/hooks/useAuthSession";
import {
  fetchUserDashboardProducts,
  type UserInventoryProduct,
} from "@/lib/api";
import { AssistantAnswer } from "@/components/chat/AssistantAnswer";
import { ChatActionView } from "@/components/chat/ChatActionView";
import {
  parseChatPayload,
  restoreMessages,
  type ChatAction,
} from "@/components/chat/protocol";

type Message = {
  id: string;
  role: "assistant" | "user";
  text: string;
  actions?: ChatAction[];
  suggestions?: string[];
  retryQuery?: string;
};
const STARTER_QUESTIONS = [
  "Show me products in Electronics",
  "Find a product by name or SKU",
  "How does ordering work?",
];
const THINKING_PHRASES = [
  "Checking the catalog",
  "Looking across live stock",
  "Finding a good match",
  "Putting the details together",
];
const LAUNCHER_POSITION_KEY = "supplysync-assistant-launcher-position";
type LauncherPosition = { right: number; bottom: number };

function clampLauncherPosition(
  position: LauncherPosition,
  width = 250,
  height = 64,
): LauncherPosition {
  return {
    right: Math.min(
      Math.max(position.right, 8),
      Math.max(8, window.innerWidth - width - 8),
    ),
    bottom: Math.min(
      Math.max(position.bottom, 8),
      Math.max(8, window.innerHeight - height - 8),
    ),
  };
}

export function RagChatbot({ fullPage = false }: { fullPage?: boolean }) {
  const { session, hydrated } = useAuthSession();
  const [open, setOpen] = useState(fullPage);
  const [expanded, setExpanded] = useState(false);
  const [launcherPosition, setLauncherPosition] = useState<LauncherPosition>({
    right: 20,
    bottom: 20,
  });
  const [launcherPositionReady, setLauncherPositionReady] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [thinkingPhrase, setThinkingPhrase] = useState(0);
  const conversationId = useRef(crypto.randomUUID());
  const [products, setProducts] = useState<UserInventoryProduct[]>([]);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Hi there! I’m SupplySync’s shopping assistant. Tell me what you’re looking for, or ask me about products, stock, and ordering.",
    },
  ]);
  const listRef = useRef<HTMLDivElement>(null);
  const catalogToken = session?.role === "user" ? session.token : undefined;
  const restored = useRef(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const launcherDrag = useRef<{
    pointerId: number;
    x: number;
    y: number;
    right: number;
    bottom: number;
    moved: boolean;
  } | null>(null);
  const suppressLauncherClick = useRef(false);
  const isFullscreen = fullPage || expanded;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LAUNCHER_POSITION_KEY);
      if (saved) {
        const position = JSON.parse(saved) as LauncherPosition;
        if (Number.isFinite(position.right) && Number.isFinite(position.bottom))
          setLauncherPosition(clampLauncherPosition(position));
      }
    } catch {
      /* Use the default launcher position if saved settings are unavailable. */
    }
    setLauncherPositionReady(true);
    const clampOnResize = () =>
      setLauncherPosition((current) =>
        clampLauncherPosition(
          current,
          launcherRef.current?.offsetWidth,
          launcherRef.current?.offsetHeight,
        ),
      );
    window.addEventListener("resize", clampOnResize);
    return () => window.removeEventListener("resize", clampOnResize);
  }, []);

  useEffect(() => {
    if (!launcherPositionReady) return;
    try {
      window.localStorage.setItem(
        LAUNCHER_POSITION_KEY,
        JSON.stringify(launcherPosition),
      );
    } catch {
      /* The launcher remains adjustable for this session. */
    }
  }, [launcherPosition, launcherPositionReady]);

  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [expanded]);

  useEffect(() => {
    if (!busy) {
      setThinkingPhrase(0);
      return;
    }
    const timer = window.setInterval(
      () =>
        setThinkingPhrase((current) => (current + 1) % THINKING_PHRASES.length),
      3000,
    );
    return () => window.clearInterval(timer);
  }, [busy]);

  useEffect(() => {
    if (!hydrated) return;
    const key =
      session?.role === "user" ? `supplysync-chat:${session.email}` : null;
    if (key) {
      try {
        const saved = window.localStorage.getItem(key);
        if (saved) {
          const parsed = JSON.parse(saved) as {
            conversationId?: string;
            messages?: unknown;
          };
          const validMessages = restoreMessages(parsed.messages);
          if (parsed.conversationId && validMessages.length) {
            conversationId.current = parsed.conversationId;
            setMessages(validMessages);
          }
        }
      } catch {
        window.localStorage.removeItem(key);
      }
    }
    restored.current = true;
  }, [hydrated, session?.email, session?.role]);

  useEffect(() => {
    if (!restored.current || session?.role !== "user") return;
    try {
      window.localStorage.setItem(
        `supplysync-chat:${session.email}`,
        JSON.stringify({
          conversationId: conversationId.current,
          messages: messages.slice(-60),
        }),
      );
    } catch {
      /* Conversation remains usable when browser storage is unavailable. */
    }
  }, [messages, session?.email, session?.role]);

  useEffect(() => {
    if (!catalogToken) {
      setProducts([]);
      return;
    }
    let active = true;
    fetchUserDashboardProducts(catalogToken)
      .then((data) => {
        if (active) setProducts(data);
      })
      .catch(() => {
        if (active) setProducts([]);
      });
    return () => {
      active = false;
    };
  }, [catalogToken]);

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, busy, open]);

  async function sendMessage(value = draft): Promise<boolean> {
    const query = value.trim();
    if (!query || busy) return false;
    setDraft("");
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", text: query },
    ]);
    setBusy(true);
    try {
      const response = await fetch("/api/rag/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.token
            ? { Authorization: `Bearer ${session.token}` }
            : {}),
        },
        body: JSON.stringify({ query, conversationId: conversationId.current }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(
          payload.message ??
            payload.detail ??
            "I couldn’t get an answer just now.",
        );
      const raw = payload.data?.answer;
      const structured = parseChatPayload(
        typeof raw === "string"
          ? {
              answer: raw,
              actions: payload.data?.actions,
              suggestions: payload.data?.suggestions,
            }
          : raw,
      );
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: structured.answer,
          actions: structured.actions,
          suggestions: structured.suggestions,
        },
      ]);
      return true;
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : "The assistant is unavailable. Please try again.";
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "assistant", text, retryQuery: query },
      ]);
      return false;
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage();
  }

  function closeAssistant() {
    setOpen(false);
    setExpanded(false);
  }

  async function submitStructuredForm(
    action: Extract<ChatAction, { type: "structured_form" }>,
    values: Record<string, string | number | boolean>,
  ) {
    if (action.action === "show_product_filters") {
      const filters = Object.fromEntries(
        Object.entries(values).filter(([key, value]) => {
          if (value === "" || value === false) return false;
          if (
            typeof value === "string" &&
            (value.length > 120 ||
              /[^\s@]+@[^\s@]+\.[^\s@]+|(?:\+?\d[\d ().-]{7,}\d)/.test(value))
          )
            return false;
          return [
            "query",
            "category",
            "min_price",
            "max_price",
            "in_stock",
            "sort",
          ].includes(key);
        }),
      );
      if (
        !(await sendMessage(
          `Apply these product filters: ${JSON.stringify(filters)}`,
        ))
      )
        throw new Error(
          "The assistant could not apply those filters. Retry the submission.",
        );
      return;
    }
    const submittedValues = Object.fromEntries(
      Object.entries(values).filter(
        ([, value]) => value !== "" && value !== false,
      ),
    );
    const formName =
      action.action === "show_checkout_form" ? "checkout" : "requested";
    if (
      !(await sendMessage(
        `I submitted the ${formName} form with these selections: ${JSON.stringify(submittedValues)}. Apply my selections to the current task and continue.`,
      ))
    )
      throw new Error(
        "The assistant could not process this form. Retry the submission.",
      );
  }

  return (
    <>
      {!fullPage && !open && (
        <button
          ref={launcherRef}
          type="button"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            launcherDrag.current = {
              pointerId: event.pointerId,
              x: event.clientX,
              y: event.clientY,
              ...launcherPosition,
              moved: false,
            };
          }}
          onPointerMove={(event) => {
            const drag = launcherDrag.current;
            if (!drag || drag.pointerId !== event.pointerId) return;
            const dx = event.clientX - drag.x;
            const dy = event.clientY - drag.y;
            if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true;
            if (drag.moved)
              setLauncherPosition(
                clampLauncherPosition(
                  { right: drag.right - dx, bottom: drag.bottom + dy },
                  event.currentTarget.offsetWidth,
                  event.currentTarget.offsetHeight,
                ),
              );
          }}
          onPointerUp={(event) => {
            const drag = launcherDrag.current;
            if (drag?.pointerId === event.pointerId) {
              suppressLauncherClick.current = drag.moved;
              launcherDrag.current = null;
            }
          }}
          onPointerCancel={() => {
            launcherDrag.current = null;
          }}
          onClick={() => {
            if (suppressLauncherClick.current) {
              suppressLauncherClick.current = false;
              return;
            }
            setOpen(true);
          }}
          aria-label="Open shopping assistant. Drag to reposition."
          title="Drag to reposition"
          style={{
            right: launcherPosition.right,
            bottom: launcherPosition.bottom,
          }}
          className="fixed z-[60] flex touch-none select-none cursor-grab items-center gap-3 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-xl shadow-primary/25 transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-2xl active:cursor-grabbing focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
        >
          <span className="relative grid size-9 place-items-center rounded-full bg-white/15">
            <Sparkles className="size-4" />
            <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-primary bg-emerald-300" />
          </span>
          <span className="pr-1 text-left">
            <span className="block text-sm font-semibold">Ask SupplySync</span>
            <span className="block text-[11px] text-primary-foreground/75">
              Your product assistant
            </span>
          </span>
          <Grip
            className="size-4 text-primary-foreground/65"
            aria-hidden="true"
          />
        </button>
      )}

      <aside
        aria-label="SupplySync shopping assistant"
        aria-hidden={!open}
        className={
          fullPage
            ? "assistant-chat relative flex h-[100dvh] w-full flex-col bg-background text-foreground"
            : expanded
              ? "assistant-chat fixed inset-0 z-[70] flex h-[100dvh] w-full flex-col text-foreground"
              : `fixed inset-y-0 right-0 z-[70] flex w-full flex-col border-l border-border/70 bg-background shadow-2xl transition-transform duration-300 sm:w-[min(760px,calc(100%-2rem))] ${open ? "translate-x-0" : "pointer-events-none translate-x-full"}`
        }
      >
        <header
          className={
            isFullscreen
              ? "sticky top-0 z-10 flex min-h-16 shrink-0 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6"
              : "relative overflow-hidden border-b border-border/70 bg-card px-5 pb-5 pt-5"
          }
        >
          {!fullPage && (
            <div className="pointer-events-none absolute -right-10 -top-16 size-44 rounded-full bg-primary/10 blur-3xl" />
          )}
          <div className="relative grid w-full grid-cols-[1fr_auto] items-center gap-x-1 gap-y-2 sm:grid-cols-[1fr_auto_1fr]">
            <div className="flex items-center gap-3">
              {!fullPage && (
                <div className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
                  <Sparkles className="size-5" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h2
                    className={
                      fullPage
                        ? "text-sm font-semibold tracking-tight sm:text-base"
                        : "text-sm font-semibold"
                    }
                  >
                    SupplySync assistant
                  </h2>
                  {!fullPage && (
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                      ONLINE
                    </span>
                  )}
                </div>
                {!fullPage && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Product discovery, made easy
                  </p>
                )}
              </div>
            </div>
            <nav
              aria-label="Assistant page navigation"
              className="col-span-2 row-start-2 flex items-center justify-center gap-0.5 rounded-xl border border-border bg-card p-1 sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:gap-1"
            >
              {session?.role === "user" && (
                <>
                  <Link
                    href="/user"
                    aria-label="Browse storefront"
                    className="inline-flex h-8 items-center gap-1 rounded-lg px-1.5 text-[11px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground sm:gap-1.5 sm:px-2.5 sm:text-sm"
                  >
                    <Store className="size-3.5 sm:size-4" />
                    <span>Shop</span>
                  </Link>
                  <Link
                    href="/cart"
                    aria-label="Open cart"
                    className="inline-flex h-8 items-center gap-1 rounded-lg px-1.5 text-[11px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground sm:gap-1.5 sm:px-2.5 sm:text-sm"
                  >
                    <ShoppingCart className="size-3.5 sm:size-4" />
                    <span>Cart</span>
                  </Link>
                  <Link
                    href="/orders"
                    aria-label="Order history"
                    className="inline-flex h-8 items-center gap-1 rounded-lg px-1.5 text-[11px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground sm:gap-1.5 sm:px-2.5 sm:text-sm"
                  >
                    <ClipboardList className="size-3.5 sm:size-4" />
                    <span>Orders</span>
                  </Link>
                </>
              )}
            </nav>
            <div className="col-start-2 row-start-1 flex items-center justify-end gap-1 sm:col-start-3">
              <button
                type="button"
                onClick={() => {
                  conversationId.current = crypto.randomUUID();
                  setMessages([
                    {
                      id: crypto.randomUUID(),
                      role: "assistant",
                      text: "Hi there! I’m SupplySync’s shopping assistant. Tell me what you’re looking for, or ask me about products, stock, and ordering.",
                    },
                  ]);
                }}
                aria-label="Start a new conversation"
                className="grid size-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <RotateCcw className="size-4" />
              </button>
              {!fullPage && (
                <button
                  type="button"
                  onClick={() => setExpanded((current) => !current)}
                  aria-label={
                    expanded ? "Exit fullscreen" : "Switch to fullscreen"
                  }
                  title={expanded ? "Exit fullscreen" : "Switch to fullscreen"}
                  className="grid size-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  {expanded ? (
                    <Minimize2 className="size-4" />
                  ) : (
                    <Maximize2 className="size-4" />
                  )}
                </button>
              )}
              {!fullPage && (
                <button
                  type="button"
                  onClick={closeAssistant}
                  aria-label="Close assistant"
                  className="grid size-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          </div>
          {!fullPage && (
            <div className="relative mt-4 flex items-center gap-2 rounded-xl border border-border/60 bg-background/80 px-3 py-2 text-xs text-muted-foreground">
              <span className="grid size-6 place-items-center rounded-md bg-primary/10 text-primary">
                <Check className="size-3.5" />
              </span>
              Answers grounded in your supply catalog
            </div>
          )}
        </header>

        <div
          ref={listRef}
          className={`scrollbar-hidden flex-1 overflow-y-auto ${fullPage ? "px-4 pb-8 pt-10 sm:px-6" : "space-y-7 px-5 py-6 sm:px-7"}`}
          aria-live="polite"
        >
          <div
            className={
              fullPage
                ? "mx-auto flex min-h-full w-full max-w-3xl flex-col gap-8"
                : "space-y-7"
            }
          >
            {messages.map((message) => (
              <article
                key={message.id}
                className={`mx-auto flex w-full max-w-3xl gap-3 ${message.role === "user" ? (fullPage ? "justify-end" : "justify-end") : "justify-start"}`}
              >
                {message.role === "assistant" && (
                  <span
                    className={`mt-1 grid shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/15 ${fullPage ? "size-10" : "size-8 rounded-full"}`}
                  >
                    <Sparkles className={fullPage ? "size-5" : "size-4"} />
                  </span>
                )}
                <div
                  className={
                    message.role === "user"
                      ? fullPage
                        ? "max-w-[85%] rounded-3xl bg-muted px-5 py-3 text-[15px] leading-6 text-foreground sm:max-w-[75%]"
                        : "max-w-[88%] rounded-3xl bg-muted px-4 py-2.5 text-sm leading-6 text-foreground"
                      : `min-w-0 flex-1 rounded-2xl border border-primary/15 bg-card px-4 py-4 shadow-[0_8px_28px_-18px_color-mix(in_oklch,var(--primary)_38%,transparent)] ${fullPage ? "sm:px-6 sm:py-5" : "pt-3"}`
                  }
                >
                  {message.role === "assistant" ? (
                    <>
                      <AssistantAnswer
                        text={message.text}
                        spacious={fullPage}
                      />
                      {message.actions?.map((action, index) => (
                        <ChatActionView
                          key={`${message.id}-${index}`}
                          instanceId={`${message.id}-${index}`}
                          action={action}
                          busy={busy}
                          onConfirm={() =>
                            void sendMessage("I confirm this order")
                          }
                          onFormSubmit={submitStructuredForm}
                          onAddressSaved={() => {
                            const ordering = messages.some(
                              (item) =>
                                item.role === "user" &&
                                /\b(order|checkout|buy|purchase|cart)\b/i.test(
                                  item.text,
                                ),
                            );
                            void sendMessage(
                              ordering
                                ? "My delivery address has been saved. Continue checkout using this address."
                                : "My delivery address has been saved.",
                            );
                          }}
                        />
                      ))}
                      {message.suggestions?.length && !message.retryQuery ? (
                        <div
                          className="mt-3 flex flex-wrap gap-2"
                          aria-label="Suggested replies"
                        >
                          {message.suggestions.map((reply) => (
                            <button
                              key={reply}
                              type="button"
                              disabled={busy}
                              onClick={() => void sendMessage(reply)}
                              className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-left text-xs font-medium text-primary transition hover:border-primary/40 hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {reply}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      {message.retryQuery && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void sendMessage(message.retryQuery)}
                          className="mt-3 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50"
                        >
                          <RotateCcw className="size-3.5" />
                          Retry request
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="whitespace-pre-wrap">{message.text}</p>
                  )}
                  {message.role === "assistant" &&
                    session?.role !== "user" &&
                    message.id !== "welcome" && (
                      <Link
                        href="/user"
                        onClick={closeAssistant}
                        className="mt-3 flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                      >
                        Browse the user store{" "}
                        <ChevronRight className="size-3.5" />
                      </Link>
                    )}
                </div>
              </article>
            ))}
            {busy && (
              <div
                className="mx-auto flex w-full max-w-3xl gap-3"
                role="status"
                aria-live="polite"
              >
                <span className="assistant-thinking-icon mt-1 grid size-10 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
                  <Sparkles className="size-5" />
                </span>
                <div className="assistant-thinking-card flex min-h-14 flex-1 items-center gap-3 rounded-2xl border border-primary/20 bg-card px-4 py-3 text-sm font-medium text-foreground shadow-sm">
                  <LoaderCircle className="size-4 shrink-0 animate-spin text-primary" />
                  <span key={thinkingPhrase} className="assistant-phrase-in">
                    {THINKING_PHRASES[thinkingPhrase]}
                    <span
                      className="assistant-thinking-dots ml-1"
                      aria-hidden="true"
                    >
                      …
                    </span>
                  </span>
                  <span className="ml-auto hidden text-xs font-normal text-muted-foreground sm:inline">
                    Just a moment
                  </span>
                </div>
              </div>
            )}
            {messages.length === 1 && (
              <div
                className={`mx-auto grid w-full max-w-3xl grid-cols-1 gap-2 ${fullPage ? "sm:grid-cols-3" : "pl-11 sm:grid-cols-3"}`}
              >
                <p className="col-span-full text-xs font-medium text-muted-foreground">
                  Try asking
                </p>
                {STARTER_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    onClick={() => void sendMessage(question)}
                    className="flex items-center justify-between gap-2 rounded-2xl border border-border/70 bg-card px-4 py-3 text-left text-sm text-foreground transition hover:border-border hover:bg-muted/50"
                  >
                    {question}
                    <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <footer
          className={
            fullPage
              ? "sticky bottom-0 z-10 shrink-0 bg-background px-4 pb-3 pt-3 sm:px-6 sm:pb-5"
              : "border-t border-border/70 bg-background px-4 pb-4 pt-3"
          }
        >
          {session?.role === "user" && products.length > 0 && (
            <Link
              href="/user"
              onClick={closeAssistant}
              className="mb-2 flex items-center gap-2 rounded-lg px-1 py-1 text-[11px] text-muted-foreground transition hover:text-primary"
            >
              <PackageSearch className="size-3.5" />
              {products.length} products in your store
              <span className="ml-auto">
                Browse <ChevronRight className="inline size-3" />
              </span>
            </Link>
          )}
          <form
            onSubmit={handleSubmit}
            className={
              fullPage
                ? "mx-auto flex max-w-3xl items-end gap-2 rounded-[28px] border border-secondary/70 bg-card px-3 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition focus-within:border-secondary focus-within:ring-2 focus-within:ring-secondary/30"
                : "flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm transition focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/10"
            }
          >
            <label className="sr-only" htmlFor="rag-chat-input">
              Message the assistant
            </label>
            <textarea
              id="rag-chat-input"
              rows={1}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              placeholder="Message SupplySync"
              className={
                fullPage
                  ? "max-h-48 min-h-11 flex-1 resize-none bg-transparent px-3 py-3 text-[15px] leading-6 outline-none placeholder:text-muted-foreground"
                  : "max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
              }
            />
            <button
              type="submit"
              disabled={!draft.trim() || busy}
              aria-label="Send message"
              className={
                fullPage
                  ? "mb-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-30"
                  : "grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              }
            >
              <ArrowUp className="size-4" />
            </button>
          </form>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            AI can make mistakes. Check product details before ordering.
          </p>
        </footer>
      </aside>
      {!fullPage && open && (
        <button
          aria-label="Close assistant panel"
          onClick={closeAssistant}
          className="fixed inset-0 z-[65] bg-black/20 backdrop-blur-[1px] sm:bg-transparent sm:backdrop-blur-none"
        />
      )}
    </>
  );
}
