# Commerce architecture assessment

## Current components and purchase path

- `frontend-service` is a Next.js 16 / React 19 TypeScript app. The customer storefront calls the authenticated inventory API using a signed, one-day customer token. Current cart state in `src/lib/cart.ts` is browser local storage. Product selection can add to cart; cart checkout currently submits each line separately through the legacy order API.
- `inventory-service` is Express 5 / TypeScript with Prisma 7 and PostgreSQL. It owns users, products (UUID `id`, unique `sku`, category, active state), warehouses, inventory (`availableQty`, `reservedQty`), allocations, stock reorders, and orders. Customer auth verifies an HMAC token. The order endpoint retrieves current price over HTTP, then in one inventory database transaction creates a single-product order, moves available quantity to reserved quantity, and creates allocation rows. Insufficient stock creates a `BACKORDERED` order and reorder request.
- `pricing-service` is Express / TypeScript with Prisma and PostgreSQL. It owns `ProductPrice` (`Decimal(10,2)`, currency) and history, with per-product and batch read endpoints. Its database is separate from inventory's; price reads and inventory writes cannot share a database transaction.
- `rag-service` is a separate Python assistant, not part of transactional checkout.
- No payment, tax, carrier, shipment, saved-address, or cart persistence models/providers were found. Existing order schema is one order row per product, and existing order status is only `CONFIRMED` / `BACKORDERED`.

## Dependencies and implementation sequence

1. Preserve legacy order rows and endpoint behavior; extend schema additively with cart/cart items, saved addresses, order line snapshots, order shipping snapshot/totals, idempotency key, payment state, and shipments. Keep the existing order's product/quantity columns as compatibility projections for legacy rows and first line.
2. Implement server-side catalog queries using product filters plus aggregate inventory, stable sort by requested field then product ID, and pagination. This only depends on existing product/inventory ownership.
3. Implement persistent authenticated cart APIs and frontend synchronization. Cart stores product ID and quantity only; names, availability, prices, and totals are derived at read/quote time.
4. Implement an authoritative checkout quote using pricing-service batch reads and a configured shipping/tax provider contract. Since no valid tax/shipping rules or provider credentials are present, calculation must fail closed until configured; never infer zero tax/shipping.
5. Implement one order header with multiple item snapshots and transactional inventory reservation. Perform remote authoritative price reads before the inventory transaction, revalidate stock with conditional database updates inside the transaction, and use a customer-scoped unique idempotency key. Cart is cleared in the same successful transaction as order creation.
6. Add saved-address ownership, order-specific address snapshots, and order detail authorization.
7. Add payment and shipment adapter contracts, event deduplication, and lifecycle fields. A real payment/carrier integration requires merchant/provider configuration that is absent; do not claim real collection or tracking. Fail closed for production initiation and only allow an explicit non-production mock if configured.
8. Integrate quote, address, multi-line checkout, order history/detail, and paged catalog in the storefront while preserving current search, category/stock filter, sorting, cart controls, and auth behavior.
9. Add isolated unit/API tests and document migrations, rollback, environment variables, and externally required setup.

## Key risks and compatibility decisions

- Pricing is a separate database/service. A price can change between HTTP lookup and inventory commit; use a short quote lifetime and refresh/compare the quote during checkout. There is no cross-database transaction.
- Inventory service currently treats backorders as orderable, but a commerce payment flow must not charge for unavailable products without an explicit business rule. New cart checkout should reject insufficient stock atomically and preserve cart contents; legacy single-item API keeps its documented backorder behavior during migration.
- Existing checkout code, storefront changes, and product catalog changes are already uncommitted in the workspace. They are user work and must be retained.
- `Order.totalPrice` is a `Decimal`, but its existing API serialization converts it to a JS number. New calculations should use integer minor units / decimal strings internally and at persistence boundaries.
- Existing frontend requests product prices one by one; the pricing batch endpoint already exists and can eliminate that N+1 path.
- No tax/shipping rates, supported destinations, payment merchant account, carrier account, or test database configuration is present. These are operational prerequisites for production checkout, not values to invent in code.
