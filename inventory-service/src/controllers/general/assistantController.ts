import { Request, Response } from "express";
import { z } from "zod";
import { createHmac } from "node:crypto";
import prisma from "../../lib/prisma";
import { asyncHandler } from "../../utils/asyncHandler";
import { verifyGuestRateLimitSignature } from "../../services/assistantSecurity";

const conversationIdSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
const turnSchema = z.object({ query: z.string().trim().min(1).max(4000), answer: z.string().trim().min(1).max(8000) }).strict();
const TTL_DAYS = 30;

export const getAssistantConversation = asyncHandler(async (req: Request, res: Response) => {
  const conversationId = conversationIdSchema.parse(req.params.conversationId);
  const userId = res.locals.customer.sub as string;
  const now = new Date();
  await prisma.assistantConversation.deleteMany({ where: { expiresAt: { lt: now } } });
  const item = await prisma.assistantConversation.findUnique({ where: { userId_conversationId: { userId, conversationId } } });
  if (!item || item.expiresAt <= now) return res.status(200).json({ status: "success", data: { messages: [] } });
  return res.status(200).json({ status: "success", data: { messages: item.messages } });
});

function privateText(value: string) {
  const sanitized = value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/(?:\+?\d[\d ().-]{7,}\d)/g, "[phone]")
    .replace(/\b\d{1,6}\s+[\w'.-]+(?:\s+[\w'.-]+){0,4}\s+(?:street|st|avenue|ave|road|rd|lane|ln|drive|dr|boulevard|blvd)\b[^\n,]*/gi, "[address]");
  return /\b(address|postal code|zip code)\b/i.test(sanitized) ? "[delivery address discussion]" : sanitized;
}

export const appendAssistantTurn = asyncHandler(async (req: Request, res: Response) => {
  const conversationId = conversationIdSchema.parse(req.params.conversationId);
  const { query, answer } = turnSchema.parse(req.body);
  const userId = res.locals.customer.sub as string;
  const now = new Date();
  const existing = await prisma.assistantConversation.findUnique({ where: { userId_conversationId: { userId, conversationId } } });
  const current = existing && existing.expiresAt > now && Array.isArray(existing.messages) ? existing.messages as Array<{ role: string; content: string }> : [];
  const messages = [
    ...current,
    { role: "user", content: privateText(query) },
    { role: "assistant", content: privateText(answer) },
  ].slice(-12);
  await prisma.assistantConversation.upsert({
    where: { userId_conversationId: { userId, conversationId } },
    create: { userId, conversationId, messages, expiresAt: new Date(now.getTime() + TTL_DAYS * 86400000) },
    update: { messages, expiresAt: new Date(now.getTime() + TTL_DAYS * 86400000) },
  });
  await prisma.assistantConversation.deleteMany({ where: { expiresAt: { lt: now } } });
  return res.status(200).json({ status: "success", data: { saved: true } });
});

export const consumeAssistantRateLimit = asyncHandler(async (req: Request, res: Response) => {
  const userId = res.locals.customer?.sub as string | undefined;
  let bucketId: string;
  if (userId) {
    const secret = process.env.AUTH_TOKEN_SECRET;
    if (!secret) return res.status(503).json({ status: "error", message: "Assistant rate limiting is unavailable." });
    bucketId = createHmac("sha256", secret).update(`customer:${userId}`).digest("hex");
  } else {
    const key = req.header("X-Assistant-Client") ?? "";
    const signature = req.header("X-Assistant-Signature") ?? "";
    const secret = process.env.AUTH_TOKEN_SECRET;
    if (!secret || !/^[a-f0-9]{64}$/.test(key) || !signature) return res.status(401).json({ status: "unauthorized", message: "Assistant service authorization is required." });
    if (!verifyGuestRateLimitSignature(key, signature, secret)) return res.status(401).json({ status: "unauthorized", message: "Assistant service authorization is invalid." });
    bucketId = `guest:${key}`;
  }
  const now = new Date();
  const windowMs = 60_000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const limit = 30;
  const bucket = await prisma.assistantRateLimit.upsert({
    where: { bucketId_windowStart: { bucketId, windowStart } },
    create: { bucketId, windowStart, hits: 1 },
    update: { hits: { increment: 1 } },
  });
  await prisma.assistantRateLimit.deleteMany({ where: { windowStart: { lt: new Date(now.getTime() - 3600000) } } });
  const resetAt = new Date(windowStart.getTime() + windowMs);
  res.setHeader("RateLimit-Limit", String(limit));
  res.setHeader("RateLimit-Remaining", String(Math.max(0, limit - bucket.hits)));
  res.setHeader("RateLimit-Reset", String(Math.ceil(resetAt.getTime() / 1000)));
  if (bucket.hits > limit) {
    res.setHeader("Retry-After", String(Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 1000))));
    return res.status(429).json({ status: "error", message: "You have sent too many assistant requests. Please wait a minute and try again." });
  }
  return res.status(200).json({ status: "success", data: { allowed: true } });
});
