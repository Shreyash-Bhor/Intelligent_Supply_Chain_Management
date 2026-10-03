from typing import Any

from app.backendClient import BackendClient
from app.config import settings


async def searchProducts(
    accessToken: str | None = None,
    query: str | None = None,
    category: str | None = None,
    maxPrice: float | None = None,
) -> dict[str, Any]:
    """Search products and optionally filter by maximum price."""

    if maxPrice is not None and maxPrice < 0:
        raise ValueError("maxPrice must not be negative.")

    inventoryClient = BackendClient(
        baseUrl=settings.inventoryServiceUrl,
        accessToken=accessToken,
    )

    pricingClient = BackendClient(
        baseUrl=settings.pricingServiceUrl,
        accessToken=accessToken,
    )

    try:
        params: dict[str, str] = {}

        if query and query.strip():
            params["query"] = query.strip()

        if category and category.strip():
            params["category"] = category.strip()

        productResponse = await inventoryClient.get(
            "/api/product/search",
            params=params or None,
        )

        products = productResponse.get("data", [])

        if not products:
            return {
                "status": "success",
                "data": [],
            }

        productIds = [product["id"] for product in products]

        priceResponse = await pricingClient.get(
            "/api/prices",
            params={
                "productIds": ",".join(productIds),
            },
        )

        prices = {
            item["productId"]: item
            for item in priceResponse.get("data", [])
        }

        results = []

        for product in products:
            priceData = prices.get(product["id"])

            if maxPrice is not None:
                if not priceData or priceData["price"] > maxPrice:
                    continue

            results.append({
                **product,
                "price": priceData["price"] if priceData else None,
                "currency": priceData["currency"] if priceData else None,
            })

        return {
            "status": "success",
            "data": results,
        }

    finally:
        await inventoryClient.close()
        await pricingClient.close()


async def getProductDetails(
    accessToken: str | None = None,
    productId: str = "",
) -> dict[str, Any]:
    """Get detailed information about a product."""

    if not productId or not productId.strip():
        raise ValueError("productId must not be empty.")

    client = BackendClient(
        baseUrl=settings.inventoryServiceUrl,
        accessToken=accessToken,
    )

    try:
        return await client.get(
            f"/api/product/{productId.strip()}"
        )
    finally:
        await client.close()


async def getProductAvailability(
    accessToken: str | None = None,
    productId: str = "",
) -> dict[str, Any]:
    """Get current product availability across active warehouses."""

    if not productId or not productId.strip():
        raise ValueError("productId must not be empty.")

    client = BackendClient(
        baseUrl=settings.inventoryServiceUrl,
        accessToken=accessToken,
    )

    try:
        return await client.get(
            f"/api/inventory/product/{productId.strip()}"
        )
    finally:
        await client.close()


async def getProductPrice(
    accessToken: str | None = None,
    productId: str = "",
) -> dict[str, Any]:
    """Get the current price of a product."""

    if not productId or not productId.strip():
        raise ValueError("productId must not be empty.")

    client = BackendClient(
        baseUrl=settings.pricingServiceUrl,
        accessToken=accessToken,
    )

    try:
        return await client.get(
            f"/api/prices/{productId.strip()}"
        )
    finally:
        await client.close()