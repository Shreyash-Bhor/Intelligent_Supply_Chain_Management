import { NextResponse } from "next/server";

const RAG_API_URL =
  process.env.RAG_SERVICE_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 16_384) return NextResponse.json({ message: "Message is too large. Shorten it and try again." }, { status: 413 });
    const body = (await request.json()) as { query?: string; conversationId?: string };
    if (typeof body.query !== "string" || !body.query.trim() || body.query.length > 4000) {
      return NextResponse.json({ message: "Enter a message up to 4,000 characters to continue." }, { status: 400 });
    }
    if (body.conversationId !== undefined && (typeof body.conversationId !== "string" || body.conversationId.length > 128)) return NextResponse.json({ message: "Invalid conversation identifier." }, { status: 400 });

    const response = await fetch(`${RAG_API_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(request.headers.get("authorization")
          ? { Authorization: request.headers.get("authorization")! }
          : {}),
      },
      body: JSON.stringify({ query: body.query.trim(), conversationId: body.conversationId }),
      cache: "no-store",
    });
    const payload = await response.json();
    const responseHeaders = new Headers();
    for (const name of ["Retry-After", "RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset"]) {
      const value = response.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return NextResponse.json(payload, { status: response.status, headers: responseHeaders });
  } catch {
    return NextResponse.json(
      { message: "The assistant is temporarily unavailable. Please try again." },
      { status: 502 },
    );
  }
}
