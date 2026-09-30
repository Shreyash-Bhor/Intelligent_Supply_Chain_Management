# Toys — Product Knowledge

## Overview

The Toys category contains toys and recreational products available through the
e-commerce and inventory management system.

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
product-specific age recommendations, materials, dimensions, safety
information, or usage instructions unless they are explicitly available in
authoritative product documentation.

## Availability

Being part of the Toys category does not guarantee that a product is
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

When a customer orders a toy product, the system checks available inventory.

If sufficient inventory exists, the required quantity can be allocated.

If available inventory is insufficient, the system identifies the shortage
and the configured reorder process can be triggered.

## Important Limitation

Do not infer or fabricate product-specific information such as:

- Recommended age
- Materials
- Dimensions
- Safety certifications
- Usage instructions
- Price
- Delivery time
- Warranty
- Return or refund conditions

Such information must come from authoritative application data or explicitly
provided product documentation.

## Example Questions

The RAG system may use this document for questions such as:

- What type of products belong to the Toys category?
- How is toy product availability determined?
- What happens when there is insufficient inventory for a toy product?
- Where should current toy stock information be retrieved from?

For product-specific availability, pricing, warehouse stock, or order status,
the system should query PostgreSQL rather than relying on this document.
