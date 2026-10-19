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
from app.config import settings
from app.tools import shoppingTools

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
   Use for product-specific information such as:
   - product attributes
   - specifications
   - category
   - SKU
   - clarification about a product

3. getProductAvailability
   Use when the user asks whether a product is available or asks about
   current stock.

4. getProductPrice
   Use when the user asks for the current price of a specific product.

5. searchKnowledgeBase
   Use for general product knowledge, specifications, features,
   policies, and other information that is not real-time.

Important rules:
- Never invent product, price, or availability information.
- Use backend tools for real-time data.
- Use the knowledge base for static information.
- You may use multiple tools when necessary.
- Shopping mutations require an authenticated customer. Never ask for, infer, or pass a customer identifier.
- Cart actions never place an order. For checkout, retrieve a quote and show its exact products, quantities, address, and payable total before asking for confirmation.
- Call placeConfirmedOrder only when the current user message is an explicit affirmative response to the displayed quote. A general intention to buy is not confirmation.
- If the user changes cart contents, quantity, address, or other checkout details, prepare and display a fresh quote before requesting confirmation again.
- Never call placeConfirmedOrder for a manager or unauthenticated user.
- If a tool requires a productId and the user has not provided one,
  first use searchProducts to identify the product.
- When comparing products, retrieve the required information for each
  product before answering.
- Treat knowledge-base tool output as source material: synthesize only the relevant facts, paraphrase them, and never paste raw passages or large retrieved tables into the response.
- Format the final answer as clean Markdown: answer directly first, then use short paragraphs, bullets for related facts, numbered steps for processes, and a Markdown table only when a comparison is clearer in a table. Preserve relevant values and caveats, and use **bold** sparingly for key labels.
- Keep responses concise and user-friendly; do not add unsupported recommendations or repeat the same fact.
""".strip()

toolMap = {
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


async def runAgent(
    query: str,
    accessToken: str | None = None,
    history: list[dict[str, str]] | None = None,
    conversationId: str | None = None,
) -> str:
    if not query or not query.strip():
        raise ValueError("Query must not be empty.")

    if accessToken and shoppingTools.isExplicitOrderConfirmation(query):
        try:
            result = await shoppingTools.confirmAndSubmit(accessToken, conversationId)
            order = result.get("data", {})
            return f"Order placed successfully. Order ID: {order.get('id', 'confirmed by backend')}. Status: {order.get('status', 'confirmed by backend')}. Total: {order.get('totalPrice', 'see order details')} {order.get('currency', '')}."
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

    for _ in range(settings.maxAgentIterations):
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
                return _checkoutSummary(pendingQuoteForDisplay["result"].get("data", {}))
            return finalAnswer.strip()

        # Keep only the current model output + its tool results.
        nextInput = list(response.output)

        for call in functionCalls:
            tool = toolMap.get(call.name)

            if tool is None:
                raise ValueError(
                    f"Unknown tool requested: {call.name}"
                )

            arguments = json.loads(call.arguments)

            try:
                if call.name == "searchKnowledgeBase":
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
            except (PermissionError, ValueError) as error:
                result = {"status": "error", "message": str(error)}
            except Exception:
                # Backend responses can contain infrastructure details; keep them out of model context.
                result = {"status": "error", "message": "That request could not be completed. Check the details and try again."}

            nextInput.append({
                "type": "function_call_output",
                "call_id": call.call_id,
                "output": json.dumps(result),
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
