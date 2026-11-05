# Commerce implementation and deployment notes

The architecture and purchase-flow analysis is in [commerce-architecture-assessment.md](commerce-architecture-assessment.md).

## Implemented paths

- Authenticated customer carts are persisted in the inventory PostgreSQL database. Items hold product IDs and quantities; cart reads resolve current product state, availability, and price. One cart per customer is enforced by a unique user ID.
- Saved customer addresses are owner-scoped and can be listed, created, updated, and deleted. Country is optional and is not requested by checkout. Checkout stores an order-specific address snapshot.
- A short-lived signed quote uses current prices from the pricing service, checks stock, and computes the item subtotal and order total in integer minor units. Shipping and tax are explicitly uncalculated and stored as NULL; no payment is collected.
- Multi-item checkout creates one order header and multiple order lines, reserves all requested stock with conditional inventory updates in a serializable transaction, and clears cart lines in that transaction. Insufficient stock or a transaction conflict rolls back and preserves the cart.
- Checkout requires a customer-provided `Idempotency-Key`; a unique constraint makes repeated submissions return the existing order.
- Product catalog filters, search, sort, and pagination are server-side. The API sorts by name, newest, stock, or authoritative price and returns a count and page metadata.
- Customer order detail and history are owner-scoped and include line snapshots, payment state, address snapshots, and any recorded shipments.
- A pending unpaid order or a confirmed, not-yet-paid order can be cancelled once in a serializable transaction; its reserved quantities return to available stock. Paid orders are not marked refunded or cancelled by this endpoint.

## Address defect and correction

The address API's create handler returned HTTP 503 whenever `CHECKOUT_SUPPORTED_COUNTRIES` was unset and rejected countries not present in that list. The checked-in inventory environment has no checkout market variables, so the address form could never persist its first address even though the database migration and authenticated address route were present. Address creation now persists validated addresses without requiring country or market configuration. Updates use an owner-scoped `PUT /api/addresses/:addressId` and return 404 for foreign or unknown IDs.

## API additions

All customer routes require `Authorization: Bearer <customer token>`.

| Method and path | Purpose |
| --- | --- |
| `GET /api/cart` | Retrieve the active customer cart with current product, price, and availability details |
| `PUT /api/cart/items` | Set a product quantity (`productId`, `quantity`) |
| `DELETE /api/cart/items/:productId` | Remove one item |
| `DELETE /api/cart` | Clear the cart |
| `GET /api/addresses` | List saved addresses for the customer |
| `POST /api/addresses` | Save a validated address |
| `PUT /api/addresses/:addressId` | Update a validated owned address |
| `DELETE /api/addresses/:addressId` | Delete an owned address |
| `POST /api/orders/quote` | Quote current item totals for an owned `addressId` |
| `POST /api/orders/checkout` | Create one multi-item order from `addressId` and `quoteToken`; requires `Idempotency-Key` |
| `GET /api/orders/:orderId` | Retrieve an owned order with items and recorded shipments |
| `POST /api/orders/:orderId/cancel` | Cancel an eligible pending unpaid order and release reserved inventory |
| `GET /api/product/user-catalog` | Paged customer catalog (`page`, `pageSize`, `query`, `category`, `inStock`, `sort`) |

The legacy `POST /api/orders` single-product endpoint remains available for API compatibility and retains its existing backorder behavior. The storefront now adds products to cart and uses the multi-item checkout endpoint.

## Required configuration

The payment-free checkout currently needs:

- `PRICING_SERVICE_URL`: pricing-service base URL (existing setting).
- `AUTH_TOKEN_SECRET`: existing signing secret, used to sign short-lived checkout quotes.

Checkout records the authoritative item subtotal as the order total, marks payment `NOT_STARTED`, and reserves stock. It does not calculate shipping or tax and does not capture payment. Those features require approved business rules and are outside this payment-free checkout flow. Shipment records are read-only to customers; no carrier integration or shipment creation/update endpoint is configured.

## Migration and rollback

Apply the additive migration in a disposable test database first, then deploy through the existing Prisma process:

```powershell
cd inventory-service
pnpm exec prisma migrate deploy
```

The migrations preserve existing order rows and columns, backfill legacy order subtotal from `totalPrice`, add commerce tables/fields, and make address country plus uncalculated shipping/tax nullable. For rollback, stop checkout traffic and restore the pre-migration database backup; do not reverse with destructive `DROP` statements against customer data. Apply a forward corrective migration if a rollback is needed after new orders exist.

The workspace did not identify an isolated test database, so the migration was not applied to the configured database. The inventory `.env` has a configured database URL, but its environment is not identified as disposable; no database writes, migration status checks, or end-to-end requests were made against it. Do not run migrations against a production database as a verification step.

## Verification status

- Frontend TypeScript check, ESLint, and production build: passed in this run (the first sandboxed build hit `EPERM` while spawning TypeScript; the approved rerun passed).
- Inventory TypeScript check: passed.
- Prisma schema validation: passed; the configured database was not contacted or modified.
- Money calculation unit tests: 3 passed in this run.
- Database migration, API integration, concurrency, and browser end-to-end tests: not run because no isolated test database was identified. No migration or checkout request was sent to the configured database.

## Checkout limits

This flow is for order placement and inventory reservation only. It does not collect payment, calculate shipping or tax, or request a destination country. The confirmation makes those limits explicit. Add approved shipping/tax rules and a payment provider before treating the order total as a payable amount.
