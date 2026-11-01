from functools import lru_cache
import time

import httpx

from app.config import settings

_TRANSIENT_STATUS_CODES = {408, 425, 429, 500, 502, 503, 504}
_MAX_RETRIES = 3


@lru_cache(maxsize=1)
def getEmbeddingClient() -> httpx.Client:
    """Create a lightweight reusable HTTP client; no local model is loaded."""
    return httpx.Client(
        timeout=httpx.Timeout(30.0, connect=5.0),
        headers={
            "Authorization": f"Bearer {settings.cloudflareApiToken}",
            "Content-Type": "application/json",
        },
    )


def _embedBatch(texts: list[str]) -> list[list[float]]:
    url = (
        "https://api.cloudflare.com/client/v4/accounts/"
        f"{settings.cloudflareAccountId}/ai/run/{settings.embeddingModel}"
    )
    body = {"text": texts}

    for attempt in range(_MAX_RETRIES + 1):
        try:
            response = getEmbeddingClient().post(url, json=body)
            if response.status_code in _TRANSIENT_STATUS_CODES and attempt < _MAX_RETRIES:
                retryAfter = response.headers.get("Retry-After")
                try:
                    delay = min(float(retryAfter), 8.0) if retryAfter else min(0.5 * (2**attempt), 8.0)
                except ValueError:
                    delay = min(0.5 * (2**attempt), 8.0)
                time.sleep(delay)
                continue
            response.raise_for_status()
            payload = response.json()
            vectors = payload.get("result", {}).get("data")
            if not isinstance(vectors, list) or len(vectors) != len(texts):
                raise RuntimeError("Cloudflare embedding API returned an unexpected number of vectors.")
            if any(not isinstance(vector, list) or len(vector) != settings.embeddingDimension for vector in vectors):
                raise RuntimeError(
                    f"Cloudflare embedding API returned vectors that do not match the configured "
                    f"dimension ({settings.embeddingDimension})."
                )
            return vectors
        except (httpx.TimeoutException, httpx.NetworkError):
            if attempt >= _MAX_RETRIES:
                raise RuntimeError("Cloudflare embedding request failed after retries due to a network error.") from None
            time.sleep(min(0.5 * (2**attempt), 8.0))
        except httpx.HTTPStatusError as error:
            if error.response.status_code in _TRANSIENT_STATUS_CODES and attempt < _MAX_RETRIES:
                time.sleep(min(0.5 * (2**attempt), 8.0))
                continue
            raise RuntimeError(
                f"Cloudflare embedding API returned HTTP {error.response.status_code}."
            ) from None

    raise RuntimeError("Cloudflare embedding request failed after retries.")


def generateEmbedding(text: str) -> list[float]:
    if not isinstance(text, str) or not text.strip():
        raise ValueError("Text must be a non-empty string.")
    return generateEmbeddings([text])[0]


def generateEmbeddings(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    if any(not isinstance(text, str) or not text.strip() for text in texts):
        raise ValueError("All texts must be non empty strings.")

    normalizedTexts = [text.strip() for text in texts]
    vectors: list[list[float]] = []
    batchSize = settings.embeddingBatchSize
    for start in range(0, len(normalizedTexts), batchSize):
        vectors.extend(_embedBatch(normalizedTexts[start : start + batchSize]))
    return vectors
