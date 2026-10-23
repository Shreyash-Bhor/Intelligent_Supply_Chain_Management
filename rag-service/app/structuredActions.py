import re
import math
from typing import Any

ALLOWED_FORM_ACTIONS = {"show_checkout_form", "show_address_form", "show_product_filters"}
ALLOWED_FIELD_TYPES = {"text", "number", "email", "tel", "textarea", "select", "radio", "checkbox", "date"}
FIELD_ID = re.compile(r"^[a-z][a-z0-9_]{0,39}$")


def validateFormAction(value: Any) -> dict[str, Any]:
    """Validate a limited, data-only form definition before it reaches a client."""
    if not isinstance(value, dict) or value.get("type") != "structured_form":
        raise ValueError("Unsupported interactive action.")
    action = value.get("action")
    title = value.get("title")
    fields = value.get("fields")
    if action not in ALLOWED_FORM_ACTIONS:
        raise ValueError("Unsupported form action.")
    if not isinstance(title, str) or not title.strip() or len(title) > 100:
        raise ValueError("Form title is invalid.")
    if not isinstance(fields, list) or not fields or len(fields) > 12:
        raise ValueError("Form fields are invalid.")
    clean_fields = []
    seen = set()
    for field in fields:
        if not isinstance(field, dict):
            raise ValueError("Form field is invalid.")
        field_id, label, input_type = field.get("id"), field.get("label"), field.get("type")
        if not isinstance(field_id, str) or not FIELD_ID.fullmatch(field_id) or field_id in seen:
            raise ValueError("Form field identifier is invalid.")
        if not isinstance(label, str) or not label.strip() or len(label) > 100 or input_type not in ALLOWED_FIELD_TYPES:
            raise ValueError("Form field definition is invalid.")
        filter_types = {"query": "text", "category": "select", "min_price": "number", "max_price": "number", "in_stock": "checkbox", "sort": "select"}
        if action == "show_product_filters" and filter_types.get(field_id) != input_type:
            raise ValueError("Product filter field is not supported.")
        seen.add(field_id)
        required = field.get("required", False)
        if not isinstance(required, bool):
            raise ValueError("Form field required flag is invalid.")
        clean = {"id": field_id, "label": label.strip(), "type": input_type, "required": required}
        if field.get("defaultValue") is not None:
            default = field["defaultValue"]
            if not isinstance(default, (str, int, float, bool)) or len(str(default)) > 500 or (isinstance(default, float) and not math.isfinite(default)):
                raise ValueError("Form default value is invalid.")
            if (input_type == "checkbox" and not isinstance(default, bool)) or (input_type == "number" and (isinstance(default, bool) or not isinstance(default, (int, float)))) or (input_type not in {"checkbox", "number"} and not isinstance(default, str)):
                raise ValueError("Form default value does not match its input type.")
            clean["defaultValue"] = default
        if input_type in {"select", "radio"}:
            options = field.get("options")
            if not isinstance(options, list) or not options or len(options) > 30:
                raise ValueError("Form options are invalid.")
            clean_options = []
            for option in options:
                if not isinstance(option, dict) or not isinstance(option.get("label"), str) or not option["label"].strip() or len(option["label"]) > 100 or not isinstance(option.get("value"), str) or len(option["value"]) > 100:
                    raise ValueError("Form option is invalid.")
                clean_options.append({"label": option["label"].strip(), "value": option["value"]})
            if len({item["value"] for item in clean_options}) != len(clean_options):
                raise ValueError("Form options must have unique values.")
            clean["options"] = clean_options
        for constraint in ("min", "max", "maxLength"):
            if field.get(constraint) is not None:
                bound = field[constraint]
                if constraint == "maxLength":
                    if input_type not in {"text", "email", "tel", "textarea"} or isinstance(bound, bool) or not isinstance(bound, int) or not 1 <= bound <= 2000:
                        raise ValueError("Form validation constraint is invalid.")
                elif isinstance(bound, bool) or not isinstance(bound, (int, float)) or (isinstance(bound, float) and not math.isfinite(bound)):
                    raise ValueError("Form validation constraint is invalid.")
                elif input_type != "number":
                    raise ValueError("Numeric form constraints require a number field.")
                clean[constraint] = bound
        if clean.get("min") is not None and clean.get("max") is not None and clean["min"] > clean["max"]:
            raise ValueError("Form minimum cannot exceed its maximum.")
        clean_fields.append(clean)
    return {"type": "structured_form", "action": action, "title": title.strip(), "fields": clean_fields}


def productAction(product: dict[str, Any]) -> dict[str, Any]:
    """Expose only customer-facing product fields returned by application APIs."""
    price = product.get("price")
    currency = product.get("currency")
    attributes = product.get("attributes")
    safe_attributes = {}
    if isinstance(attributes, dict):
        safe_attributes = {str(key)[:60]: value for key, value in list(attributes.items())[:20] if isinstance(value, (str, int, float, bool)) and len(str(value)) <= 300}
    return {
        "type": "product_detail",
        "productId": product.get("id"),
        "name": product.get("name"),
        "sku": product.get("sku"),
        "category": product.get("category"),
        "imageUrl": product.get("imageUrl"),
        "price": str(price) if isinstance(price, (str, int, float)) and not isinstance(price, bool) else None,
        "currency": currency if isinstance(currency, str) else None,
        "availableQty": product.get("availableQty"),
        "description": product.get("description") if isinstance(product.get("description"), str) else None,
        "discount": product.get("discount") if isinstance(product.get("discount"), str) else None,
        "attributes": safe_attributes,
    }


def productComparisonAction(products: list[dict[str, Any]]) -> dict[str, Any]:
    if len(products) < 2:
        raise ValueError("A comparison requires at least two verified products.")
    return {"type": "product_comparison", "products": [productAction(item) for item in products[:4]]}
