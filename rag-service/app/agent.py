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
- If a tool requires a productId and the user has not provided one,
  first use searchProducts to identify the product.
- When comparing products, retrieve the required information for each
  product before answering.
- Keep responses concise and user-friendly.
""".strip()

toolMap = {
    "searchProducts": searchProducts,
    "getProductDetails": getProductDetails,
    "getProductAvailability": getProductAvailability,
    "getProductPrice": getProductPrice,
    "searchKnowledgeBase": searchKnowledgeBase,
}


async def runAgent(
    query: str,
    accessToken: str | None = None,
) -> str:
    if not query or not query.strip():
        raise ValueError("Query must not be empty.")

    llm = getLLM()

    inputItems = [
        {
            "role": "user",
            "content": query.strip(),
        }
    ]

    response = await llm.client.responses.create(
        model=llm.model,
        instructions=AGENT_INSTRUCTIONS,
        input=inputItems,
        tools=toolDefinitions,
    )

    for _ in range(settings.maxAgentIterations):
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

            return finalAnswer.strip()

        # Preserve the model's tool-call output.
        inputItems.extend(response.output)

        for call in functionCalls:
            tool = toolMap.get(call.name)

            if tool is None:
                raise ValueError(
                    f"Unknown tool requested: {call.name}"
                )

            arguments = json.loads(call.arguments)

            if call.name == "searchKnowledgeBase":
                result = await tool(**arguments)
            else:
                result = await tool(
                    accessToken=accessToken,
                    **arguments,
                )

            inputItems.append({
                "type": "function_call_output",
                "call_id": call.call_id,
                "output": json.dumps(result),
            })

        # Groq Responses API is stateless, so the complete
        # conversation/tool state is sent again.
        response = await llm.client.responses.create(
            model=llm.model,
            instructions=AGENT_INSTRUCTIONS,
            input=inputItems,
            tools=toolDefinitions,
        )

    raise RuntimeError(
        "Agent exceeded the maximum number of tool iterations."
    )