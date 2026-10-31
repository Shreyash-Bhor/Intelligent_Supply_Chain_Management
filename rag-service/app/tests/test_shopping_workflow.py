import base64
import hashlib
import hmac
import json
import os
import unittest

os.environ.update({
    "QDRANT_URL": "http://localhost:6333", "COLLECTION_NAME": "test",
    "EMBEDDING_MODEL": "test", "EMBEDDING_DIMENSION": "1",
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

    def test_confirmation_proof_is_bound_to_customer_and_quote(self):
        customer_payload = base64.urlsafe_b64encode(json.dumps({"sub": "customer-1"}).encode()).decode().rstrip("=")
        pending = {"quoteToken": "current-quote"}
        proof = shoppingTools.confirmationProof(customer_payload + ".not-verified-here", pending)
        payload, signature = proof.split(".")
        expected = hmac.new(b"unit-test-secret", payload.encode(), hashlib.sha256).digest()
        self.assertTrue(hmac.compare_digest(base64.urlsafe_b64decode(signature + "=="), expected))
        claims = json.loads(base64.urlsafe_b64decode(payload + "=="))
        self.assertEqual(claims["purpose"], "chat-checkout-confirmation")
        self.assertEqual(claims["userId"], "customer-1")
        self.assertEqual(claims["quoteHash"], hmac.new(b"quote", b"current-quote", hashlib.sha256).hexdigest())


if __name__ == "__main__":
    unittest.main()
