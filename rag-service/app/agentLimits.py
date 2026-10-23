from app.config import settings


def iterationLimit(query: str) -> int:
    """Give requests that span product discovery and checkout enough bounded turns."""
    normalized = query.lower()
    isShoppingFlow = any(phrase in normalized for phrase in (
        "add to cart", "checkout", "check out", "buy", "purchase", "place an order",
    ))
    if isShoppingFlow:
        return max(settings.maxAgentIterations, settings.maxShoppingAgentIterations)
    return settings.maxAgentIterations
