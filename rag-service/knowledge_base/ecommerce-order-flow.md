# E-commerce Order Flow

## 1. Overview

The e-commerce application allows users to purchase products that are
available in the inventory management system.

When a user places an order, the system checks inventory, allocates available
stock, identifies any shortage, and can trigger the configured reorder
process.

## 2. Order Creation Flow

The general order flow is:

1. User selects a product.
2. User specifies the required quantity.
3. The system identifies the selected product.
4. The system checks inventory.
5. Available inventory is allocated.
6. The system calculates any shortage.
7. The order status is determined.
8. If required, a reorder is triggered.
9. The order and allocation information are persisted.

## 3. Inventory Check

Inventory is maintained at the warehouse level.

A product can have inventory across multiple warehouses.

When an order is placed, the system considers available inventory and
determines how much of the requested quantity can be allocated.

The authoritative source for current inventory is PostgreSQL.

## 4. Full Allocation

If sufficient inventory is available to satisfy the requested quantity:

```text
Requested Quantity
        =
Allocated Quantity

Shortage Quantity = 0

The order can be recorded with : status = confirmed
```

## 5. Partial Allocation

If available inventory is insufficient:

Requested Quantity > Allocated Quantity

Shortage Quantity = Requested Quantity - Allocated Quantity

The order can be recorded with:

status = BACKORDERED

The system can then trigger an order-driven reorder for the shortage.

## 6. Order Information

Each order contains:

- Order ID
- User ID
- Product ID
- Requested quantity
- Allocated quantity
- Shortage quantity
- Unit price
- Total price
- Currency
- Order status
- Creation timestamp
- Update timestamp

The database is the authoritative source for the current state of an order.

## 7. Order Allocation

An order can have one or more allocation records.

Each allocation identifies:

- Order
- Inventory record
- Allocated quantity
- Allocation timestamp

This allows the system to associate allocated stock with a specific warehouse inventory record.

## 8. Backordered Orders

An order becomes relevant to the backorder flow when the requested quantity cannot be completely satisfied by available inventory.

For example:

Requested: 100  
Allocated: 70  
Shortage: 30

The order records the shortage and the system can initiate replenishment.

The actual status and quantities for a specific order must always be retrieved from PostgreSQL.

## 9. Order-Driven Reorder

When an order creates a shortage, the system can create a stock-reorder record associated with the relevant inventory.

The reorder records:

- Inventory ID
- Requested reorder quantity
- Reorder status
- Creation timestamp
- Update timestamp
- Related order, when applicable

## 10. Threshold-Based Reorder

Reordering can also occur independently of a customer order.

When the configured inventory threshold is breached, the system can automatically create a reorder.

Therefore, the system supports two primary reorder triggers:

1. Inventory threshold breach
2. Customer order shortage

## 11. Price Information

An order stores the price information applicable to that order:

- Unit price
- Total price
- Currency

Current product pricing should not be inferred from this document.

For a specific order, the order record in PostgreSQL is the authoritative source for its recorded price.

## 12. User-Specific Orders

Orders are associated with users through `userId`.

For authenticated users, the system can retrieve orders belonging to that user.

The assistant should enforce the application's authorization rules before exposing user-specific order information.

## 13. Example Order Scenarios

### Scenario A — Sufficient Inventory

Customer requests: 10 units  
Available inventory: 25 units

Allocated: 10  
Shortage: 0  
Status: CONFIRMED

### Scenario B — Insufficient Inventory

Customer requests: 10 units  
Available inventory: 6 units

Allocated: 6  
Shortage: 4  
Status: BACKORDERED

The shortage can trigger the configured order-driven reorder process.

## 14. RAG and PostgreSQL Responsibilities

The RAG knowledge base should explain:

- How the order flow works
- What confirmed means
- What backordered means
- How shortages are calculated
- How order-driven reorders work
- How allocations relate to warehouses

PostgreSQL should provide:

- Current order status
- Order quantities
- Current allocations
- Current shortages
- Current inventory
- Current reorder records
- User-specific order information

## 15. Grounding Rule

The assistant must not claim that an order, inventory allocation, or reorder exists without verifying it against PostgreSQL.
