toolDefinitions = [
    {
        "type": "function",
        "name": "searchProducts",
        "description": (
            "Search active products by name, SKU, category, and optionally "
            "maximum price. Use this for product discovery."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": ["string", "null"],
                    "description": "Product name or SKU to search for.",
                },
                "category": {
                    "type": ["string", "null"],
                    "description": "Product category to filter by.",
                },
                "maxPrice": {
                    "type": ["number", "null"],
                    "description": "Maximum acceptable product price.",
                },
            },
            "required": ["query", "category", "maxPrice"],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "getProductDetails",
        "description": "Get detailed information about a specific product.",
        "parameters": {
            "type": "object",
            "properties": {
                "productId": {
                    "type": "string",
                    "description": "The product ID.",
                },
            },
            "required": ["productId"],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "getProductAvailability",
        "description": (
            "Get the current available quantity of a product across "
            "active warehouses."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "productId": {
                    "type": "string",
                    "description": "The product ID.",
                },
            },
            "required": ["productId"],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "getProductPrice",
        "description": "Get the current price of a specific product.",
        "parameters": {
            "type": "object",
            "properties": {
                "productId": {
                    "type": "string",
                    "description": "The product ID.",
                },
            },
            "required": ["productId"],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "searchKnowledgeBase",
        "description": (
            "Search the knowledge base for general product information, "
            "specifications, features, policies, and other non-real-time information."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Question or information to search for.",
                },
            },
            "required": ["query"],
            "additionalProperties": False,
        },
    },
]