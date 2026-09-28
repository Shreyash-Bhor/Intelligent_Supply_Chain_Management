# Beverages — Product Knowledge

## Overview

The Beverages category contains beverage products available through the
e-commerce and inventory management system.

Examples of products currently present in this category include:

- Malted Drink
- Energy Shot
- Cold Brew Coffee

Product availability, active status, inventory quantity, warehouse location,
and order-related information are maintained separately in the system database.

## Product Information

The following information should be retrieved from the product database:

- Product name
- SKU
- Product category
- Active/inactive status
- Current inventory
- Warehouse availability

This document provides category-level knowledge only. It does not define
product-specific ingredients, nutritional information, serving instructions,
or other product specifications.

## Availability

Being part of the Beverages category does not guarantee that a product is
currently available.

Current availability must be determined using inventory data stored in
PostgreSQL.

Inventory information includes:

- Available quantity
- Reserved quantity
- Reorder quantity
- Reorder-pending status
- Warehouse associated with the inventory

## Ordering

When a customer orders a beverage product, the system checks available
inventory.

If sufficient inventory exists, the required quantity can be allocated.

If available inventory is insufficient, the system identifies the shortage
and the configured reorder process can be triggered.

## Important Limitation

Do not infer or fabricate product-specific information such as:

- Ingredients
- Nutritional values
- Caffeine content
- Allergens
- Expiry dates
- Storage requirements
- Serving instructions
- Price
- Delivery time
- Return or refund conditions

Such information must come from authoritative application data or explicitly
provided product documentation.

## Example Questions

The RAG system may use this document for questions such as:

- What type of products belong to the Beverages category?
- How is beverage product availability determined?
- What happens when there is insufficient inventory for a beverage product?
- Where should current beverage stock information be retrieved from?

For product-specific availability, pricing, warehouse stock, or order status,
the system should query PostgreSQL rather than relying on this document.
