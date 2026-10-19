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
                "page": {"type": "integer", "minimum": 1},
                "pageSize": {"type": "integer", "minimum": 1, "maximum": 50},
                "inStock": {"type": "boolean"},
            },
            "required": ["query", "category", "maxPrice", "page", "pageSize", "inStock"],
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
    {"type":"function","name":"getCart","description":"Retrieve the signed-in customer's cart.","parameters":{"type":"object","properties":{},"required":[],"additionalProperties":False}},
    {"type":"function","name":"addToCart","description":"Add this quantity to the product's existing cart quantity. This never places an order.","parameters":{"type":"object","properties":{"productId":{"type":"string"},"quantity":{"type":"integer","minimum":1,"maximum":100000}},"required":["productId","quantity"],"additionalProperties":False}},
    {"type":"function","name":"setCartQuantity","description":"Set a product's total quantity in the cart to this value. This never places an order.","parameters":{"type":"object","properties":{"productId":{"type":"string"},"quantity":{"type":"integer","minimum":1,"maximum":100000}},"required":["productId","quantity"],"additionalProperties":False}},
    {"type":"function","name":"removeFromCart","description":"Remove a product from the customer's cart.","parameters":{"type":"object","properties":{"productId":{"type":"string"}},"required":["productId"],"additionalProperties":False}},
    {"type":"function","name":"clearCart","description":"Clear the cart only when the customer explicitly asks.","parameters":{"type":"object","properties":{},"required":[],"additionalProperties":False}},
    {"type":"function","name":"listAddresses","description":"List the authenticated customer's saved shipping addresses.","parameters":{"type":"object","properties":{},"required":[],"additionalProperties":False}},
    {"type":"function","name":"createAddress","description":"Create an address using complete details provided by the customer. Use null when address2 or country is not provided.","parameters":{"type":"object","properties":{"address":{"type":"object","properties":{"name":{"type":"string"},"phone":{"type":"string"},"address1":{"type":"string"},"address2":{"type":["string","null"]},"city":{"type":"string"},"region":{"type":"string"},"postalCode":{"type":"string"},"country":{"type":["string","null"]}},"required":["name","phone","address1","address2","city","region","postalCode","country"],"additionalProperties":False}},"required":["address"],"additionalProperties":False}},
    {"type":"function","name":"updateAddress","description":"Update one of the authenticated customer's saved addresses. Use null when address2 or country is not provided.","parameters":{"type":"object","properties":{"addressId":{"type":"string"},"address":{"type":"object","properties":{"name":{"type":"string"},"phone":{"type":"string"},"address1":{"type":"string"},"address2":{"type":["string","null"]},"city":{"type":"string"},"region":{"type":"string"},"postalCode":{"type":"string"},"country":{"type":["string","null"]}},"required":["name","phone","address1","address2","city","region","postalCode","country"],"additionalProperties":False}},"required":["addressId","address"],"additionalProperties":False}},
    {"type":"function","name":"deleteAddress","description":"Delete one of the authenticated customer's saved addresses.","parameters":{"type":"object","properties":{"addressId":{"type":"string"}},"required":["addressId"],"additionalProperties":False}},
    {"type":"function","name":"prepareCheckout","description":"Get an authoritative checkout quote for the cart and selected saved address. This does not place an order.","parameters":{"type":"object","properties":{"addressId":{"type":"string"}},"required":["addressId"],"additionalProperties":False}},
    {"type":"function","name":"placeConfirmedOrder","description":"Place the exact checkout already summarized only after the customer explicitly confirms it in their latest message.","parameters":{"type":"object","properties":{},"required":[],"additionalProperties":False}},
    {"type":"function","name":"orderHistory","description":"List the authenticated customer's orders.","parameters":{"type":"object","properties":{},"required":[],"additionalProperties":False}},
    {"type":"function","name":"orderDetails","description":"Retrieve one of the authenticated customer's orders.","parameters":{"type":"object","properties":{"orderId":{"type":"string"}},"required":["orderId"],"additionalProperties":False}},
]
