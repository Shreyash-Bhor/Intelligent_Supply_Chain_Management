import assert from "node:assert/strict";
import test from "node:test";
import { parseChatPayload, restoreMessages, validateFormValues } from "../src/components/chat/protocol.ts";

const product = (productId: string) => ({
  type: "product_detail", productId, name: `Product ${productId}`, sku: productId,
  category: null, imageUrl: "javascript:alert(1)", price: null, currency: null,
  availableQty: null, description: null, discount: null, attributes: {},
});

test("accepts legacy text responses and strips unsafe product image URLs", () => {
  assert.deepEqual(parseChatPayload({ answer: "Hello" }), { answer: "Hello", actions: [] });
  const parsed = parseChatPayload({ answer: "Details", actions: [product("p1")] });
  assert.equal(parsed.actions[0].type, "product_detail");
  if (parsed.actions[0].type === "product_detail") assert.equal(parsed.actions[0].imageUrl, null);
  const olderCard = parseChatPayload({ answer: "Older product card", actions: [{ type: "product_detail", productId: "p2", name: "Older", sku: "OLD", category: null, imageUrl: null, price: null, currency: null, availableQty: null }] });
  if (olderCard.actions[0].type === "product_detail") assert.equal(olderCard.actions[0].description, null);
});

test("validates and accepts product comparisons", () => {
  const parsed = parseChatPayload({ answer: "Compare", actions: [{ type: "product_comparison", products: [product("p1"), product("p2")] }] });
  assert.equal(parsed.actions[0].type, "product_comparison");
  assert.throws(() => parseChatPayload({ answer: "Compare", actions: [{ type: "product_comparison", products: [product("p1")] }] }));
});

test("validates form field definitions and options", () => {
  const parsed = parseChatPayload({ answer: "Filter", actions: [{
    type: "structured_form", action: "show_product_filters", title: "Filter products",
    fields: [{ id: "category", label: "Category", type: "select", required: false, options: [{ label: "Grocery", value: "grocery" }] }],
  }] });
  assert.equal(parsed.actions[0].type, "structured_form");
  assert.throws(() => parseChatPayload({ answer: "Bad", actions: [{ type: "structured_form", action: "arbitrary", title: "Run", fields: [] }] }));
  assert.throws(() => parseChatPayload({ answer: "Bad", actions: [{ type: "structured_form", action: "show_product_filters", title: "Filter", fields: [{ id: "email", label: "Email", type: "email", required: false }] }] }));
});

test("validates required, email, text length, and numeric form values", () => {
  const action = parseChatPayload({ answer: "Form", actions: [{
    type: "structured_form", action: "show_checkout_form", title: "Filters",
    fields: [
      { id: "email", label: "Email", type: "email", required: true },
      { id: "count", label: "Count", type: "number", required: true, min: 1, max: 5 },
      { id: "query", label: "Search", type: "text", required: false, maxLength: 4 },
    ],
  }] }).actions[0];
  assert.equal(action.type, "structured_form");
  if (action.type !== "structured_form") return;
  assert.deepEqual(validateFormValues(action.fields, { email: "bad", count: "7", query: "12345" }), {
    email: "Enter a valid email address.", count: "Enter a value within the allowed range.", query: "Use 4 characters or fewer.",
  });
  assert.equal(validateFormValues(action.fields, { email: "", count: "", query: "" }).email, "Email is required.");
});

test("restores old text-only transcripts and drops malformed structured payloads", () => {
  const restored = restoreMessages([
    { id: "legacy", role: "assistant", text: "Older response" },
    { id: "bad", role: "assistant", text: "Keep text", actions: [{ type: "run_script" }] },
    { id: "invalid", role: "system", text: "Drop" },
  ]);
  assert.deepEqual(restored, [
    { id: "legacy", role: "assistant", text: "Older response" },
    { id: "bad", role: "assistant", text: "Keep text" },
  ]);
});
