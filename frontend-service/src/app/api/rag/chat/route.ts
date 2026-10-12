import { NextResponse } from "next/server";

const RAG_API_URL =
  process.env.RAG_SERVICE_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { query?: string };
    if (!body.query?.trim()) {
      return NextResponse.json({ message: "Enter a message to continue." }, { status: 400 });
    }

    const response = await fetch(`${RAG_API_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(request.headers.get("authorization")
          ? { Authorization: request.headers.get("authorization")! }
          : {}),
      },
      body: JSON.stringify({ query: body.query.trim() }),
      cache: "no-store",
    });
    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json(
      { message: "The assistant is temporarily unavailable. Please try again." },
      { status: 502 },
    );
  }
}
