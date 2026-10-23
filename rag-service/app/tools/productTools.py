from typing import Any
import asyncio

from app.backendClient import BackendClient
from app.config import settings


async def searchProducts(
    accessToken: str | None = None,
    query: str | None = None,
    category: str | None = None,
    maxPrice: float | None = None,
    page: int = 1,
    pageSize: int = 10,
    inStock: bool = False,
) -> dict[str, Any]:
    """Search products and optionally filter by maximum price."""

    if maxPrice is not None and maxPrice < 0:
        raise ValueError("maxPrice must not be negative.")

    if page < 1 or pageSize < 1 or pageSize > 50:
        raise ValueError("page must be positive and pageSize must be between 1 and 50.")
    inventoryClient = BackendClient(baseUrl=settings.inventoryServiceUrl, accessToken=accessToken)

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

        if accessToken:
            catalogParams: dict[str, Any] = {"page": page, "pageSize": pageSize, "inStock": str(inStock).lower()}
            catalogParams.update(params)
            productResponse = await inventoryClient.get("/api/product/user-catalog", params=catalogParams)
            catalog = productResponse.get("data", {})
            products = catalog.get("data", [])
            pagination = catalog.get("pagination")
        else:
            productResponse = await inventoryClient.get("/api/product/search", params=params or None)
            products = productResponse.get("data", [])
            pagination = None

        if not products:
            return {
                "status": "success",
                "data": [],
                "pagination": pagination,
            }

        products = products[:20]
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
                "id": product.get("id"),
                "name": product.get("name"),
                "sku": product.get("sku"),
                "category": product.get("category"),
                "imageUrl": product.get("imageUrl"),
                "price": priceData["price"] if priceData else None,
                "currency": priceData["currency"] if priceData else None,
            })

        return {
            "status": "success",
            "data": results,
            "pagination": pagination,
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
        lookup = productId.strip()
        try:
            response = await client.get(f"/api/product/{lookup}")
        except Exception as error:
            # A SKU is a supported identifier; resolve it against active catalog rows.
            import httpx
            if not isinstance(error, httpx.HTTPStatusError) or error.response.status_code != 404:
                raise
            search = await client.get("/api/product/search", params={"query": lookup})
            matches = search.get("data", [])
            exact = [item for item in matches if str(item.get("sku", "")).casefold() == lookup.casefold()]
            if len(exact) != 1:
                raise ValueError("No unique active product matches that SKU. Search products and ask the customer to choose.")
            response = {"data": exact[0]}

        data = response.get("data", {})
        if data.get("isActive") is False:
            raise ValueError("This product is not available in the customer catalog.")
        priceTask = getProductPrice(accessToken, productId.strip())
        stockTask = getProductAvailability(accessToken, productId.strip())
        priceResult, stockResult = await asyncio.gather(priceTask, stockTask, return_exceptions=True)
        priceData = priceResult.get("data", {}) if isinstance(priceResult, dict) else {}
        stockData = stockResult.get("data", {}) if isinstance(stockResult, dict) else {}

        return {
            "id": data.get("id"),
            "name": data.get("name"),
            "sku": data.get("sku"),
            "category": data.get("category"),
            "imageUrl": data.get("imageUrl"),
            "price": priceData.get("price"),
            "currency": priceData.get("currency"),
            "availableQty": stockData.get("availableQty"),
            "description": data.get("description") if isinstance(data.get("description"), str) else None,
            "discount": priceData.get("discount") if isinstance(priceData.get("discount"), str) else None,
            "attributes": data.get("attributes") if isinstance(data.get("attributes"), dict) else {},
        }

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
        response = await client.get(f"/api/inventory/product/{productId.strip()}")
        data = response.get("data", {})
        return {"status": response.get("status"), "data": {"productId": data.get("productId"), "availableQty": data.get("availableQty")}}
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
