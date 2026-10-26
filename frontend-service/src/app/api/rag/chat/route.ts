import { NextResponse } from "next/server";

const RAG_API_URL =
  process.env.RAG_SERVICE_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Shopper sign in is required to use the assistant." }, { status: 401 });
    }
    const inventoryApiUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:5000";
    const customerSession = await fetch(`${inventoryApiUrl}/api/auth/me`, {
      headers: { Authorization: authorization },
      cache: "no-store",
    });
    if (!customerSession.ok) {
      return NextResponse.json({ message: "A valid shopper session is required to use the assistant." }, { status: 401 });
    }
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
        Authorization: authorization,
      },
      body: JSON.stringify({ query: body.query.trim(), conversationId: body.conversationId }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
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
      { message: "The assistant is unavailable. Start the RAG service to use chat; the rest of the site remains available." },
      { status: 503 },
    );
  }
}
