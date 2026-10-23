import asyncio
import os
import sys
import types
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

os.environ.update({
    "QDRANT_URL": "http://localhost:6333", "COLLECTION_NAME": "test",
    "EMBEDDING_MODEL": "test", "EMBEDDING_DIMENSION": "1",
    "GROQ_API_KEY": "test", "GROQ_MODEL": "test",
    "INVENTORY_SERVICE_URL": "http://localhost:5000",
    "PRICING_SERVICE_URL": "http://localhost:5555", "AUTH_TOKEN_SECRET": "unit-test-secret",
})

# Keep this workflow test independent of the embedding model and vector store.
ragStub = types.ModuleType("app.rag")
ragStub.answer = AsyncMock()
sys.modules.setdefault("app.rag", ragStub)

from app import agent
from app.config import settings


def functionCall(name, arguments, callId):
    return SimpleNamespace(type="function_call", name=name, arguments=arguments, call_id=callId)


class AgentShoppingWorkflowTests(unittest.IsolatedAsyncioTestCase):
    async def test_product_to_cart_to_checkout_survives_more_than_ten_rounds(self):
        calls = [
            functionCall("searchProducts", '{"query":"widget"}', "search"),
            functionCall("getProductDetails", '{"productId":"product-1"}', "details"),
            functionCall("addToCart", '{"productId":"product-1","quantity":1}', "add"),
            functionCall("listAddresses", "{}", "addresses"),
            functionCall("prepareCheckout", '{"addressId":"address-1"}', "quote"),
        ]
        calls.extend(functionCall("getCart", "{}", f"cart-{index}") for index in range(6))
        responses = [SimpleNamespace(output=[call], output_text="") for call in calls]
        responses.append(SimpleNamespace(output=[], output_text="Checkout is ready."))
        responseClient = SimpleNamespace(responses=SimpleNamespace(create=AsyncMock(side_effect=responses)))
        llm = SimpleNamespace(client=responseClient, model="test-model")
        product = {
            "id": "product-1", "name": "Widget", "sku": "W-1", "category": "Tools",
            "imageUrl": None, "price": 12.5, "currency": "USD", "availableQty": 4,
            "description": None, "discount": None, "attributes": {},
        }
        quote = {
            "status": "success",
            "data": {
                "lines": [{"productId": "product-1", "name": "Widget", "sku": "W-1", "quantity": 1, "unitPrice": "12.50", "lineTotal": "12.50", "currency": "USD"}],
                "address": {"name": "Customer", "address1": "1 Main St", "city": "Pune", "region": "MH", "postalCode": "411001", "country": "IN"},
                "subtotal": "12.50", "shippingTotal": None, "taxTotal": None, "total": "12.50", "currency": "USD", "expiresAt": "2099-01-01T00:00:00Z", "quoteToken": "secret",
            },
        }
        tools = {
            "searchProducts": AsyncMock(return_value={"data": [{"id": "product-1", "sku": "W-1"}]}),
            "getProductDetails": AsyncMock(return_value=product),
            "addToCart": AsyncMock(return_value={"status": "success"}),
            "listAddresses": AsyncMock(return_value={"status": "success", "data": [{"id": "address-1", "isDefault": True, "city": "Pune", "region": "MH"}]}),
            "prepareCheckout": AsyncMock(return_value=quote),
            "getCart": AsyncMock(return_value={"status": "success", "data": {"items": []}}),
        }
        with patch.object(agent, "getLLM", return_value=llm), patch.object(agent, "toolMap", tools), patch.object(settings, "maxAgentIterations", 10), patch.object(settings, "maxShoppingAgentIterations", 20):
            result = await agent.runAgent(
                "Find a widget, add it to my cart, and proceed to checkout", "customer-token",
            )

        self.assertEqual(responseClient.responses.create.await_count, 12)
        self.assertIn("Widget", result["answer"])
        self.assertEqual(result["actions"][0]["type"], "checkout_summary")
        self.assertNotIn("quoteToken", str(result["actions"]))
        tools["addToCart"].assert_awaited_once()
        tools["prepareCheckout"].assert_awaited_once_with(accessToken="customer-token", addressId="address-1")


if __name__ == "__main__":
    unittest.main()
