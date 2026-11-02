import asyncio
import os
import unittest
from unittest.mock import AsyncMock, patch

os.environ.update({
    "QDRANT_URL": "http://localhost:6333", "COLLECTION_NAME": "test",
    "EMBEDDING_PROVIDER": "cloudflare",
    "EMBEDDING_MODEL": "@cf/baai/bge-small-en-v1.5", "EMBEDDING_DIMENSION": "384",
    "CLOUDFLARE_ACCOUNT_ID": "test", "CLOUDFLARE_API_TOKEN": "test",
    "GROQ_API_KEY": "test", "GROQ_MODEL": "test",
    "INVENTORY_SERVICE_URL": "http://localhost:5000",
    "PRICING_SERVICE_URL": "http://localhost:5555",
    "AUTH_TOKEN_SECRET": "unit-test-secret",
})

from app.tools import shoppingTools
from app.structuredActions import productAction


class ShoppingConfirmationTests(unittest.TestCase):
    def test_product_action_contains_only_allowlisted_authoritative_fields(self):
        action = productAction({
            "id": "product-1", "name": "Widget", "sku": "W-1",
            "category": "Electronics", "imageUrl": None, "price": 12.5,
            "currency": "USD", "availableQty": 0, "internalCost": 4,
        })
        self.assertEqual(action["type"], "product_detail")
        self.assertEqual(action["price"], "12.5")
        self.assertEqual(action["availableQty"], 0)
        self.assertNotIn("internalCost", action)

    def test_only_unambiguous_affirmatives_match(self):
        for phrase in ("yes", "Confirm the order", "Place the order", "I confirm this order"):
            self.assertTrue(shoppingTools.isExplicitOrderConfirmation(phrase))
        for phrase in ("sounds good", "buy it", "what is the total?", "maybe", "yes, add it"):
            self.assertFalse(shoppingTools.isExplicitOrderConfirmation(phrase))

    def test_pending_quotes_are_isolated_by_conversation(self):
        token = "signed-customer-token"
        quote = {"data": {"quoteToken": "quote-one"}}
        shoppingTools.storePendingQuote(token, "address-one", quote, "conversation-one")
        self.assertIn(shoppingTools._customerKey(token, "conversation-one"), shoppingTools._pending)
        self.assertNotIn(shoppingTools._customerKey(token, "conversation-two"), shoppingTools._pending)

    def test_confirmation_proof_is_issued_by_inventory_for_the_pending_quote(self):
        pending = {"addressId": "address-1", "quoteToken": "current-quote"}
        inventoryResponse = {"data": {"confirmationProof": "inventory-issued-proof"}}

        async def verify():
            with patch.object(shoppingTools, "_call", new=AsyncMock(return_value=inventoryResponse)) as call:
                proof = await shoppingTools.requestConfirmationProof("customer-token", pending)
            self.assertEqual(proof, "inventory-issued-proof")
            call.assert_awaited_once_with(
                "customer-token",
                "POST",
                "/api/orders/confirmation",
                body={
                    "addressId": "address-1",
                    "quoteToken": "current-quote",
                    "confirmation": "I confirm this order",
                },
            )

        self.assertEqual(asyncio.run(verify()), None)


if __name__ == "__main__":
    unittest.main()
