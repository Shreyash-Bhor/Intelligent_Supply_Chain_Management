import asyncio
import os
import unittest
from unittest.mock import AsyncMock, patch

os.environ.setdefault("QDRANT_URL", "http://localhost:6333")
os.environ.setdefault("COLLECTION_NAME", "test")
os.environ.setdefault("EMBEDDING_MODEL", "test")
os.environ.setdefault("EMBEDDING_DIMENSION", "1")
os.environ.setdefault("GROQ_API_KEY", "test")
os.environ.setdefault("GROQ_MODEL", "test")
os.environ.setdefault("INVENTORY_SERVICE_URL", "http://localhost:5000")
os.environ.setdefault("PRICING_SERVICE_URL", "http://localhost:5555")
os.environ.setdefault("AUTH_TOKEN_SECRET", "unit-test-secret")

import httpx
from fastapi import HTTPException
from app import memory
from app.agentLimits import iterationLimit
from app.structuredActions import productAction, productComparisonAction, validateFormAction
from app.tools import productTools
from app.config import settings


class StructuredActionTests(unittest.TestCase):
    def test_validates_allowlisted_form_and_removes_null_optionals(self):
        value = validateFormAction({"type": "structured_form", "action": "show_product_filters", "title": "Filter products", "fields": [{"id": "category", "label": "Category", "type": "select", "required": False, "options": [{"label": "Grocery", "value": "Grocery"}], "defaultValue": None}]})
        self.assertEqual(value["fields"][0]["options"][0]["value"], "Grocery")
        self.assertNotIn("defaultValue", value["fields"][0])

    def test_rejects_unsupported_or_malformed_form_actions(self):
        for invalid in (
            {"type": "structured_form", "action": "execute_script", "title": "x", "fields": [{"id": "x", "label": "x", "type": "text"}]},
            {"type": "structured_form", "action": "show_product_filters", "title": "x", "fields": [{"id": "Bad ID", "label": "x", "type": "text"}]},
            {"type": "structured_form", "action": "show_product_filters", "title": "x", "fields": [{"id": "category", "label": "Category", "type": "select", "required": False}]},
            {"type": "structured_form", "action": "show_product_filters", "title": "x", "fields": [{"id": "count", "label": "Count", "type": "number", "required": False, "defaultValue": "many"}]},
            {"type": "structured_form", "action": "show_product_filters", "title": "x", "fields": [{"id": "count", "label": "Count", "type": "number", "required": False, "min": 10, "max": 1}]},
            {"type": "structured_form", "action": "show_product_filters", "title": "x", "fields": [{"id": "email", "label": "Email", "type": "email", "required": False}]},
        ):
            with self.assertRaises(ValueError):
                validateFormAction(invalid)

    def test_product_action_drops_untrusted_extra_fields_and_bad_attributes(self):
        action = productAction({"id": "p1", "name": "Item", "sku": "A1", "price": 10, "currency": "USD", "availableQty": 0, "internalCost": 3, "attributes": {"Color": "Blue", "secret": {"x": 1}}})
        self.assertEqual(action["price"], "10")
        self.assertEqual(action["availableQty"], 0)
        self.assertEqual(action["attributes"], {"Color": "Blue"})
        self.assertNotIn("internalCost", action)

    def test_comparison_is_limited_and_keeps_two_or_more_products(self):
        items = [{"id": str(i), "name": f"Item {i}", "sku": str(i)} for i in range(5)]
        result = productComparisonAction(items)
        self.assertEqual(len(result["products"]), 4)


class ProductIntegrationTests(unittest.TestCase):
    def test_detail_returns_partial_data_when_price_and_inventory_are_unavailable(self):
        client = AsyncMock()
        client.get.return_value = {"data": {"id": "p1", "name": "Item", "sku": "A1", "category": "Grocery", "imageUrl": None, "isActive": True}}
        client.close = AsyncMock()
        with patch.object(productTools, "BackendClient", return_value=client), patch.object(productTools, "getProductPrice", new=AsyncMock(side_effect=TimeoutError())), patch.object(productTools, "getProductAvailability", new=AsyncMock(side_effect=TimeoutError())):
            result = asyncio.run(productTools.getProductDetails(productId="p1"))
        self.assertEqual(result["name"], "Item")
        self.assertIsNone(result["price"])
        self.assertIsNone(result["availableQty"])
        self.assertIsNone(result["description"])

    def test_exact_sku_resolves_to_authoritative_product_id(self):
        client = AsyncMock()
        async def get(path, **_kwargs):
            if path == "/api/product/ABC-1":
                response = httpx.Response(404, request=httpx.Request("GET", "http://inventory/api/product/ABC-1"))
                response.raise_for_status()
            return {"data": [{"id": "authoritative-id", "name": "Item", "sku": "ABC-1", "category": "Grocery", "imageUrl": None, "isActive": True}]}
        client.get.side_effect = get
        client.close = AsyncMock()
        with patch.object(productTools, "BackendClient", return_value=client), patch.object(productTools, "getProductPrice", new=AsyncMock(return_value={"data": {"price": 4, "currency": "USD"}})), patch.object(productTools, "getProductAvailability", new=AsyncMock(return_value={"data": {"availableQty": 2}})):
            result = asyncio.run(productTools.getProductDetails(productId="ABC-1"))
        self.assertEqual(result["id"], "authoritative-id")
        self.assertEqual(client.get.call_args_list[1].args[0], "/api/product/search")


class ConversationMemoryTests(unittest.TestCase):
    def test_local_fallback_memory_is_isolated_by_customer_and_conversation(self):
        memory._conversations.clear()
        key = memory._key("conversation", "customer-one-token")
        memory._conversations[key] = (memory.time(), [{"role": "user", "content": "one"}])
        self.assertEqual(memory._localHistory("conversation", "customer-one-token")[0]["content"], "one")
        self.assertEqual(memory._localHistory("conversation", "customer-two-token"), [])
        self.assertEqual(memory._localHistory("another", "customer-one-token"), [])


class AgentIterationBudgetTests(unittest.TestCase):
    def test_multi_step_shopping_requests_use_the_shopping_budget(self):
        with patch.object(settings, "maxAgentIterations", 10), patch.object(settings, "maxShoppingAgentIterations", 20):
            self.assertEqual(iterationLimit("Find running shoes, add them to cart, and proceed to checkout"), 20)
            self.assertEqual(iterationLimit("What are the features of running shoes?"), 10)


class MemoryRemoteAndRateLimitTests(unittest.IsolatedAsyncioTestCase):
    async def test_history_load_uses_authenticated_persistent_api(self):
        class Response:
            def raise_for_status(self): pass
            def json(self): return {"data": {"messages": [{"role": "user", "content": "hello"}]}}
        captured = {}
        class Client:
            def __init__(self, **_kwargs): pass
            async def __aenter__(self): return self
            async def __aexit__(self, *_args): pass
            async def get(self, _url, **kwargs): captured.update(kwargs); return Response()
        with patch.object(memory.httpx, "AsyncClient", Client):
            history = await memory.getHistory("conv-1", "verified-token")
        self.assertEqual(history[0]["content"], "hello")
        self.assertEqual(captured["headers"]["Authorization"], "Bearer verified-token")

    async def test_guest_rate_limit_identity_is_signed_and_retry_after_is_forwarded(self):
        class Response:
            status_code = 429
            headers = {"Retry-After": "37"}
            def raise_for_status(self): raise httpx.HTTPStatusError("limited", request=httpx.Request("POST", "http://inventory"), response=httpx.Response(429, request=httpx.Request("POST", "http://inventory")))
        captured = {}
        class Client:
            def __init__(self, **_kwargs): pass
            async def __aenter__(self): return self
            async def __aexit__(self, *_args): pass
            async def post(self, _url, **kwargs): captured.update(kwargs); return Response()
        with patch.object(memory.httpx, "AsyncClient", Client):
            with self.assertRaises(HTTPException) as raised:
                await memory.enforceDistributedRateLimit(None, "127.0.0.2")
        self.assertEqual(raised.exception.status_code, 429)
        self.assertEqual(raised.exception.headers["Retry-After"], "37")
        self.assertEqual(len(captured["headers"]["X-Assistant-Client"]), 64)
        self.assertNotIn("127.0.0.2", captured["headers"]["X-Assistant-Client"])

    async def _checkWithResponse(self, response):
        captured = {}
        class Client:
            def __init__(self, **_kwargs): pass
            async def __aenter__(self): return self
            async def __aexit__(self, *_args): pass
            async def post(self, url, **kwargs):
                captured["url"] = url
                captured.update(kwargs)
                return response
        with patch.object(memory.httpx, "AsyncClient", Client):
            await memory.enforceDistributedRateLimit("verified-token")
        return captured

    async def test_shared_limiter_success_allows_request(self):
        response = httpx.Response(200, json={"status": "success", "data": {"allowed": True}}, request=httpx.Request("POST", "http://inventory/api/assistant/rate-limit"))
        captured = await self._checkWithResponse(response)
        self.assertEqual(captured["url"], "http://localhost:5000/api/assistant/rate-limit")
        self.assertEqual(captured["headers"]["Authorization"], "Bearer verified-token")

    async def test_shared_limiter_429_remains_rate_limit_rejection(self):
        response = httpx.Response(429, headers={"Retry-After": "23"}, json={"status": "error"}, request=httpx.Request("POST", "http://inventory/api/assistant/rate-limit"))
        with self.assertRaises(HTTPException) as raised:
            await self._checkWithResponse(response)
        self.assertEqual(raised.exception.status_code, 429)
        self.assertEqual(raised.exception.headers["Retry-After"], "23")

    async def test_upstream_4xx_and_5xx_fail_closed_with_sanitized_diagnostics(self):
        for status in (401, 404, 500, 503):
            with self.subTest(status=status):
                response = httpx.Response(
                    status,
                    json={"status": "error", "message": "Bearer secret-token email me@example.com", "customerName": "Private Customer"},
                    request=httpx.Request("POST", "http://inventory/api/assistant/rate-limit"),
                )
                with self.assertLogs(memory.logger, level="WARNING") as captured:
                    with self.assertRaises(HTTPException) as raised:
                        await self._checkWithResponse(response)
                self.assertEqual(raised.exception.status_code, 503)
                log = "\n".join(captured.output)
                self.assertIn(f"upstream_status={status}", log)
                self.assertIn("http://localhost:5000/api/assistant/rate-limit", log)
                self.assertNotIn("secret-token", log)
                self.assertNotIn("me@example.com", log)
                self.assertNotIn("Private Customer", log)

    async def test_timeout_fails_closed_with_endpoint_diagnostic(self):
        class Client:
            def __init__(self, **_kwargs): pass
            async def __aenter__(self): return self
            async def __aexit__(self, *_args): pass
            async def post(self, _url, **_kwargs): raise httpx.TimeoutException("timed out")
        with patch.object(memory.httpx, "AsyncClient", Client):
            with self.assertLogs(memory.logger, level="WARNING") as captured:
                with self.assertRaises(HTTPException) as raised:
                    await memory.enforceDistributedRateLimit("verified-token")
        self.assertEqual(raised.exception.status_code, 503)
        self.assertIn("http://localhost:5000/api/assistant/rate-limit", "\n".join(captured.output))

    async def test_missing_limiter_configuration_fails_closed_without_request(self):
        with patch.object(memory.settings, "inventoryServiceUrl", ""):
            with self.assertLogs(memory.logger, level="ERROR") as captured:
                with self.assertRaises(HTTPException) as raised:
                    await memory.enforceDistributedRateLimit("verified-token")
        self.assertEqual(raised.exception.status_code, 503)
        self.assertIn("endpoint is not configured", "\n".join(captured.output))


if __name__ == "__main__":
    unittest.main()
