# MultiStore Phase 4 — catalog and inventory management

The checkout boundary below describes Phase 4. See the [Phase 5 commerce guide](COMMERCE.md) for current cart and checkout behavior.

## Setup and screens

Apply `npm run db:migrate` before starting the API. On a fresh development database, also run `npm run db:seed`. On Windows PowerShell use `npm.cmd`. See the [database setup](README.md#setup-on-windows) and [administrator bootstrap](AUTHENTICATION.md#initialize-the-administrator).

- `/admin/products` supports search, category and status filters, 25-row pages, product creation/editing and a confirmation before archiving. The selling price is the current storefront price. An optional higher regular price displays the discount. Prices are entered in INR and submitted in integer paise. Add up to six image URLs in display order. The first is the primary image.
- `/admin/categories` manages names, descriptions, availability and removal. Counts show total and active product records. Category IDs remain stable when names change. Deactivating a category hides its products and navigation entry. Removing a category archives its row and requires archiving or reassigning its active products first.
- `/admin/inventory` shows stock, latest movements, low stock from one through five units, and products out of stock at zero. Enter a signed change and a reason. Positive changes add stock, and negative changes remove it. History can be scoped to a product and returns up to 100 recent records.

The React catalog refreshes after admin changes and on browser focus. The storefront preserves the original product identifiers, images and data. Product cards and the detail gallery use current stock, and the cart rechecks prices and availability. An unavailable line remains visible so the buyer can remove it. Checkout rechecks the current quote before saving the account-scoped browser receipt and asks for review if prices changed.

## Database and service changes

| Table | Phase 4 behavior |
|---|---|
| `categories` | Migration `003_catalog_management.sql` adds `description`, `active` and `archived_at` plus a case-insensitive unique name index. Existing IDs and rows stay in place. |
| `products` | Existing PostgreSQL integer-paise and stock constraints are reused. Archiving sets `active=false`, preserving foreign keys from order items, reviews and inventory history. |
| `product_images` | Ordered URLs are written in the same transaction as product creation or editing. The application renders the URLs without fetching them on the server. |
| `inventory_transactions` | Initial stock and changes write a delta, reason, administrator ID and timestamp with a unique operation key. Existing seeded stock is the opening balance and has no fabricated movement history. |

The shared `changeStock` service locks the product row, validates the resulting integer quantity and updates stock and its movement in the same database transaction. It accepts an optional order ID and operation key for future server-side checkout integration. The demo checkout reads PostgreSQL availability and saves a local receipt. It does not write inventory.

## API

All routes below start with `/api/admin`. The existing Phase 3 middleware verifies the session and administrator role. Writes require the existing origin and CSRF request header. Queries bind user-provided values as parameters.

| Method and path | Result |
|---|---|
| `GET /products` | Filter by `q`, category ID, `status` and `offset`. Returns `{products,nextOffset}`, 25 products per page. Status values are `all`, `available` (published category and product), `unavailable`, `low` and `out`. |
| `POST /products` | Create a product, its ordered images and an opening movement if stock is positive. Returns `201 {product}`. |
| `PATCH /products/:id` | Update supplied fields and return `{product}`. Sending `stock` requires `stockReason`. Set `active=true` to republish a product assigned to a category that has not been removed. |
| `DELETE /products/:id` | Archive and return `204`. Existing order references remain valid. |
| `GET /categories` | List categories that have not been removed, descriptions, availability and counts. |
| `POST /categories` | Create a category with `name`, optional `description` and `active`. Returns `201 {category}`. |
| `PATCH /categories/:id` | Change the name, description or availability. The category ID remains stable. |
| `DELETE /categories/:id` | Archive and return `204`. Returns `409` if active products still reference it. |
| `GET /inventory` | Same filters/pagination as products, with `summary.low` and `summary.outOfStock` for active products. |
| `POST /inventory/adjustments` | Accepts `{productId,delta,reason}` and returns `{stock}`. Rejects zero, fractional or out-of-range changes. |
| `GET /inventory/transactions` | Return the latest movements, optionally filtered by `productId`. |

Product writes accept `name`, `description`, `brand`, `categoryId`, `pricePaise`, `originalPricePaise`, `images`, `active` and optional `stock`. The optional regular price must be at least the selling price. Images accept HTTP(S) URLs without embedded credentials. The API does not accept file uploads in this phase. Public product endpoints retain their existing contracts and add the ordered `images` array. Public categories include descriptions.

## Phase boundary

Stock and catalog changes are durable. Browser carts and demo receipts remain local. Browser stock checks show current availability and help buyers correct the cart. Phase 5 is responsible for atomic order placement, final stock allocation and payment integration. Existing third-party image URLs remain subject to availability at their host.

## Verification

- Native PostgreSQL applied all three migrations. A repeat migration made no changes, and a repeat seed inserted no duplicate products. The baseline test compared all 475 seeded product IDs, names, descriptions, prices, categories and primary image URLs.
- All 13 API tests passed. They covered admin access and CSRF, invalid prices and stock, product/category changes, public visibility, concurrent stock writes, inventory audit records, preservation of an order item reference on archive, and the existing account and catalog endpoints.
- Chromium verified administrator product and category management, inventory adjustments and history, persistence after refresh, storefront prices and images, customer stock controls, and access denial for guests and customers. Product, category and inventory management and the product detail page fit an emulated 390 px viewport without horizontal page overflow.
- The production-build browser checks passed for catalog pagination, search, the ₹16,863 single-product checkout, and the ₹686 multiple-product checkout with quantity changes and refreshed receipts. Both flows left PostgreSQL stock unchanged. The Vite build passed. Lint reported 11 warnings and no errors.
- Screenshots are in [phase4-screenshots](../phase4-screenshots/). Testing used a disposable PostgreSQL database and local Chromium. Physical mobile devices and deployed infrastructure were outside this test.
