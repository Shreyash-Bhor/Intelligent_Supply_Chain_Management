import asyncio
import json
import re
from typing import Any

from app.llm.factory import getLLM
from app.tools.productTools import (
    searchProducts,
    searchCategoryProducts,
    getProductDetails,
)
from app.tools.toolDefinitions import toolDefinitions
from app.rag import answer as searchKnowledgeBase
from app.tools import shoppingTools
from app.structuredActions import productAction, productComparisonAction, validateFormAction
from app.agentLimits import iterationLimit
from app.memory import compactHistory

MAX_TOOL_RESULT_CHARS = 12_000


def _toolArguments(call: Any) -> dict[str, Any] | None:
    """Parse and check the top-level contract before dispatching a model call."""
    try:
        arguments = json.loads(call.arguments)
    except (TypeError, json.JSONDecodeError):
        return None
    definition = next((item for item in toolDefinitions if item.get("name") == call.name), None)
    if not isinstance(arguments, dict) or definition is None:
        return None
    schema = definition.get("parameters", {})
    properties = schema.get("properties", {})
    defaults = {"query": None, "category": None, "maxPrice": None, "page": 1, "pageSize": 10, "inStock": False}
    for key in schema.get("required", []):
        if key not in arguments and call.name == "searchProducts" and key in defaults:
            arguments[key] = defaults[key]
        elif key not in arguments:
            return None
    if schema.get("additionalProperties") is False and any(key not in properties for key in arguments):
        return None
    return arguments


def _modelToolOutput(value: Any) -> str:
    """Bound tool context while keeping the payload valid JSON for the model."""
    truncated = False

    def bound(item: Any, depth: int = 0) -> Any:
        nonlocal truncated
        if isinstance(item, str):
            if len(item) > 4_000:
                truncated = True
                return item[:4_000] + "…"
            return item
        if isinstance(item, list):
            if len(item) > 6:
                truncated = True
            return [bound(entry, depth + 1) for entry in item[:6]]
        if isinstance(item, dict):
            if depth >= 5:
                truncated = True
                return "[nested result omitted]"
            keys = list(item)[:30]
            if len(item) > len(keys):
                truncated = True
            result = {key: bound(item[key], depth + 1) for key in keys}
            return result
        return item

    value = bound(value)
    if truncated and isinstance(value, dict):
        value["truncated"] = True
    serialized = json.dumps(value, ensure_ascii=False, default=str)
    if len(serialized) <= MAX_TOOL_RESULT_CHARS:
        return serialized
    # Large knowledge-base/backend responses are summarized by a bounded notice;
    # downstream response generation must not consume arbitrary payloads.
    status = value.get("status", "success") if isinstance(value, dict) else "success"
    return json.dumps({"status": status, "message": "The result was too large to include in full. Use the key facts already returned or request a narrower lookup."})

AGENT_INSTRUCTIONS = """
You are an e-commerce assistant for a supply-chain system.

Use the available tools according to these rules:

General requests customers can ask include: “Show me products in Electronics”, “Find [product or SKU]”, “Show my cart”, “Add [product] to my cart”, “Track my orders”, and “How does ordering work?”. Use the matching catalog, cart, order, or knowledge tool only when needed.

1. searchCategoryProducts
   Use for a category browsing request. It returns exactly up to three complete
   product details, including price and stock. Do not call another product
   details, price, or availability tool for those results.

2. searchProducts
   Use for product discovery, including:
   - product name
   - SKU
   - category
   - maximum price
   For an explicit category browse, use searchCategoryProducts instead. Make
   one targeted search per request and report a clear no-results response;
   do not fan out to broader searches unless the customer asks.

3. getProductDetails
   Use for requests to show or describe one specific product. This tool also
   retrieves current price and availability for the structured product card.
   It accepts an authoritative product ID or an exact SKU.
   It can also answer questions about:
   - product attributes
   - specifications
   - category
   - SKU
   - clarification about a product

4. searchKnowledgeBase
   Use for general product knowledge, specifications, features,
   policies, and other information that is not real-time.

5. requestAddressForm
   Use when an authenticated customer wants to add or enter a delivery address.
   The frontend form saves only after the customer explicitly submits it.

6. requestStructuredForm
   Request a supported inline form only when structured input advances the task.
   Use only the allowlisted action names and provide simple user-facing fields.

Important rules:
- Minimize tool rounds. In each response, request every independent tool result needed next so they run in one round; do not split independent lookups across responses.
- Reuse results already returned in this turn. Never repeat a search or lookup unless new user input changes what is needed.
- For a product request, use one search to identify candidates, then request details for all relevant product IDs together. getProductDetails already includes current price and availability.
- For checkout with no customer-specified address, prepare one quote directly; the backend uses the customer's saved default and fetches cart, address, prices, products, and stock together. List addresses only when the customer asks to choose a different one. Never repeat a successful quote unless cart or address details change.
- Never invent product, price, or availability information.
- Use backend tools for real-time data.
- Use the knowledge base for static information.
- You may use multiple tools when necessary.
- Shopping mutations require an authenticated customer. Never ask for, infer, or pass a customer identifier.
- Prefer the marked default address unless the customer specifies otherwise. When the customer asks to see their address, retrieve and display the exact saved address fields from the backend. When they ask to add, edit, correct, or change an address, show the address form with saved fields prefilled; never guess or silently apply address changes.
- Cart actions never place an order. For checkout, retrieve a quote and show its exact products, quantities, address, and payable total before asking for confirmation.
- Call placeConfirmedOrder only when the current user message is an explicit affirmative response to the displayed quote. A general intention to buy is not confirmation.
- If the user changes cart contents, quantity, address, or other checkout details, prepare and display a fresh quote before requesting confirmation again.
- Never call placeConfirmedOrder for a manager or unauthenticated user.
- If a tool requires a productId and the user has not provided one,
  first use searchProducts to identify the product.
- For an ambiguous product name, show search results and ask which one the customer means.
- For comparisons, retrieve each product independently and return only verified results.
- When the customer asks to check out, call prepareCheckout directly using the default saved address unless they specified another saved address. Show an inline checkout form only when the customer requested changes such as a quantity; after form submission, apply any quantity change with setCartQuantity, then use prepareCheckout to produce the authoritative quote. Use an address form if they need to enter or change a delivery address. Keep the exact quote review and explicit order confirmation flow.
- Use requestStructuredForm for product filters when an inline form is useful. Use requestAddressForm for saved-address management. For checkout, use the inline form to gather requested changes, then prepareCheckout for the actual quote.
- After an address is created or updated, acknowledge that it was saved and help the customer continue the requested task. If they are ordering, use the saved/default address with the cart to prepare checkout; do not stop at the address form or ask them to repeat their request.
- When comparing products, retrieve the required information for each
  product before answering.
- Treat knowledge-base tool output as source material: synthesize only the relevant facts, paraphrase them, and never paste raw passages or large retrieved tables into the response.
- Format the final answer as clean Markdown: answer directly first, then use short paragraphs, bullets for related facts, numbered steps for processes, and a Markdown table only when a comparison is clearer in a table. Preserve relevant values and caveats, and use **bold** sparingly for key labels.
- Keep responses concise and user-friendly; do not add unsupported recommendations or repeat the same fact.
- End each response with one clear, relevant next step when the task is not complete. Use the customer's current intent and the verified results to choose it; avoid generic follow-up questions when an available action can move the order forward.
""".strip()

toolMap = {
    "requestAddressForm": lambda: {"status": "success", "message": "Show the supported delivery address form."},
    "requestStructuredForm": lambda **_kwargs: {"status": "success"},
    "searchProducts": searchProducts,
    "searchCategoryProducts": searchCategoryProducts,
    "getProductDetails": getProductDetails,
    "searchKnowledgeBase": searchKnowledgeBase,
    "getCart": shoppingTools.getCart,
    "addToCart": shoppingTools.addToCart,
    "setCartQuantity": shoppingTools.setCartQuantity,
    "removeFromCart": shoppingTools.removeFromCart,
    "clearCart": shoppingTools.clearCart,
    "listAddresses": shoppingTools.listAddresses,
    "createAddress": shoppingTools.createAddress,
    "updateAddress": shoppingTools.updateAddress,
    "deleteAddress": shoppingTools.deleteAddress,
    "prepareCheckout": shoppingTools.prepareCheckout,
    "placeConfirmedOrder": shoppingTools.confirmAndSubmit,
    "orderHistory": shoppingTools.orderHistory,
    "orderDetails": shoppingTools.orderDetails,
}

def _requestedForm(action: str, title: str, fields: list[dict[str, Any]]) -> dict[str, Any]:
    return validateFormAction({"type": "structured_form", "action": action, "title": title, "fields": fields})

def _checkoutSummary(quote: dict[str, Any]) -> str:
    lines = quote.get("lines", [])
    products = "\n".join(
        f"- {line.get('name')} (SKU {line.get('sku')}): {line.get('quantity')} × {line.get('unitPrice')} {line.get('currency')} = {line.get('lineTotal')} {line.get('currency')}"
        for line in lines
    )
    address = quote.get("address", {})
    addressText = ", ".join(str(value) for value in [address.get("name"), address.get("address1"), address.get("address2"), address.get("city"), address.get("region"), address.get("postalCode"), address.get("country")] if value)
    currency = quote.get("currency", "")
    return (f"Checkout summary\n\n{products}\n\nShipping address: {addressText}\nItems subtotal: {quote.get('subtotal')} {currency}\nShipping: {quote.get('shippingTotal') or 'not calculated'}\nTax: {quote.get('taxTotal') or 'not calculated'}\nFinal payable amount: {quote.get('total')} {currency}\n\nThis quote expires at {quote.get('expiresAt')}. No payment is collected at checkout. Reply **yes** or **confirm the order** to place this exact order. Any change requires a new quote.")


def _checkoutAction(quote: dict[str, Any]) -> dict[str, Any]:
    """Return only allowlisted, backend-sourced display fields; never expose quote credentials."""
    address = quote.get("address") or {}
    lines = quote.get("lines") or []
    return {
        "type": "checkout_summary",
        "lines": [{key: line.get(key) for key in ("productId", "name", "sku", "quantity", "unitPrice", "lineTotal", "currency")} for line in lines],
        "address": {key: address.get(key) for key in ("name", "address1", "address2", "city", "region", "postalCode", "country")},
        "subtotal": quote.get("subtotal"),
        "shippingTotal": quote.get("shippingTotal"),
        "taxTotal": quote.get("taxTotal"),
        "total": quote.get("total"),
        "currency": quote.get("currency"),
        "expiresAt": quote.get("expiresAt"),
    }


def _fallbackSuggestedReplies(actions: list[dict[str, Any]]) -> list[str]:
    if any(action.get("type") == "order_confirmation" for action in actions):
        categories = list(dict.fromkeys(line.get("category") for action in actions if action.get("type") == "order_confirmation" for line in action.get("lines", []) if isinstance(line.get("category"), str) and line["category"].strip()))
        return [f"Explore more {category}" for category in categories[:4]] or ["Explore more products like these"]
    if any(action.get("type") == "checkout_summary" for action in actions):
        return ["I confirm this order", "Change my delivery address"]
    if any(action.get("type") == "address_form" or (action.get("type") == "structured_form" and action.get("action") == "show_address_form") for action in actions):
        return ["Continue to checkout", "Use a different address"]
    if any(action.get("type") in {"product_detail", "product_comparison"} for action in actions):
        return ["Add this product to my cart", "View my cart and checkout"]
    return ["Find a product", "View my cart"]


def _productSearchFallback(searchCache: dict[str, dict[str, Any]]) -> str:
    for result in reversed(list(searchCache.values())):
        if result.get("status") == "no_results" and isinstance(result.get("message"), str):
            return result["message"]
    return "I couldn’t complete that product search. Please try another product name or choose from the available categories."


def _interruptedFallback(searchCache: dict[str, dict[str, Any]], productActions: list[dict[str, Any]], addedProductIds: list[str]) -> dict[str, Any]:
    uniqueProducts = list({item.get("productId"): item for item in productActions if item.get("productId")}.values())[:4]
    if addedProductIds:
        names = [item.get("name") for item in uniqueProducts if item.get("productId") in addedProductIds and item.get("name")]
        return {"answer": f"Added {', '.join(dict.fromkeys(names)) or 'the requested product'} to your cart.", "actions": [item for item in uniqueProducts if item.get("productId") in addedProductIds], "suggestions": ["View my cart", "Continue shopping"]}
    if uniqueProducts:
        names = ", ".join(str(item.get("name")) for item in uniqueProducts if item.get("name"))
        return {"answer": f"I found these products: {names}. The assistant could not finish the full response; you can select a product to continue.", "actions": uniqueProducts, "suggestions": _fallbackSuggestedReplies(uniqueProducts)}
    return {"answer": _productSearchFallback(searchCache), "actions": [], "suggestions": ["Find a product by name", "View available categories"]}


def _orderConfirmation(result: dict[str, Any]) -> dict[str, Any]:
    order = result.get("data") or {}
    details = result.get("checkoutDetails") or {}
    total = order.get("totalPrice", details.get("total", "see order details"))
    currency = order.get("currency", details.get("currency", ""))
    action = {
        "type": "order_confirmation",
        "orderId": str(order.get("id", "")),
        "status": str(order.get("status", "CONFIRMED")),
        "total": str(total),
        "currency": str(currency),
        "lines": details.get("lines", []),
    }
    return {
        "answer": f"Your order is confirmed. Order ID: {action['orderId'] or 'see order details'}. Status: {action['status']}. Total: {total} {currency}.",
        "actions": [action],
    }


async def _suggestedReplies(llm: Any, query: str, history: list[dict[str, str]], answer: str, actions: list[dict[str, Any]]) -> list[str]:
    """Ask the assistant to choose short next-step chips from this turn's context."""
    try:
        actionContext = []
        for action in actions:
            kind = action.get("type")
            if kind == "order_confirmation":
                actionContext.append({"type": kind, "lines": [{"name": line.get("name"), "category": line.get("category")} for line in action.get("lines", [])]})
            elif kind == "checkout_summary":
                actionContext.append({"type": kind, "lines": [{"name": line.get("name"), "quantity": line.get("quantity")} for line in action.get("lines", [])]})
            elif kind == "product_detail":
                actionContext.append({"type": kind, "name": action.get("name"), "category": action.get("category")})
            elif kind == "product_comparison":
                actionContext.append({"type": kind, "products": [{"name": product.get("name"), "category": product.get("category")} for product in action.get("products", [])]})
            elif kind == "structured_form":
                actionContext.append({"type": kind, "action": action.get("action"), "title": action.get("title")})
            else:
                actionContext.append({"type": kind})
        response = await asyncio.wait_for(llm.client.responses.create(
            model=llm.model,
            instructions=(
                "Choose 1 to 4 concise clickable reply suggestions for the customer, based on their current conversation and the assistant's latest answer/actions. "
                "Return only a JSON array of strings. Make every suggestion a natural message the customer can send. "
                "Prioritize the next useful step in the active task. After a completed order, suggest exploring products in the categories actually present in the order. "
                "Never suggest confirming an order unless the actions include a live checkout_summary. Do not invent product categories or choices."
            ),
            input=json.dumps({
                "recentConversation": history[-8:],
                "latestCustomerMessage": query,
                "latestAssistantAnswer": answer,
                "availableActions": actionContext,
            }, ensure_ascii=False),
        ), timeout=10.0)
        raw = response.output_text.strip()
        if raw.startswith("```"):
            raw = raw.strip("`").removeprefix("json").strip()
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            match = re.search(r"\[[\s\S]*\]", raw)
            parsed = json.loads(match.group(0)) if match else []
        if isinstance(parsed, dict):
            parsed = parsed.get("suggestions", [])
        if not isinstance(parsed, list):
            return []
        suggestions: list[str] = []
        seen: set[str] = set()
        for item in parsed:
            if not isinstance(item, str):
                continue
            value = " ".join(item.split())
            key = value.casefold()
            if value and len(value) <= 100 and key not in seen:
                suggestions.append(value)
                seen.add(key)
            if len(suggestions) == 4:
                break
        return suggestions or _fallbackSuggestedReplies(actions)
    except Exception:
        return _fallbackSuggestedReplies(actions)
async def runAgent(
    query: str,
    accessToken: str | None = None,
    history: list[dict[str, str]] | None = None,
    conversationId: str | None = None,
) -> dict[str, Any]:
    if not query or not query.strip():
        raise ValueError("Query must not be empty.")

    # These are account actions, not product searches. Handle the common
    # navigation intents with their authoritative backend tools so a model
    # misclassification cannot turn them into a misleading product failure.
    normalizedQuery = " ".join(query.casefold().split())
    addressIntent = bool(re.search(r"\b(address|delivery details|shipping address)\b", normalizedQuery))
    addressChangeIntent = addressIntent and bool(re.search(r"\b(change|edit|update|correct|fix|add|new|replace|modify)\b", normalizedQuery))
    addressShowIntent = addressIntent and bool(re.search(r"\b(show|view|what|which|see|display|tell me|read)\b", normalizedQuery))
    if accessToken and addressChangeIntent:
        return {
            "answer": "Update your delivery address using the saved address as a starting point, or choose to enter a new one. Review the fields and save when they’re correct.",
            "actions": [{"type": "address_form"}],
            "suggestions": ["Continue to checkout", "Show my delivery address"],
        }
    if accessToken and addressShowIntent:
        try:
            response = await shoppingTools.getAddressesForDisplay(accessToken)
            addresses = response.get("data", []) if isinstance(response, dict) and response.get("status") == "success" else []
            if not addresses:
                return {"answer": "You don’t have a saved delivery address yet. Add one below to use it for checkout.", "actions": [{"type": "address_form"}], "suggestions": ["Add a delivery address"]}
            showAll = bool(re.search(r"\b(all|every|saved addresses|addresses)\b", normalizedQuery))
            selected = addresses if showAll else [next((item for item in addresses if item.get("isDefault")), addresses[0])]
            sections = []
            for index, address in enumerate(selected, 1):
                label = f"Address {index}" + (" (default)" if address.get("isDefault") else "")
                fields = [("Name", "name"), ("Phone", "phone"), ("Address line 1", "address1"), ("Address line 2", "address2"), ("City", "city"), ("State/region", "region"), ("Postal code", "postalCode"), ("Country", "country")]
                lines = [f"- **{title}:** {address.get(key) if address.get(key) not in (None, '') else 'Not provided'}" for title, key in fields]
                sections.append(f"**{label}**\n" + "\n".join(lines))
            return {"answer": "Here are your saved delivery details:\n\n" + "\n\n".join(sections), "actions": [], "suggestions": ["Change my delivery address", "Continue to checkout"]}
        except Exception:
            return {"answer": "I couldn’t load your saved delivery address just now. Please try again.", "actions": [], "suggestions": ["Show my delivery address"]}
    if accessToken and re.search(r"\b(show|view|open|see|check|display|list)\b.*\b(my )?(cart|basket)\b|\bmy (cart|basket)\b", normalizedQuery):
        try:
            cartResult = await shoppingTools.getCart(accessToken)
            cartData = cartResult.get("data", {}) if isinstance(cartResult, dict) else {}
            items = cartData.get("items", []) if isinstance(cartData, dict) else []
            if not items:
                answer = "Your cart is empty. Browse products and add something to get started."
            else:
                rows = []
                for item in items[:20]:
                    product = item.get("product") or {}
                    name = product.get("name") or "Unavailable product"
                    quantity = item.get("quantity", 0)
                    price = item.get("price")
                    currency = item.get("currency") or ""
                    rows.append(f"- **{name}** × {quantity}" + (f" — {price} {currency}" if price is not None else ""))
                answer = "Here’s your cart:\n\n" + "\n".join(rows) + "\n\nYou can manage quantities and continue to checkout from the Cart page."
            return {"answer": answer, "actions": [], "suggestions": ["Continue to checkout", "Keep shopping"]}
        except Exception:
            return {"answer": "I couldn’t load your cart just now. Please open the Cart page and try again.", "actions": [], "suggestions": ["Open my cart", "Keep shopping"]}

    requestsCheckout = bool(re.search(r"\b(check ?out|place an order|buy now|complete my order)\b", normalizedQuery))
    needsCheckoutChanges = bool(re.search(r"\b(quantity|quantities|qty|different address|change address|another address|change delivery)\b", normalizedQuery))
    if accessToken and requestsCheckout and not needsCheckoutChanges:
        try:
            quoteResult = await shoppingTools.prepareCheckout(accessToken)
            if quoteResult.get("status") == "success":
                quote = quoteResult.get("data", {})
                addressId = quote.get("address", {}).get("id")
                shoppingTools.storePendingQuote(accessToken, addressId, quoteResult, conversationId)
                actions = [_checkoutAction(quote)]
                return {"answer": _checkoutSummary(quote), "actions": actions, "suggestions": _fallbackSuggestedReplies(actions)}
            message = quoteResult.get("message") or "I couldn’t prepare checkout. Please review your cart and saved delivery address."
            return {"answer": str(message), "actions": [], "suggestions": ["View my cart", "Manage delivery address"]}
        except Exception:
            return {"answer": "I couldn’t prepare checkout just now. Please review your cart and saved delivery address, then try again.", "actions": [], "suggestions": ["View my cart", "Try checkout again"]}

    if accessToken and shoppingTools.isExplicitOrderConfirmation(query):
        try:
            result = await shoppingTools.confirmAndSubmit(accessToken, conversationId)
            if result.get("status") == "success":
                confirmed = _orderConfirmation(result)
                try:
                    confirmed["suggestions"] = await _suggestedReplies(getLLM(), query, history or [], confirmed["answer"], confirmed["actions"])
                except Exception:
                    confirmed["suggestions"] = []
                return confirmed
        except PermissionError:
            # Without an active quote, a bare affirmative must not create an order.
            pass

    llm = getLLM()

    userInput = {
        "role": "user",
        "content": query.strip(),
    }

    boundedHistory = compactHistory(history or [])
    inputItems = [*boundedHistory, userInput]
    pendingQuoteForDisplay: dict[str, Any] | None = None
    productActions: list[dict[str, Any]] = []
    addedProductIds: list[str] = []
    formActions: list[dict[str, Any]] = []
    addressFormRequested = False
    searchCache: dict[str, dict[str, Any]] = {}
    searchLocks: dict[str, asyncio.Lock] = {}

    maxToolRounds = iterationLimit(query)
    for toolRound in range(maxToolRounds + 1):
        try:
            response = await llm.client.responses.create(
                model=llm.model,
                instructions=AGENT_INSTRUCTIONS,
                input=inputItems,
                tools=toolDefinitions,
            )
        except Exception:
            if pendingQuoteForDisplay and accessToken:
                shoppingTools.storePendingQuote(accessToken, pendingQuoteForDisplay["addressId"], pendingQuoteForDisplay["result"], conversationId)
                quote = pendingQuoteForDisplay["result"].get("data", {})
                answer = _checkoutSummary(quote)
                actions = [_checkoutAction(quote)]
                return {"answer": answer, "actions": actions, "suggestions": _fallbackSuggestedReplies(actions)}
            return _interruptedFallback(searchCache, productActions, addedProductIds)

        functionCalls = [
            item
            for item in response.output
            if item.type == "function_call"
        ]

        if not functionCalls:
            finalAnswer = response.output_text

            if not finalAnswer or not finalAnswer.strip():
                finalAnswer = _productSearchFallback(searchCache)

            if pendingQuoteForDisplay and accessToken:
                shoppingTools.storePendingQuote(accessToken, pendingQuoteForDisplay["addressId"], pendingQuoteForDisplay["result"], conversationId)
                quote = pendingQuoteForDisplay["result"].get("data", {})
                answer = _checkoutSummary(quote)
                actions = [_checkoutAction(quote)]
                return {"answer": answer, "actions": actions, "suggestions": await _suggestedReplies(llm, query, history or [], answer, actions)}
            uniqueProducts = list({item["productId"]: item for item in productActions}.values())
            actions = uniqueProducts[:4]
            if len(uniqueProducts) > 1 and any(word in query.lower() for word in ("compare", "comparison", "versus", " vs ")):
                actions = [productComparisonAction([{
                    "id": item["productId"], "name": item["name"], "sku": item["sku"],
                    "category": item["category"], "imageUrl": item["imageUrl"], "price": item["price"],
                    "currency": item["currency"], "availableQty": item["availableQty"],
                    "description": item["description"], "discount": item["discount"], "attributes": item["attributes"],
                } for item in productActions])]
            actions.extend(formActions)
            if addressFormRequested:
                actions.append({"type": "address_form"})
            finalActions = actions[:4]
            answer = finalAnswer.strip()
            return {"answer": answer, "actions": finalActions, "suggestions": await _suggestedReplies(llm, query, history or [], answer, finalActions)}

        # Give the model one response after the final permitted tool round so it
        # can summarize the results, but never execute an eleventh tool round.
        if toolRound == maxToolRounds:
            break

        # Keep only the current model output + its tool results.
        nextInput = list(response.output)

        async def executeToolCall(call: Any) -> dict[str, Any]:
            tool = toolMap.get(call.name)

            if tool is None:
                return {"type": "function_call_output", "call_id": call.call_id,
                        "output": json.dumps({"status": "error", "message": "That action is not available."})}

            arguments = _toolArguments(call)
            if arguments is None:
                return {"type": "function_call_output", "call_id": call.call_id,
                        "output": json.dumps({"status": "error", "message": "The requested action had invalid arguments."})}
            resultForModel: Any = None

            searchKey = None
            if call.name == "searchProducts" and isinstance(arguments, dict):
                searchKey = json.dumps(arguments, sort_keys=True, separators=(",", ":"))
                if searchKey in searchCache:
                    return {"type": "function_call_output", "call_id": call.call_id, "output": _modelToolOutput(searchCache[searchKey])}

            try:
                if call.name == "requestAddressForm":
                    if accessToken:
                        addressFormRequested = True
                        result = tool()
                        result["message"] = "Show the supported address form. Do not claim an address was saved."
                    else:
                        result = {"status": "unauthorized", "message": "Sign in to manage delivery addresses."}
                elif call.name == "requestStructuredForm":
                    action = arguments.get("action")
                    if action == "show_address_form" and not accessToken:
                        result = {"status": "unauthorized", "message": "Sign in to manage delivery addresses."}
                    else:
                        form = _requestedForm(action, arguments.get("title", ""), arguments.get("fields", []))
                        formActions.append(form)
                        result = {"status": "success", "message": "The validated inline form will be shown to the customer."}
                elif call.name == "searchKnowledgeBase":
                    result = await tool(**arguments)
                elif call.name == "placeConfirmedOrder":
                    if not accessToken or not shoppingTools.isExplicitOrderConfirmation(query):
                        result = {"status": "confirmation_required", "message": "Please explicitly confirm the checkout summary before I place the order."}
                    else:
                        result = await tool(accessToken, conversationId)
                else:
                    if call.name in {"getCart", "addToCart", "setCartQuantity", "removeFromCart", "clearCart", "listAddresses", "createAddress", "updateAddress", "deleteAddress", "prepareCheckout", "orderHistory", "orderDetails"} and not accessToken:
                        result = {"status": "unauthorized", "message": "Sign in with a customer account to use shopping actions."}
                    elif call.name == "searchProducts" and searchKey is not None:
                        lock = searchLocks.setdefault(searchKey, asyncio.Lock())
                        async with lock:
                            result = searchCache.get(searchKey)
                            if result is None:
                                try:
                                    result = await tool(accessToken=accessToken, **arguments)
                                except Exception:
                                    result = {"status": "error", "message": "That search could not be completed. Please try another product keyword."}
                                if isinstance(result, dict):
                                    searchCache[searchKey] = result
                            if isinstance(result, dict) and result.get("status") == "success":
                                candidates = [item for item in result.get("data", []) if isinstance(item, dict) and item.get("id")][:4]
                                details = await asyncio.gather(
                                    *(toolMap["getProductDetails"](accessToken=accessToken, productId=item["id"]) for item in candidates),
                                    return_exceptions=True,
                                )
                                productActions.extend(
                                    productAction(item) for item in details
                                    if isinstance(item, dict) and item.get("id")
                                )
                    elif call.name == "searchCategoryProducts":
                        result = await tool(accessToken=accessToken, **arguments)
                        if result.get("status") == "success":
                            products = [item for item in result.get("data", []) if isinstance(item, dict) and item.get("id")][:3]
                            result["data"] = products
                            productActions.extend(productAction(item) for item in products)
                    else:
                        result = await tool(accessToken=accessToken, **arguments)
                        if call.name == "addToCart" and result.get("status") == "success":
                            product_id = arguments.get("productId")
                            if isinstance(product_id, str) and product_id not in addedProductIds:
                                addedProductIds.append(product_id)
                        if call.name == "addToCart" and result.get("status") == "success":
                            # Include a verified product card on the add-to-cart turn,
                            # even when the customer started with a direct add request.
                            product_id = arguments.get("productId")
                            if isinstance(product_id, str) and not any(item.get("productId") == product_id for item in productActions):
                                try:
                                    details = await toolMap["getProductDetails"](accessToken=accessToken, productId=product_id)
                                    if isinstance(details, dict) and details.get("id"):
                                        productActions.append(productAction(details))
                                except Exception:
                                    pass
                        if call.name == "prepareCheckout" and accessToken and result.get("status") == "success":
                            pendingQuoteForDisplay = {"addressId": arguments.get("addressId") or result.get("data", {}).get("address", {}).get("id"), "result": result}
                            resultForModel = {"status": "success", "message": "An authoritative checkout quote is ready. The server will display its exact contents for explicit customer review."}
                        if call.name == "getProductDetails" and result.get("id"):
                            productActions.append(productAction(result))
                        if call.name in {"createAddress", "updateAddress"} and result.get("status") == "success":
                            addressData = result.get("data", {})
                            resultForModel = {"status": "success", "data": {key: addressData.get(key) for key in ("id", "isDefault", "city", "region")}}
            except (PermissionError, ValueError) as error:
                result = {"status": "error", "message": str(error)}
            except Exception:
                # Backend responses can contain infrastructure details; keep them out of model context.
                result = {"status": "error", "message": "That request could not be completed. Check the details and try again."}

            if call.name == "searchProducts" and isinstance(result, dict) and searchKey is not None:
                searchCache[searchKey] = result

            return {
                "type": "function_call_output",
                "call_id": call.call_id,
                "output": _modelToolOutput(resultForModel if resultForModel is not None else result),
            }

        # Mutations must complete before a quote is prepared, and order placement
        # is always isolated after other calls so its confirmation remains explicit.
        checkoutMutations = {"addToCart", "setCartQuantity", "removeFromCart", "clearCart", "createAddress", "updateAddress", "deleteAddress"}
        quoteCalls = [call for call in functionCalls if call.name == "prepareCheckout"]
        confirmationCalls = [call for call in functionCalls if call.name == "placeConfirmedOrder"]
        ordinaryCalls = [call for call in functionCalls if call.name not in {"prepareCheckout", "placeConfirmedOrder"}]

        # Preserve output order while running independent calls concurrently.
        pendingResults: dict[str, dict[str, Any]] = {}
        mutationCalls = [call for call in ordinaryCalls if call.name in checkoutMutations]
        lookupCalls = [call for call in ordinaryCalls if call.name not in checkoutMutations]
        completedMutations: set[tuple[str, str]] = set()
        for call in mutationCalls:
            # Repeated identical writes in one model round are almost always a
            # duplicate function-call emission. Never apply them twice.
            try:
                mutationKey = (call.name, json.dumps(json.loads(call.arguments), sort_keys=True, separators=(",", ":")))
            except (TypeError, json.JSONDecodeError):
                mutationKey = (call.name, call.call_id)
            if mutationKey in completedMutations:
                pendingResults[call.call_id] = {
                    "type": "function_call_output", "call_id": call.call_id,
                    "output": json.dumps({"status": "duplicate_suppressed", "message": "The identical update was already applied in this round."}),
                }
                continue
            completedMutations.add(mutationKey)
            output = await executeToolCall(call)
            pendingResults[output["call_id"]] = output
        ordinaryCalls = lookupCalls

        for group in (ordinaryCalls, quoteCalls, confirmationCalls):
            if group is confirmationCalls and quoteCalls:
                for call in group:
                    pendingResults[call.call_id] = {
                        "type": "function_call_output",
                        "call_id": call.call_id,
                        "output": json.dumps({"status": "confirmation_required", "message": "Review the newly prepared checkout summary before confirming."}),
                    }
                continue
            if group:
                for output in await asyncio.gather(*(executeToolCall(call) for call in group)):
                    pendingResults[output["call_id"]] = output
        nextInput.extend(pendingResults[call.call_id] for call in functionCalls if call.call_id in pendingResults)

        # Next request contains:
        # original user query + current tool round
        inputItems = [
            *boundedHistory,
            userInput,
            *nextInput,
        ]

    if pendingQuoteForDisplay and accessToken:
        shoppingTools.storePendingQuote(accessToken, pendingQuoteForDisplay["addressId"], pendingQuoteForDisplay["result"], conversationId)
        quote = pendingQuoteForDisplay["result"].get("data", {})
        answer = _checkoutSummary(quote)
        actions = [_checkoutAction(quote)]
        return {"answer": answer, "actions": actions, "suggestions": _fallbackSuggestedReplies(actions)}

    return _interruptedFallback(searchCache, productActions, addedProductIds)
