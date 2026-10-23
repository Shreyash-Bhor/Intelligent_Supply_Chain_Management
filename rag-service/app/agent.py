import json
from typing import Any

from app.llm.factory import getLLM
from app.tools.productTools import (
    searchProducts,
    getProductDetails,
    getProductAvailability,
    getProductPrice,
)
from app.tools.toolDefinitions import toolDefinitions
from app.rag import answer as searchKnowledgeBase
from app.tools import shoppingTools
from app.structuredActions import productAction, productComparisonAction, validateFormAction
from app.agentLimits import iterationLimit

AGENT_INSTRUCTIONS = """
You are an e-commerce assistant for a supply-chain system.

Use the available tools according to these rules:

1. searchProducts
   Use for product discovery, including:
   - product name
   - SKU
   - category
   - maximum price

2. getProductDetails
   Use for requests to show or describe one specific product. This tool also
   retrieves current price and availability for the structured product card.
   It accepts an authoritative product ID or an exact SKU.
   Do not call getProductPrice or getProductAvailability for that same product
   in the same turn. It can also answer questions about:
   - product attributes
   - specifications
   - category
   - SKU
   - clarification about a product

3. getProductAvailability
   Use when the user asks whether a product is available or asks about
   current stock.

4. getProductPrice
   Use for a narrow current-price question when a product detail card is not needed.

5. searchKnowledgeBase
   Use for general product knowledge, specifications, features,
   policies, and other information that is not real-time.

6. requestAddressForm
   Use when an authenticated customer wants to add or enter a delivery address.
   The frontend form saves only after the customer explicitly submits it.

7. requestStructuredForm
   Request a supported inline form only when structured input advances the task.
   Use only the allowlisted action names and provide simple user-facing fields.

Important rules:
- Never invent product, price, or availability information.
- Use backend tools for real-time data.
- Use the knowledge base for static information.
- You may use multiple tools when necessary.
- Shopping mutations require an authenticated customer. Never ask for, infer, or pass a customer identifier.
- Address tools expose only a backend address handle, default status, city, and region. Prefer the marked default unless the customer specifies otherwise; never repeat customer address details in ordinary responses.
- Cart actions never place an order. For checkout, retrieve a quote and show its exact products, quantities, address, and payable total before asking for confirmation.
- Call placeConfirmedOrder only when the current user message is an explicit affirmative response to the displayed quote. A general intention to buy is not confirmation.
- If the user changes cart contents, quantity, address, or other checkout details, prepare and display a fresh quote before requesting confirmation again.
- Never call placeConfirmedOrder for a manager or unauthenticated user.
- If a tool requires a productId and the user has not provided one,
  first use searchProducts to identify the product.
- For an ambiguous product name, show search results and ask which one the customer means.
- For comparisons, retrieve each product independently and return only verified results.
- Use requestStructuredForm for product filters when an inline form is useful. Use requestAddressForm for saved-address management and prepareCheckout for the actual quote flow. Never replace the existing quote and confirmation flow with a generated form.
- When comparing products, retrieve the required information for each
  product before answering.
- Treat knowledge-base tool output as source material: synthesize only the relevant facts, paraphrase them, and never paste raw passages or large retrieved tables into the response.
- Format the final answer as clean Markdown: answer directly first, then use short paragraphs, bullets for related facts, numbered steps for processes, and a Markdown table only when a comparison is clearer in a table. Preserve relevant values and caveats, and use **bold** sparingly for key labels.
- Keep responses concise and user-friendly; do not add unsupported recommendations or repeat the same fact.
""".strip()

toolMap = {
    "requestAddressForm": lambda: {"status": "success", "message": "Show the supported delivery address form."},
    "requestStructuredForm": lambda **_kwargs: {"status": "success"},
    "searchProducts": searchProducts,
    "getProductDetails": getProductDetails,
    "getProductAvailability": getProductAvailability,
    "getProductPrice": getProductPrice,
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


async def runAgent(
    query: str,
    accessToken: str | None = None,
    history: list[dict[str, str]] | None = None,
    conversationId: str | None = None,
) -> dict[str, Any]:
    if not query or not query.strip():
        raise ValueError("Query must not be empty.")

    if accessToken and shoppingTools.isExplicitOrderConfirmation(query):
        try:
            result = await shoppingTools.confirmAndSubmit(accessToken, conversationId)
            order = result.get("data", {})
            return {"answer": f"Order placed successfully. Order ID: {order.get('id', 'confirmed by backend')}. Status: {order.get('status', 'confirmed by backend')}. Total: {order.get('totalPrice', 'see order details')} {order.get('currency', '')}.", "actions": []}
        except PermissionError:
            # Without an active quote, a bare affirmative must not create an order.
            pass

    llm = getLLM()

    userInput = {
        "role": "user",
        "content": query.strip(),
    }

    inputItems = [*(history or []), userInput]
    pendingQuoteForDisplay: dict[str, Any] | None = None
    productActions: list[dict[str, Any]] = []
    formActions: list[dict[str, Any]] = []
    addressFormRequested = False

    for _ in range(iterationLimit(query)):
        response = await llm.client.responses.create(
            model=llm.model,
            instructions=AGENT_INSTRUCTIONS,
            input=inputItems,
            tools=toolDefinitions,
        )

        functionCalls = [
            item
            for item in response.output
            if item.type == "function_call"
        ]

        if not functionCalls:
            finalAnswer = response.output_text

            if not finalAnswer:
                raise RuntimeError(
                    "Agent returned an empty response."
                )

            if pendingQuoteForDisplay and accessToken:
                shoppingTools.storePendingQuote(accessToken, pendingQuoteForDisplay["addressId"], pendingQuoteForDisplay["result"], conversationId)
                quote = pendingQuoteForDisplay["result"].get("data", {})
                return {"answer": _checkoutSummary(quote), "actions": [_checkoutAction(quote)]}
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
            return {"answer": finalAnswer.strip(), "actions": actions[:4]}

        # Keep only the current model output + its tool results.
        nextInput = list(response.output)

        for call in functionCalls:
            tool = toolMap.get(call.name)

            if tool is None:
                raise ValueError(
                    f"Unknown tool requested: {call.name}"
                )

            arguments = json.loads(call.arguments)
            resultForModel: Any = None

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
                    else:
                        result = await tool(accessToken=accessToken, **arguments)
                        if call.name == "prepareCheckout" and accessToken and result.get("status") == "success":
                            pendingQuoteForDisplay = {"addressId": arguments["addressId"], "result": result}
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

            nextInput.append({
                "type": "function_call_output",
                "call_id": call.call_id,
                "output": json.dumps(resultForModel if resultForModel is not None else result),
            })

        # Next request contains:
        # original user query + current tool round
        inputItems = [
            *(history or []),
            userInput,
            *nextInput,
        ]

    raise RuntimeError(
        "Agent exceeded the maximum number of tool iterations."
    )
