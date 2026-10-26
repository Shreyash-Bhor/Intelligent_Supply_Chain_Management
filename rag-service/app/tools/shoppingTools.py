"""Customer shopping actions backed exclusively by the inventory/pricing APIs."""
import hashlib
import hmac
import json
import secrets
import time
import uuid
from typing import Any
from app.backendClient import BackendClient
from app.config import settings

_pending: dict[str, dict[str, Any]] = {}

def _customerKey(token: str, conversationId: str | None = None) -> str:
    return hashlib.sha256(f"{token}:{conversationId or ''}".encode()).hexdigest()

def isExplicitOrderConfirmation(text: str) -> bool:
    normalized = " ".join(text.strip().lower().split()).strip(".! ")
    return normalized in {"yes", "yes, place the order", "confirm", "confirm the order", "confirm and place this order", "place the order", "proceed with this order", "i confirm this order"}

def storePendingQuote(token: str, addressId: str, quote: dict[str, Any], conversationId: str | None = None):
    data = quote.get("data", {})
    if data.get("quoteToken"):
        _pending[_customerKey(token, conversationId)] = {"addressId": addressId, "quoteToken": data["quoteToken"], "quote": data, "idempotencyKey": secrets.token_urlsafe(24), "created": time.time()}

def confirmationProof(token: str, pending: dict[str, Any]) -> str:
    quoteHash = hmac.new(b"quote", pending["quoteToken"].encode(), hashlib.sha256).hexdigest()
    payload = {"purpose": "chat-checkout-confirmation", "userId": "", "quoteHash": quoteHash, "expiresAt": int((time.time() + 90) * 1000)}
    # Backend binds this proof to the verified subject. Resolve that subject from the signed customer token.
    try:
        import base64
        payload["userId"] = json.loads(base64.urlsafe_b64decode(token.split(".")[0] + "==")).get("sub", "")
    except Exception:
        raise PermissionError("Customer authentication is required.")
    encoded = __import__("base64").urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode()).decode().rstrip("=")
    signature = hmac.new(settings.authTokenSecret.encode(), encoded.encode(), hashlib.sha256).digest()
    return encoded + "." + __import__("base64").urlsafe_b64encode(signature).decode().rstrip("=")

async def confirmAndSubmit(token: str, conversationId: str | None = None):
    key = _customerKey(token, conversationId)
    pending = _pending.get(key)
    if not pending or time.time() - pending["created"] > 180:
        _pending.pop(key, None)
        raise PermissionError("Prepare a fresh checkout summary before confirming an order.")
    result = await submitOrder(token, pending["addressId"], pending["quoteToken"], confirmationProof(token, pending), pending["idempotencyKey"])
    _pending.pop(key, None)
    if result.get("status") == "success":
        quote = pending.get("quote", {})
        result["checkoutDetails"] = {
            "lines": [
                {
                    "productId": line.get("productId"), "name": line.get("name"),
                    "sku": line.get("sku"), "category": line.get("category"),
                    "quantity": line.get("quantity"), "unitPrice": str(line.get("unitPrice")),
                    "lineTotal": f"{line.get('lineTotalMinor', 0) / 100:.2f}",
                    "currency": line.get("currency"),
                }
                for line in quote.get("lines", [])
            ],
            "total": quote.get("total"), "currency": quote.get("currency"),
        }
    return result


def _client(token: str) -> BackendClient:
    if not token:
        raise PermissionError("Sign in with a customer account to use shopping actions.")
    return BackendClient(settings.inventoryServiceUrl, token)


async def _call(token: str, method: str, path: str, *, body: Any = None, headers=None, params=None):
    async with _client(token) as client:
        return await client.request(method, path, json=body, headers=headers, params=params)


async def getCart(accessToken: str):
    return await _call(accessToken, "GET", "/api/cart/")

async def addToCart(accessToken: str, productId: str, quantity: int):
    if not _validUuid(productId) or not isinstance(quantity, int) or quantity < 1 or quantity > 100000:
        raise ValueError("Choose a valid product and quantity.")
    cart = await getCart(accessToken)
    existing = next((item for item in cart.get("data", {}).get("items", []) if item.get("productId") == productId), None)
    totalQuantity = quantity + (existing.get("quantity", 0) if existing else 0)
    if totalQuantity > 100000: raise ValueError("Requested quantity exceeds the allowed limit.")
    availableQty = existing.get("availableQty") if existing else None
    if availableQty is None:
        availability = await _call(accessToken, "GET", f"/api/inventory/product/{productId}")
        availableQty = availability.get("data", {}).get("availableQty", 0)
    if totalQuantity > availableQty:
        raise ValueError(f"Only {availableQty} units are currently available.")
    return await _call(accessToken, "PUT", "/api/cart/items", body={"productId": productId, "quantity": totalQuantity})

def _validUuid(value: str) -> bool:
    try:
        uuid.UUID(value)
        return True
    except (ValueError, TypeError, AttributeError):
        return False

async def setCartQuantity(accessToken: str, productId: str, quantity: int):
    if not _validUuid(productId) or not isinstance(quantity, int) or quantity < 1 or quantity > 100000:
        raise ValueError("Choose a valid product and quantity.")
    cart = await getCart(accessToken)
    existing = next((item for item in cart.get("data", {}).get("items", []) if item.get("productId") == productId), None)
    availableQty = existing.get("availableQty") if existing else None
    if availableQty is None:
        availability = await _call(accessToken, "GET", f"/api/inventory/product/{productId}")
        availableQty = availability.get("data", {}).get("availableQty", 0)
    if quantity > availableQty: raise ValueError(f"Only {availableQty} units are currently available.")
    return await _call(accessToken, "PUT", "/api/cart/items", body={"productId": productId, "quantity": quantity})

async def removeFromCart(accessToken: str, productId: str):
    if not _validUuid(productId): raise ValueError("A valid productId is required.")
    return await _call(accessToken, "DELETE", f"/api/cart/items/{productId}")

async def clearCart(accessToken: str):
    return await _call(accessToken, "DELETE", "/api/cart/")

async def listAddresses(accessToken: str):
    response = await _call(accessToken, "GET", "/api/addresses/")
    # The model needs only an address handle and lightweight choice cues.
    # Names, street lines, postal codes, phone numbers, and country stay backend-side.
    addresses = response.get("data", [])
    return {"status": response.get("status"), "data": [{key: item.get(key) for key in ("id", "isDefault", "city", "region")} for item in addresses]}

async def createAddress(accessToken: str, address: dict[str, Any]):
    response = await _call(accessToken, "POST", "/api/addresses/", body=address)
    item = response.get("data", {})
    return {"status": response.get("status"), "data": {key: item.get(key) for key in ("id", "isDefault", "city", "region")}}

async def updateAddress(accessToken: str, addressId: str, address: dict[str, Any]):
    response = await _call(accessToken, "PUT", f"/api/addresses/{addressId}", body=address)
    item = response.get("data", {})
    return {"status": response.get("status"), "data": {key: item.get(key) for key in ("id", "isDefault", "city", "region")}}

async def deleteAddress(accessToken: str, addressId: str):
    return await _call(accessToken, "DELETE", f"/api/addresses/{addressId}")

async def prepareCheckout(accessToken: str, addressId: str):
    return await _call(accessToken, "POST", "/api/orders/quote", body={"addressId": addressId})

async def submitOrder(accessToken: str, addressId: str, quoteToken: str, confirmationProof: str, idempotencyKey: str):
    if not confirmationProof: raise PermissionError("Explicit confirmation for this checkout is required.")
    return await _call(accessToken, "POST", "/api/orders/checkout", body={"addressId": addressId, "quoteToken": quoteToken}, headers={"Idempotency-Key": idempotencyKey, "X-Chat-Confirmation": confirmationProof})

async def orderHistory(accessToken: str):
    response = await _call(accessToken, "GET", "/api/orders/")
    return {"status": response.get("status"), "data": [_orderSummary(order) for order in response.get("data", [])]}

def _orderSummary(order: dict[str, Any]):
    return {"id": order.get("id"), "status": order.get("status"), "paymentStatus": order.get("paymentStatus"), "totalPrice": order.get("totalPrice"), "currency": order.get("currency"), "createdAt": order.get("createdAt"), "items": [{"name": item.get("product", {}).get("name"), "sku": item.get("product", {}).get("sku"), "quantity": item.get("quantity"), "totalPrice": item.get("totalPrice")} for item in order.get("items", [])], "shipments": [{"status": shipment.get("status"), "carrier": shipment.get("carrier"), "trackingNumber": shipment.get("trackingNumber")} for shipment in order.get("shipments", [])]}

async def orderDetails(accessToken: str, orderId: str):
    if not _validUuid(orderId): raise ValueError("A valid orderId is required.")
    response = await _call(accessToken, "GET", f"/api/orders/{orderId}")
    data = response.get("data")
    return {"status": response.get("status"), "data": _orderSummary(data) if data else None}
