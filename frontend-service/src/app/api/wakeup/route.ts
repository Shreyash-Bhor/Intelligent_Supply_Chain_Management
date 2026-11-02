import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const services = {
  inventory:
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
    "http://localhost:5000",
  pricing:
    process.env.NEXT_PUBLIC_PRICING_API_BASE_URL?.replace(/\/$/, "") ??
    "http://localhost:5555",
  rag: process.env.RAG_SERVICE_URL?.replace(/\/$/, "") ?? "http://localhost:8000",
} as const;

type ServiceName = keyof typeof services;

export async function POST(request: NextRequest) {
  let requestedServices: unknown;
  try {
    ({ services: requestedServices } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (
    !Array.isArray(requestedServices) ||
    requestedServices.some(
      (service) => typeof service !== "string" || !(service in services),
    )
  ) {
    return NextResponse.json({ error: "Invalid services list" }, { status: 400 });
  }

  const results = await Promise.all(
    (requestedServices as ServiceName[]).map(async (service) => {
      try {
        const response = await fetch(`${services[service]}/health`, {
          cache: "no-store",
          signal: AbortSignal.timeout(10_000),
        });
        return [service, response.ok] as const;
      } catch {
        return [service, false] as const;
      }
    }),
  );

  return NextResponse.json({
    results: Object.fromEntries(results),
  });
}
