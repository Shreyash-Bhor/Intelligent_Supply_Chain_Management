# Inventory and Reorder Policy

## 1. Purpose

This document describes the inventory management and automatic reorder
behavior implemented in the e-commerce and supply-chain system.

The system manages inventory across multiple warehouses and supports
automatic replenishment when configured reorder conditions are met.

## 2. Inventory Structure

Each inventory record represents the inventory of a specific product at a
specific warehouse.

An inventory record contains:

- Product ID
- Warehouse ID
- Available quantity
- Reserved quantity
- Reorder quantity
- Reorder-pending status

A product can have inventory records across multiple warehouses.

## 3. Available Quantity

`availableQty` represents the quantity currently available for allocation
from an inventory record.

`reservedQty` represents quantity that has already been reserved and should
not be treated as freely available inventory.

For current inventory information, the PostgreSQL database is the
authoritative source.

## 4. Reorder Quantity

`reorderQty` represents the quantity configured for replenishment when the
corresponding reorder condition is triggered.

The exact current value must be retrieved from the inventory record in
PostgreSQL.

## 5. Threshold-Based Reorder

The system supports automatic reordering when the configured inventory
threshold is breached.

The general flow is:

1. Monitor inventory.
2. Compare the inventory level against the configured threshold.
3. Detect a threshold breach.
4. Trigger an automatic reorder.
5. Create a stock-reorder record.
6. Track the reorder using its status.

The exact threshold values are application configuration and should not be
assumed by the RAG system.

## 6. Order-Driven Reorder

The system also supports automatic replenishment when a customer places an
order that cannot be completely fulfilled from available inventory.

The general flow is:

1. Customer requests a product quantity.
2. The system checks available inventory.
3. Inventory across relevant warehouses is considered.
4. Available stock is allocated where possible.
5. If requested quantity exceeds available inventory, the shortage is
   calculated.
6. A reorder can be created for the required shortage.
7. The order records the allocated and shortage quantities.

For example:

If a customer requests 100 units and only 70 units are available, the
system can allocate 70 units and identify a shortage of 30 units.

The actual order and inventory values must always be retrieved from
PostgreSQL.

## 7. Order Status

Orders can have the following statuses:

### CONFIRMED

The requested quantity has been completely allocated.

### BACKORDERED

The requested quantity could not be completely allocated from available
inventory.

A backordered order records:

- Requested quantity
- Allocated quantity
- Shortage quantity

## 8. Stock Reorder Status

A stock reorder can have one of the following statuses:

- `PENDING`
- `COMPLETED`
- `CANCELLED`

The current status must be retrieved from PostgreSQL.

## 9. Reorder and Order Relationship

A stock reorder can optionally be associated with an order.

This relationship allows the system to identify reorders that were created as
part of fulfilling a customer order.

Not every reorder necessarily needs to be associated with an order because
threshold-based replenishment can occur independently of a specific customer
order.

## 10. Warehouse-Level Inventory

Inventory is maintained independently for each warehouse.

Therefore, when answering questions about product availability, the assistant
should consider warehouse-level inventory rather than assuming that a product
has a single global inventory value.

Warehouse information includes:

- Warehouse name
- City
- Pincode
- Active status

## 11. Reorder-Pending Indicator

Each inventory record contains an `isReorderPending` field.

This indicates whether a reorder is currently pending for that inventory
record.

For authoritative current status, the assistant should query PostgreSQL.

## 12. Example Scenario

A customer requests 50 units of a product.

The system checks inventory across the relevant warehouses.

Suppose 35 units can be allocated.

The system records:

- Requested quantity: 50
- Allocated quantity: 35
- Shortage quantity: 15

The shortage can trigger an order-driven reorder so that the system can
replenish the required quantity.

## 13. Source of Truth

The following information must always be retrieved from PostgreSQL:

- Current available quantity
- Current reserved quantity
- Current reorder quantity
- Current reorder-pending status
- Current warehouse inventory
- Current order status
- Current shortage
- Current allocated quantity
- Current stock-reorder status

This document explains system behavior but does not represent live inventory
state.

## 14. RAG Usage

The RAG system should use this document to explain concepts and system
behavior.

For example:

> "Why was a reorder created for this order?"

The assistant should:

1. Query PostgreSQL for the order.
2. Query PostgreSQL for related inventory and reorder records.
3. Retrieve this document to understand the reorder behavior.
4. Combine the live data with the documented system logic.
5. Provide a grounded explanation.

## 15. Important Limitations

The assistant must not invent:

- Threshold values
- Reorder quantities
- Warehouse stock
- Reorder completion times
- Supplier information
- Delivery dates
- Purchase order information

These values should only be provided when available from an authoritative
system source.
