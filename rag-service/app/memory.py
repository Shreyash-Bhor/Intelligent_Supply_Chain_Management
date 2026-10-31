"""Customer-scoped persistent assistant memory with a bounded local fallback."""

from collections import OrderedDict
from hashlib import sha256
import base64
import hashlib
import hmac
import logging
import re
from time import time
from urllib.parse import urlsplit, urlunsplit

import httpx
from fastapi import HTTPException

from app.config import settings

logger = logging.getLogger(__name__)
MAX_CONVERSATIONS = 2_000
MAX_MESSAGES = 12
# Keep a few recent turns for follow-ups without replaying a long transcript.
MODEL_HISTORY_MESSAGES = 6
MODEL_HISTORY_CHARS_PER_MESSAGE = 1_200
MODEL_HISTORY_TOTAL_CHARS = 5_000
MEMORY_TTL_SECONDS = 60 * 60
_conversations: OrderedDict[str, tuple[float, list[dict[str, str]]]] = OrderedDict()
RATE_LIMIT_TIMEOUT_SECONDS = 8.0
MAX_DIAGNOSTIC_BODY_CHARS = 240


def _key(conversationId: str, accessToken: str | None) -> str:
    return sha256(f"{accessToken or 'anonymous'}:{conversationId}".encode()).hexdigest()


def _sanitize(value: str) -> str:
    value = re.sub(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", "[email]", value, flags=re.I)
    value = re.sub(r"(?:\+?\d[\d ().-]{7,}\d)", "[phone]", value)
    return re.sub(r"\b\d{1,6}\s+[\w'.-]+(?:\s+[\w'.-]+){0,4}\s+(?:street|st|avenue|ave|road|rd|lane|ln|drive|dr|boulevard|blvd)\b[^\n,]*", "[address]", value, flags=re.I)


async def enforceDistributedRateLimit(accessToken: str | None, clientHost: str | None = None) -> None:
    """Use a shared PostgreSQL bucket for customer sessions and hashed guest IPs."""
    baseUrl = settings.inventoryServiceUrl.strip().rstrip("/")
    if not baseUrl:
        logger.error("Assistant shared rate limiter unavailable (configuration): endpoint is not configured")
        raise HTTPException(status_code=503, detail="The assistant is temporarily unavailable. Please retry shortly.")
    endpoint = f"{baseUrl}/api/assistant/rate-limit"
    parsedEndpoint = urlsplit(endpoint)
    hostname = parsedEndpoint.hostname or ""
    if ":" in hostname and not hostname.startswith("["):
        hostname = f"[{hostname}]"
    if parsedEndpoint.port:
        hostname = f"{hostname}:{parsedEndpoint.port}"
    safeEndpoint = urlunsplit((parsedEndpoint.scheme, hostname, parsedEndpoint.path, "", ""))
    headers = {}
    if accessToken:
        headers["Authorization"] = f"Bearer {accessToken}"
    else:
        secret = settings.authTokenSecret.encode()
        clientKey = hmac.new(secret, f"guest:{clientHost or 'unknown'}".encode(), hashlib.sha256).hexdigest()
        signature = hmac.new(secret, f"rate-limit:{clientKey}".encode(), hashlib.sha256).digest()
        headers["X-Assistant-Client"] = clientKey
        headers["X-Assistant-Signature"] = base64.urlsafe_b64encode(signature).decode().rstrip("=")
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(RATE_LIMIT_TIMEOUT_SECONDS)) as client:
            response = await client.post(endpoint, headers=headers)
        if response.status_code == 429:
            retry_after = int(response.headers.get("Retry-After", "60"))
            raise HTTPException(status_code=429, detail="You have sent too many assistant requests. Please wait and try again.", headers={"Retry-After": str(retry_after)})
        response.raise_for_status()
    except HTTPException:
        raise
    except httpx.HTTPStatusError as error:
        statusCode = error.response.status_code
        bodyExcerpt = _safeRateLimitBodyExcerpt(error.response)
        logger.warning(
            "Assistant shared rate limiter rejected request (upstream_status=%s endpoint=%s body_excerpt=%r)",
            statusCode,
            safeEndpoint,
            bodyExcerpt,
        )
        raise HTTPException(status_code=503, detail="The assistant is temporarily unavailable. Please retry shortly.") from error
    except httpx.HTTPError as error:
        logger.warning(
            "Assistant shared rate limiter unavailable (error=%s endpoint=%s)",
            type(error).__name__,
            safeEndpoint,
        )
        raise HTTPException(status_code=503, detail="The assistant is temporarily unavailable. Please retry shortly.") from error


def _safeRateLimitBodyExcerpt(response: httpx.Response) -> str:
    """Return only known generic response fields; never log arbitrary upstream text."""
    allowedMessages = {
        "Assistant rate limiting is unavailable.",
        "Assistant service authorization is required.",
        "Assistant service authorization is invalid.",
        "You have sent too many assistant requests. Please wait a minute and try again.",
    }
    try:
        payload = response.json()
    except (ValueError, UnicodeDecodeError):
        payload = None
    if isinstance(payload, dict):
        # Message is included only for exact generic server responses; arbitrary
        # error fields may echo tokens, customer input, or database values.
        payload = {key: payload[key] for key in ("status", "code") if isinstance(payload.get(key), (str, int, float, bool))}
        message = response.json().get("message")
        if message in allowedMessages:
            payload["message"] = message
        excerpt = str(payload)
    else:
        excerpt = "[non-JSON response omitted for privacy]"
    return excerpt[:MAX_DIAGNOSTIC_BODY_CHARS]


def _localHistory(conversationId: str | None, accessToken: str | None) -> list[dict[str, str]]:
    if not conversationId:
        return []
    key = _key(conversationId, accessToken)
    entry = _conversations.get(key)
    if not entry:
        return []
    updatedAt, messages = entry
    if time() - updatedAt > MEMORY_TTL_SECONDS:
        del _conversations[key]
        return []
    _conversations.move_to_end(key)
    return list(messages)


def compactHistory(messages: list[dict[str, str]]) -> list[dict[str, str]]:
    """Return only a bounded, recent text history suitable for model input."""
    recent = messages[-MODEL_HISTORY_MESSAGES:]
    bounded = [
        {"role": item["role"], "content": item["content"].strip()[:MODEL_HISTORY_CHARS_PER_MESSAGE]}
        for item in recent
        if item.get("role") in {"user", "assistant"} and isinstance(item.get("content"), str) and item["content"].strip()
    ]
    total = 0
    selected = []
    for item in reversed(bounded):
        size = len(item["content"])
        if selected and total + size > MODEL_HISTORY_TOTAL_CHARS:
            break
        selected.append(item)
        total += size
    return list(reversed(selected))


async def getHistory(conversationId: str | None, accessToken: str | None) -> list[dict[str, str]]:
    if not conversationId:
        return []
    if accessToken:
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(8.0)) as client:
                response = await client.get(
                    f"{settings.inventoryServiceUrl.rstrip('/')}/api/assistant/conversations/{conversationId}",
                    headers={"Authorization": f"Bearer {accessToken}"},
                )
            response.raise_for_status()
            messages = response.json().get("data", {}).get("messages", [])
            if isinstance(messages, list):
                return [{"role": item["role"], "content": item["content"]} for item in messages if isinstance(item, dict) and item.get("role") in {"user", "assistant"} and isinstance(item.get("content"), str)][-MAX_MESSAGES:]
        except httpx.HTTPError as error:
            logger.warning("Assistant memory read unavailable (%s)", type(error).__name__)
    return _localHistory(conversationId, accessToken)


async def saveTurn(conversationId: str | None, accessToken: str | None, query: str, answer: str) -> None:
    if not conversationId:
        return
    safeQuery = _sanitize(query.strip())[:4000]
    safeAnswer = _sanitize(answer.strip())[:8000]
    # Checkout cards and addresses stay in the backend quote state; do not retain
    # them in conversational memory.
    if "checkout summary" in safeAnswer.lower() or "shipping address:" in safeAnswer.lower():
        safeAnswer = "A checkout quote was prepared and shown to the customer."
    if re.search(r"\b(address|postal code|zip code)\b", safeQuery, flags=re.I) or re.search(r"\b(address|postal code|zip code)\b", safeAnswer, flags=re.I):
        safeQuery = "The customer discussed a delivery address."
        safeAnswer = "The assistant discussed delivery address options."
    messages = [*_localHistory(conversationId, accessToken), {"role": "user", "content": safeQuery}, {"role": "assistant", "content": safeAnswer}][-MAX_MESSAGES:]
    key = _key(conversationId, accessToken)
    _conversations[key] = (time(), messages)
    _conversations.move_to_end(key)
    while len(_conversations) > MAX_CONVERSATIONS:
        _conversations.popitem(last=False)
    if accessToken:
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(8.0)) as client:
                response = await client.post(
                    f"{settings.inventoryServiceUrl.rstrip('/')}/api/assistant/conversations/{conversationId}/turns",
                    headers={"Authorization": f"Bearer {accessToken}"},
                    json={"query": safeQuery, "answer": safeAnswer},
                )
            response.raise_for_status()
        except httpx.HTTPError as error:
            logger.warning("Assistant memory write unavailable (%s)", type(error).__name__)
