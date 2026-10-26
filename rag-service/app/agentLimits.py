from app.config import settings


def iterationLimit(query: str) -> int:
    """Keep every agent request within the provider's safe 10-round ceiling."""
    normalized = query.lower()
    isShoppingFlow = any(phrase in normalized for phrase in (
        "add to cart", "checkout", "check out", "buy", "purchase", "place an order",
    ))
    configuredLimit = max(settings.maxAgentIterations, settings.maxShoppingAgentIterations) if isShoppingFlow else settings.maxAgentIterations
    return max(1, min(configuredLimit, 10))
