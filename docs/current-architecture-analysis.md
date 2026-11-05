# Current System Architecture and Route Analysis

This document describes the code that is currently present in the repository, including its actual runtime routes and service calls. It supersedes aspirational architecture statements in the root README where those statements are not implemented (for example, there is no event broker, forecasting service, or routing optimization service in the checked-in applications).

## Service map

| Service | Runtime | Owns / does | Calls |
| --- | --- | --- | --- |
| `frontend-service` | Next.js | Browser UI, browser-facing API helpers, server-side RAG chat proxy | Inventory, pricing, RAG |
| `inventory-service` | Express + Prisma | Customers/auth, products, inventory, warehouses, reorders, cart, addresses, checkout/orders, dashboard, assistant persistence and rate limits | Pricing service; Redis is optional |
| `pricing-service` | Express + Prisma | Current product prices and price history | PostgreSQL; optional cache |
| `rag-service` | FastAPI | Chat orchestration, conversation memory, retrieval/tools, assistant response | Inventory and pricing services; LLM/embedding provider and vector store |

The inventory and pricing services each own their Prisma/PostgreSQL data. RAG reaches their HTTP APIs using the configured `INVENTORY_SERVICE_URL` and `PRICING_SERVICE_URL`; the RAG code does not connect directly to their databases. The frontend calls inventory and pricing directly for most pages. Chat goes through the Next.js `/api/rag/chat` proxy, which validates the customer token against inventory before forwarding it to RAG.

## Route/controller organization

Routes and controllers have been grouped by the service/domain that uses them. The route paths and HTTP methods are unchanged.

- Inventory general routes: `inventory-service/src/routes/general/`; their handlers are under `inventory-service/src/controllers/general/` (auth, assistant session/rate-limit persistence, cart, addresses, orders/checkout, dashboard).
- Inventory management routes: `inventory-service/src/routes/inventory/`; handlers are under `inventory-service/src/controllers/inventory/` (products, inventory, reorders, warehouses).
- Pricing routes/controllers: `pricing-service/src/routes/pricing/` and `pricing-service/src/controllers/pricing/`.
- RAG chat route: `rag-service/app/routes/rag/router.py`, included at `/api` by `rag-service/app/main.py`.
- The Next.js chat proxy is already grouped by RAG at `frontend-service/src/app/api/rag/chat/route.ts`; its location defines the browser URL and therefore remains there.

## Inventory service routes (port 5000 by default)

The mount points and outer access middleware are registered in `inventory-service/src/index.ts`. “Customer” means the route is mounted behind `requireCustomerAccess`; “manager” means it is behind `requireWarehouseManagerAccess`. Product/inventory admin mutations do not receive either of those mount-level guards in the current route table; see findings below.

| Method and URL | Handler / result | Callers and downstream use |
| --- | --- | --- |
| `GET /health` | Runs `SELECT 1`; reports DB connected or 500/disconnected. | Deployment/operator health probe. |
| `POST /api/auth/register` | Validates registration, hashes password, creates user and returns a customer token. | Frontend registration helper. |
| `POST /api/auth/login` | Validates credentials and returns customer token/profile; invalid credentials return 401. | Frontend login helper. |
| `GET /api/auth/me` | Validates token and returns customer profile. | Frontend session checks; Next.js chat proxy validates the token here before calling RAG. |
| `GET /api/assistant/conversations/:conversationId` (customer) | Returns saved, non-expired conversation messages or an empty list. | RAG `getHistory` calls this with the customer token. |
| `POST /api/assistant/conversations/:conversationId/turns` (customer) | Sanitizes private text and stores the latest 12 messages with a 30-day expiry. | RAG `saveTurn` calls this after generating its response. |
| `POST /api/assistant/rate-limit` | Counts requests in a per-minute DB bucket (30/min); accepts customer token or signed guest service identity. Returns rate-limit headers / 429. | RAG invokes this from its distributed rate limiter. |
| `GET /api/cart` (customer) | Loads cart, product metadata, active-warehouse stock and current prices. | Frontend cart; RAG shopping tools. |
| `PUT /api/cart/items` (customer) | Validates active product and available stock, then upserts requested quantity. | Frontend cart; RAG add/set-cart tools. |
| `DELETE /api/cart/items/:productId` (customer) | Removes one line; returns refreshed cart. | Frontend cart; RAG remove-item tool. |
| `DELETE /api/cart` (customer) | Clears cart lines. | Frontend cart; RAG clear-cart tool. |
| `GET /api/addresses` (customer) | Lists customer addresses, default first. | Frontend checkout/account; RAG shopping tools. |
| `POST /api/addresses` (customer) | Creates a validated address; optional idempotency key. | Frontend address form; RAG address tool. |
| `PUT /api/addresses/:addressId` (customer) | Updates an owned address. | Frontend address form; RAG address tool. |
| `PUT /api/addresses/:addressId/default` (customer) | Sets the owned address as default. | Frontend address form. |
| `DELETE /api/addresses/:addressId` (customer) | Deletes an owned address and handles default reassignment. | Frontend address form; RAG address tool. |
| `POST /api/orders/quote` (customer) | Builds a signed, short-lived quote from cart, prices, stock and address; includes totals. | Frontend checkout; RAG checkout quote tool. |
| `POST /api/orders/confirmation` (customer) | Requires explicit confirmation and an unchanged quote; issues a short-lived confirmation proof. | Frontend checkout. |
| `POST /api/orders/checkout` (customer) | Requires quote, confirmation proof and idempotency key; serializable transaction creates order, reserves stock, creates allocations and empties cart. No payment is collected. | Frontend checkout; RAG checkout tool. |
| `POST /api/orders/:orderId/cancel` (customer) | Cancels eligible unpaid order, releases allocations transactionally, invalidates related caches. | Frontend order history. |
| `GET /api/orders/:orderId` (customer) | Returns one order belonging to the customer. | Frontend order detail; RAG order lookup. |
| `GET /api/orders` (customer) | Paginated order history (page size max 50). | Frontend order history; RAG order lookup. |
| `POST /api/orders` (customer) | Always returns 403 directing clients to confirmed cart checkout. | No known active frontend or RAG caller. The former direct-order body after this return is unreachable. |
| `POST /api/product` | Creates product. | Frontend manager product form. No manager guard is attached in the route file/mount. |
| `GET /api/product/products` | Lists products with `status` filter (`active` default, `inactive`, or `all`). | Frontend product administration. |
| `GET /api/product/catalog` | Aggregates active, in-stock product data across active warehouses. | Frontend product/catalog helper. |
| `GET /api/product/user-catalog` (customer) | Paged catalog with query/category/stock/sort; price sorting calls pricing service. | Frontend shop; RAG search/recommendation tool. |
| `GET /api/product/assistant/category` (customer) | Returns up to three active products for a category with stock and price. | RAG category/product recommendation tool. |
| `GET /api/product/search` | Searches up to three active products by name/SKU/category. | RAG product lookup; frontend product search helper. |
| `GET /api/product/user-dashboard` (customer) | Lists active products with active-warehouse stock totals. | Frontend dashboard/catalog helper. |
| `GET /api/product/:productId` | Returns one product. | RAG product detail and frontend product detail. |
| `DELETE /api/product/:productId` | Deletes product. | Frontend product administration. No manager guard attached at route mount. |
| `PATCH /api/product/:productId` | Updates product fields. | Frontend product administration. No manager guard attached at route mount. |
| `PATCH /api/product/:productId/status` | Changes product active status. | Frontend product administration. No manager guard attached at route mount. |
| `GET /api/inventory/product/:productId` | Public-to-customer assistant availability projection; totals available quantity across active warehouses for active product. | Frontend stock check; RAG product tools and shopping tools. This route is declared before manager middleware. |
| `POST /api/inventory` (manager) | Creates product/warehouse inventory pair; rejects duplicate pair. | Frontend inventory administration. |
| `GET /api/inventory` (manager) | Paged inventory list, optional warehouse/product/stock filters; short-lived cached. | Frontend inventory administration. |
| `GET /api/inventory/:inventoryId` (manager) | Returns one inventory record. | Inventory manager UI; RAG inventory tool uses this endpoint with its service token, but manager middleware means that path requires a manager token. |
| `PATCH /api/inventory/:inventoryId` (manager) | Updates inventory fields and invalidates inventory/catalog/dashboard/warehouse caches. | Frontend inventory administration. |
| `POST /api/inventory/:inventoryId/reorder` (manager) | Creates a stock reorder for the selected inventory. | Frontend inventory workflow. |
| `GET /api/reorder` (manager) | Lists pending reorders by default; `mode=history` lists completed/cancelled. | Frontend reorder dashboard. |
| `PATCH /api/reorder/:reorderId/status` (manager) | Changes reorder status. | Frontend reorder dashboard. |
| `POST /warehouse` | Creates warehouse. | Frontend warehouse administration. No manager guard attached at route mount. |
| `GET /warehouse/warehouses` | Lists warehouses with `status` filter; cached. | Frontend warehouse administration. |
| `GET /warehouse/:warehouseId` | Returns warehouse with its inventories/products; cached. | Frontend warehouse detail. |
| `PATCH /warehouse/:warehouseId` | Updates warehouse; invalidates relevant caches. | Frontend warehouse administration. No manager guard attached at route mount. |
| `PATCH /warehouse/:warehouseId/status` | Changes warehouse active state. | Frontend warehouse administration. No manager guard attached at route mount. |
| `GET /dashboard/summary` (manager) | Cached operational summary: stock health, units, reorders, warehouses, risk items. | Frontend manager dashboard. |
| `GET /dashboard/access` (manager) | Confirms manager session and returns email/time. | Frontend manager session check. |

## Pricing service routes (port 5555 by default)

| Method and URL | Handler / result | Callers and downstream use |
| --- | --- | --- |
| `GET /health` | Runs DB `SELECT 1`; reports connection state. | Deployment/operator probe. |
| `POST /api/prices` | Creates a product price and `CREATED` price-history row transactionally; duplicate returns 409. | Frontend pricing administration. |
| `GET /api/prices?productIds=id1,id2` | Batch current-price lookup; requires at least one product ID; returns price/currency rows. | Inventory cart/catalog service; RAG product search and pricing tools; frontend batch pricing helper. |
| `PATCH /api/prices/:productId` | Updates current price and records `UPDATED` history; missing price is not found. | Frontend pricing administration. |
| `GET /api/prices/:productId` | Returns current price. | Inventory pricing client; RAG product/detail tools; frontend product pricing. |
| `GET /api/prices/:productId/history` | Returns validated, paginated historical price changes. | Frontend price-history view. |

Pricing routes currently have no route-level authentication middleware. Inventory calls this service over HTTP with a 5-second timeout; cart and checkout flows therefore depend on pricing availability. Product/catalog behavior that can operate without a price generally marks missing prices unavailable or returns null, while quote creation needs prices to calculate checkout.

## RAG and frontend chat routes

| Method and URL | Handler / result | Callers and downstream use |
| --- | --- | --- |
| `POST /api/rag/chat` (Next.js) | Requires Bearer token, validates it through inventory `/api/auth/me`, enforces 16 KB body limit and 4,000-character query, forwards to RAG with 60-second timeout, preserves rate-limit headers, maps transport failures to 503. | Browser chatbot (`RagChatbot`). |
| `POST /api/chat` (FastAPI) | Validates query/conversation ID and optional Bearer header, applies distributed rate limit, loads/compacts conversation history, runs agent and persists the turn. Returns answer, actions, suggestions. | Called only by the Next.js proxy in the checked-in frontend. |

RAG tools then call inventory for product search/detail, category listings, availability, cart, address, checkout, and orders; pricing for batch/current prices; and inventory assistant endpoints for request throttling and persisted conversation turns. Retrieval uses the configured knowledge base/vector store and configured LLM/embedding provider. Inventory-only tools also exist, but their manager-protected target currently conflicts with the service-token use shown by the RAG tool code.

## Cross-service request flows

1. **Product browsing:** browser → inventory product/catalog endpoint → optional pricing HTTP call for price sort or enriched results → pricing database. RAG search follows the same inventory/pricing path through tools.
2. **Cart and checkout:** browser or RAG → inventory cart/quote endpoints → inventory database plus pricing `/api/prices` → signed quote → explicit proof → serializable inventory reservation and order creation. Payment is not integrated/collected in this path.
3. **Chat:** browser → Next.js proxy → inventory token validation → RAG chat → RAG rate-limit and conversation endpoints on inventory, plus inventory/pricing tools → answer forwarded to browser.
4. **Manager operations:** frontend → inventory product, inventory, warehouse, reorder and dashboard endpoints. Dashboard and reorder routes have manager middleware; product mutations and warehouse mutations currently do not show the same protection.

## Findings and recommendations

### Duplicate, stale, or unnecessary paths

- **Confirmed dead path — `POST /api/orders`:** the controller immediately returns 403, leaving the former implementation unreachable. Remove the route/controller body or return an explicit deprecation response without the dead implementation.
- **Confirmed unmounted handler — `updateInventoryStatus`:** implemented in the inventory controller but no route references it. Remove it if no planned client needs it, or add/document a dedicated status route.
- **Catalog overlap — `/api/product/catalog`, `/api/product/user-dashboard`, `/api/product/user-catalog`:** all project active products plus stock and are surfaced by frontend helpers; they differ in paging and fields, so they are not exact duplicates, but ownership/contracts should be consolidated or explicitly documented. Keep the small assistant category endpoint separate because it intentionally caps results at three.
- **Product list/search overlap — `/api/product/products` and `/api/product/search`:** the former is an unpaged administration list and the latter caps active search to three. Their consumers differ, but the unpaged all-products response can grow without bound.
- **Assistant availability duplication:** `/api/inventory/product/:productId` and inventory data embedded in catalog/product endpoints compute similar stock totals; keep the compact availability route as a stable assistant contract and avoid repeating this aggregation in additional APIs.

### Optimization and correctness opportunities

- **Pricing sort scans all matching products:** `user-catalog` loads all matching IDs, fetches prices in serial batches of 100, and sorts in application memory. This grows with the catalog and makes multiple sequential network requests. Consider a batch lookup in parallel or a read model/join owned by an API boundary that supports indexed ordering.
- **Stock sort also reads/sorts all matching IDs in memory.** Push sorting/aggregation to a database query or maintain a sortable aggregate when catalog volume justifies it.
- **Unpaged endpoints:** `GET /api/product/products`, `GET /warehouse/warehouses`, and several RAG inventory helper calls can return full tables. Add pagination/limits where the data can grow.
- **Missing manager guards:** product create/update/delete/status and warehouse create/update/status are reached without `requireWarehouseManagerAccess` in the route definitions, unlike inventory/reorder/dashboard routes. Protect these mutations and confirm whether the associated reads are intended to be public.
- **Unregistered RAG inventory helpers:** `rag-service/app/tools/inventoryTools.py` defines calls to manager-protected `/api/inventory` endpoints but the active agent does not register them. Keep them explicitly dormant or add a scoped manager/service authorization design before exposing them.
- **Assistant data cleanup is request-driven:** conversation/rate-limit cleanup deletes expired rows during request handling. Under load this repeats database cleanup work. Use expiry indexes and periodic cleanup, or bounded cleanup batches.
- **Pricing is a synchronous dependency:** inventory cart and quote operations synchronously call pricing; the 5-second timeout can dominate user latency or fail checkout. Define fallback/availability behavior and monitor dependency latency. Current-price cache use mitigates repeated reads but not cold misses.
- **Health checks cover only PostgreSQL:** inventory health reports DB state but not pricing/RAG/cache dependency status. This is acceptable for liveness; add a separate readiness/dependency check if deployments need it.
- **No checked-in API gateway/event bus:** services are called directly by the frontend or by HTTP client code. README descriptions of Kafka/RabbitMQ, Nginx gateway, forecasting, and route optimization are design aspirations rather than implemented components.

## Route loading after reorganization

`inventory-service/src/index.ts` mounts all the same route modules as before, now imported from the `general` or `inventory` folders. `pricing-service/src/index.ts` mounts the route module from `routes/pricing`. `rag-service/app/main.py` includes the router from `app.routes.rag.router` at `/api`. No endpoint URL was changed as part of this folder reorganization.
