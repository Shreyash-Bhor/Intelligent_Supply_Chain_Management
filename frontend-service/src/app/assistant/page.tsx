"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RagChatbot } from "@/components/RagChatbot";
import { useAuthSession } from "@/hooks/useAuthSession";

export default function AssistantPage() {
  const router = useRouter();
  const { session, hydrated } = useAuthSession();
  useEffect(() => {
    if (hydrated && session?.role !== "user") router.replace("/");
  }, [hydrated, router, session?.role]);
  if (!hydrated || session?.role !== "user") return <main className="grid min-h-[100dvh] place-items-center text-sm text-muted-foreground">Opening your shopping assistant…</main>;
  return <RagChatbot fullPage />;
}
