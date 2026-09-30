# Electronics — Product Knowledge

## Overview

The Electronics category contains electronic products available through the
e-commerce and inventory management system.

Examples of products currently present in this category include:

- Graphics Tablet
- Noise Cancelling Headphones
- Smartphone

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

The knowledge base does not define technical specifications unless those
specifications are explicitly available in the product data.

## Availability

A product being part of the Electronics category does not guarantee that it
is currently available.

For current availability, the system should query inventory data.

Inventory information includes:

- Available quantity
- Reserved quantity
- Reorder quantity
- Reorder-pending status
- Warehouse associated with the inventory

## Ordering

When a customer orders an electronic product, the system checks available
inventory across the relevant warehouses.

If sufficient inventory is available, the required quantity can be allocated.

If available inventory is insufficient, the shortage is identified and the
system can trigger the configured reorder process.

## Important Limitation

This document provides category-level knowledge only.

Do not infer or fabricate:

- Price
- Technical specifications
- Warranty
- Compatibility
- Battery capacity
- Dimensions
- Shipping time
- Return or refund conditions

These values must come from authoritative application data or explicitly
provided documentation.

## Example Questions

The RAG system may use this document for questions such as:

- What type of products belong to the Electronics category?
- How is availability determined for an electronic product?
- What happens when there is insufficient inventory for an electronic product?
- Where should current stock information be retrieved from?

For product-specific availability, pricing, warehouse stock, or order status,
the system should query PostgreSQL rather than relying on this document.
