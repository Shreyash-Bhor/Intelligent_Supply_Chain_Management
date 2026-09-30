# Product FAQ

## 1. What product categories are available?

The e-commerce system currently supports the following product categories:

- Electronics
- Grocery
- Beverages
- Fashion
- Fitness
- Stationery
- Sports
- Toys

The complete list of products and their current category assignments is
maintained in the PostgreSQL database.

## 2. How can I check whether a product exists?

A product can be identified using its:

- Product name
- SKU
- Product ID

The PostgreSQL database is the authoritative source for product existence.

## 3. How can I check whether a product is active?

Each product has an `isActive` field.

An active product can be considered available for normal application
operations, subject to its current inventory.

An inactive product should not be treated as normally available for purchase.

The current value must be retrieved from PostgreSQL.

## 4. How can I check the current price of a product?

The current product price should be retrieved from the application's pricing
data or the order record.

The RAG knowledge base does not contain authoritative current prices because
prices can change.

For an existing order, `unitPrice` and `totalPrice` stored with the order
represent the prices recorded for that order.

## 5. How can I check product availability?

Product availability is determined from inventory data.

Inventory records contain:

- `availableQty`
- `reservedQty`
- `reorderQty`
- `isReorderPending`
- `warehouseId`

The system should query PostgreSQL to determine current availability.

## 6. Can a product be available in multiple warehouses?

Yes.

An inventory record is associated with both a product and a warehouse.
Therefore, the same product can have inventory records across multiple
warehouses.

The complete warehouse-level availability should be retrieved from
PostgreSQL.

## 7. What happens when a customer orders more than the available inventory?

The system compares the requested quantity with available inventory.

If sufficient inventory is available, the required quantity can be allocated.

If the available quantity is insufficient, the system records the shortage
and can trigger the configured reorder process.

## 8. What is a backordered order?

An order has a `BACKORDERED` status when the requested quantity cannot be fully
allocated from the available inventory.

The order also records:

- Requested quantity
- Allocated quantity
- Shortage quantity

These values should be retrieved from PostgreSQL for a specific order.

## 9. What is an inventory reorder?

An inventory reorder is a replenishment request created when the configured
reorder condition is triggered.

The system records reorder information including:

- Inventory record
- Requested quantity
- Reorder status
- Creation timestamp
- Related order, when applicable

## 10. When is an automatic reorder triggered?

The system supports two reorder scenarios.

### Threshold-based reorder

When the configured inventory threshold is breached, an automatic reorder is
triggered.

### Order-driven reorder

When a customer requests a quantity greater than the available inventory
across the relevant warehouses, the system identifies the shortage and
creates a reorder to support fulfillment of the order.

## 11. How can I determine whether a reorder is pending?

Inventory records contain an `isReorderPending` field.

Stock reorder records also contain a `status` field.

The current state should be retrieved from PostgreSQL rather than inferred
from this document.

## 12. How is warehouse information determined?

Each warehouse has:

- Warehouse ID
- Name
- City
- Pincode
- Active status

Warehouse information should be retrieved from PostgreSQL.

## 13. Can the assistant tell me the exact stock of a product?

Yes, but the assistant must query PostgreSQL for the current inventory.

The RAG knowledge base should not be used for real-time stock quantities.

## 14. Can the assistant tell me the status of my order?

Yes.

For an authenticated user, the system can query orders associated with that
user and retrieve:

- Order status
- Quantity
- Allocated quantity
- Shortage quantity
- Unit price
- Total price
- Order timestamps

## 15. Can the assistant answer questions about product categories?

Yes.

Category-level information can be retrieved from the RAG knowledge base,
while the actual product-to-category relationship should be verified against
PostgreSQL.

## 16. What information should the assistant not invent?

The assistant should not fabricate information about:

- Product specifications
- Warranty
- Shipping times
- Return policies
- Refund policies
- Cancellation policies
- Ingredients
- Nutritional information
- Safety certifications
- Product dimensions
- Any other attribute not present in an authoritative data source

When information is unavailable, the assistant should state that it is not
available.

## 17. Which source should be used for which type of question?

### Use PostgreSQL for:

- Current product availability
- Current inventory
- Warehouse stock
- Product status
- Current price
- Order status
- Order history
- Allocated quantity
- Shortage quantity
- Reorder status

### Use the RAG knowledge base for:

- Category-level product knowledge
- Inventory/reorder concepts
- E-commerce system behavior
- General product-related explanations

### Use both when necessary:

For questions requiring both conceptual knowledge and live system data, the
assistant should retrieve information from both sources and combine the
results.

For example:

> "Why is this product currently unavailable?"

The assistant can retrieve the current inventory from PostgreSQL and use the
inventory/reorder documentation to explain the system's behavior.
