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
    async def test_show_address_displays_exact_backend_address(self):
        address = {"name": "Example Customer", "phone": "+1 555 0100", "address1": "123 Exact Road", "address2": "Suite 4", "city": "Pune", "region": "MH", "postalCode": "411001", "country": "IN", "isDefault": True}
        llm = SimpleNamespace(client=SimpleNamespace(responses=SimpleNamespace(create=AsyncMock())), model="test-model")
        with patch.object(agent, "getLLM", return_value=llm), patch.object(agent.shoppingTools, "getAddressesForDisplay", new=AsyncMock(return_value={"status": "success", "data": [address]})) as fetch:
            result = await agent.runAgent("Show my delivery address", "customer-token")
        for key, value in address.items():
            self.assertIn("default", result["answer"] if key == "isDefault" and value else str(value))
        fetch.assert_awaited_once_with("customer-token")
        llm.client.responses.create.assert_not_awaited()

    async def test_change_address_renders_address_form(self):
        llm = SimpleNamespace(client=SimpleNamespace(responses=SimpleNamespace(create=AsyncMock())), model="test-model")
        with patch.object(agent, "getLLM", return_value=llm):
            result = await agent.runAgent("Please update my delivery address", "customer-token")
        self.assertEqual(result["actions"], [{"type": "address_form"}])
        llm.client.responses.create.assert_not_awaited()

    async def test_show_cart_uses_cart_tool_without_entering_product_search(self):
        cart = {"status": "success", "data": {"items": [{"productId": "p1", "quantity": 2, "price": "4.50", "currency": "USD", "product": {"name": "Widget"}}]}}
        llm = SimpleNamespace(client=SimpleNamespace(responses=SimpleNamespace(create=AsyncMock())), model="test-model")
        tools = {"getCart": AsyncMock(return_value=cart)}
        with patch.object(agent, "getLLM", return_value=llm), patch.object(agent.shoppingTools, "getCart", tools["getCart"]):
            result = await agent.runAgent("Show my cart", "customer-token")
        self.assertIn("Widget", result["answer"])
        self.assertIn("4.50 USD", result["answer"])
        llm.client.responses.create.assert_not_awaited()
        tools["getCart"].assert_awaited_once_with("customer-token")

    async def test_checkout_prepares_and_displays_authoritative_quote(self):
        quote = {"status": "success", "data": {"address": {"id": "address-1", "name": "Customer", "address1": "1 Main St"}, "lines": [{"productId": "p1", "name": "Widget", "sku": "W1", "quantity": 1, "unitPrice": "12.50", "lineTotal": "12.50", "currency": "USD"}], "subtotal": "12.50", "shippingTotal": None, "taxTotal": None, "total": "12.50", "currency": "USD", "expiresAt": "2099-01-01T00:00:00Z", "quoteToken": "secret"}}
        llm = SimpleNamespace(client=SimpleNamespace(responses=SimpleNamespace(create=AsyncMock())), model="test-model")
        with patch.object(agent, "getLLM", return_value=llm), patch.object(agent.shoppingTools, "prepareCheckout", new=AsyncMock(return_value=quote)) as prepare, patch.object(agent.shoppingTools, "storePendingQuote") as store:
            result = await agent.runAgent("Proceed to checkout", "customer-token", conversationId="conversation-1")
        self.assertEqual(result["actions"][0]["type"], "checkout_summary")
        self.assertIn("Widget", result["answer"])
        self.assertNotIn("secret", str(result["actions"]))
        prepare.assert_awaited_once_with("customer-token")
        store.assert_called_once_with("customer-token", "address-1", quote, "conversation-1")
        llm.client.responses.create.assert_not_awaited()

    async def test_successful_cart_add_returns_success_if_follow_up_model_call_fails(self):
        responses = [
            SimpleNamespace(output=[functionCall("addToCart", '{"productId":"product-1","quantity":1}', "add")], output_text=""),
            TimeoutError("model timed out after cart update"),
        ]
        responseClient = SimpleNamespace(responses=SimpleNamespace(create=AsyncMock(side_effect=responses)))
        llm = SimpleNamespace(client=responseClient, model="test-model")
        product = {
            "id": "product-1", "name": "Widget", "sku": "W-1", "category": "Tools",
            "imageUrl": None, "price": 12.5, "currency": "USD", "availableQty": 4,
            "description": None, "discount": None, "attributes": {},
        }
        tools = {
            "addToCart": AsyncMock(return_value={"status": "success"}),
            "getProductDetails": AsyncMock(return_value=product),
        }
        with patch.object(agent, "getLLM", return_value=llm), patch.object(agent, "toolMap", tools):
            result = await agent.runAgent("Add the Widget to my cart", "customer-token")

        self.assertIn("Added Widget to your cart", result["answer"])
        self.assertEqual(result["actions"][0]["type"], "product_detail")
        self.assertEqual(result["suggestions"], ["View my cart", "Continue shopping"])
        tools["addToCart"].assert_awaited_once()

    async def test_search_results_are_enriched_as_image_ready_product_previews(self):
        responses = [
            SimpleNamespace(output=[functionCall("searchProducts", '{"query":"widget"}', "search")], output_text=""),
            SimpleNamespace(output=[], output_text="Here is the widget."),
            SimpleNamespace(output=[], output_text='["Add the widget to my cart"]'),
        ]
        responseClient = SimpleNamespace(responses=SimpleNamespace(create=AsyncMock(side_effect=responses)))
        llm = SimpleNamespace(client=responseClient, model="test-model")
        product = {
            "id": "product-1", "name": "Widget", "sku": "W-1", "category": "Tools",
            "imageUrl": "https://images.example/widget.png", "price": 12.5, "currency": "USD",
            "availableQty": 4, "description": "A useful widget", "discount": None, "attributes": {},
        }
        tools = {
            "searchProducts": AsyncMock(return_value={"status": "success", "data": [{"id": "product-1"}]}),
            "getProductDetails": AsyncMock(return_value=product),
        }
        with patch.object(agent, "getLLM", return_value=llm), patch.object(agent, "toolMap", tools):
            result = await agent.runAgent("Show me the Widget product", "customer-token")

        self.assertEqual(result["actions"][0]["type"], "product_detail")
        self.assertEqual(result["actions"][0]["imageUrl"], "https://images.example/widget.png")
        tools["getProductDetails"].assert_awaited_once_with(accessToken="customer-token", productId="product-1")

    async def test_product_to_cart_to_checkout_returns_checkout_and_suggestions(self):
        calls = [
            functionCall("searchProducts", '{"query":"widget"}', "search"),
            functionCall("getProductDetails", '{"productId":"product-1"}', "details"),
            functionCall("addToCart", '{"productId":"product-1","quantity":1}', "add"),
            functionCall("listAddresses", "{}", "addresses"),
            functionCall("prepareCheckout", '{"addressId":"address-1"}', "quote"),
        ]
        calls.extend(functionCall("getCart", "{}", f"cart-{index}") for index in range(5))
        responses = [SimpleNamespace(output=[call], output_text="") for call in calls]
        responses.append(SimpleNamespace(output=[], output_text="Checkout is ready."))
        responses.append(SimpleNamespace(output=[], output_text='["Explore more Tools"]'))
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
        self.assertEqual(result["suggestions"], ["Explore more Tools"])
        self.assertNotIn("quoteToken", str(result["actions"]))
        tools["addToCart"].assert_awaited_once()
        tools["prepareCheckout"].assert_awaited_once_with(accessToken="customer-token", addressId="address-1")


if __name__ == "__main__":
    unittest.main()
