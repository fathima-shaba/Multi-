# MultiStore Phase 2

Backend and database foundation for the **Multipurpose E-Commerce Website**.

See the [Phase 3 authentication guide](AUTHENTICATION.md) for account endpoints, secure administrator initialization and the browser order transition.

## Architecture

```mermaid
flowchart LR
    Browser[React storefront] -->|Same-origin /api| Proxy[Vite dev or preview proxy]
    Proxy --> Express[Express 5 API]
    Express -->|Parameterized SQL via pg Pool| PG[(PostgreSQL)]
    Setup[Migration and catalog seed commands] --> PG
    Browser --> Demo[Phase 1 browser sessions, cart and orders]
```

In production, configure the web server or reverse proxy to send `/api/*` to Express over the private network and serve the Vite `dist/` output. Return `index.html` for browser navigation to known or unknown client-side routes, including receipt URLs. Keep PostgreSQL private and use an HTTPS origin. The preview proxy is for local verification.

## Setup on Windows

1. Install Node.js 24 LTS and PostgreSQL 18 for Windows. In the PostgreSQL installer, select **PostgreSQL Server** and **Command Line Tools**, keep port **5432** unless it is already in use, and save the installer account password privately. Use SQL Shell (psql) from the Start menu or add the PostgreSQL `bin` directory to PATH. [PostgreSQL Windows installer](https://www.postgresql.org/download/windows/)
2. Connect to the `postgres` maintenance database as the installer administrator, usually `postgres`. In psql, run the following. The password command prompts privately. Use a unique password for the development role.

   ```sql
   CREATE ROLE multistore_app LOGIN;
   \password multistore_app
   CREATE DATABASE multistore OWNER multistore_app;
   ```

3. From the repository root, install locked dependencies and create the ignored backend environment file.

   ```powershell
   npm.cmd ci
   Copy-Item server/.env.example server/.env
   ```

4. Edit `server/.env` privately. Set `DATABASE_URL` in the form `postgresql://multistore_app:PASSWORD@127.0.0.1:5432/multistore`. Replace the placeholder and percent-encode URL special characters in the password. Set `HOST`, `PORT` and comma-separated `FRONTEND_ORIGINS` as needed. Shell environment values take precedence. Never put the backend URL in a Vite client variable.
5. Run the migration and seed. Use a dedicated development database for the API tests, which expect the original fixture counts. On macOS or Linux use `npm` in place of `npm.cmd`.

   ```powershell
   npm.cmd run db:migrate
   npm.cmd run db:seed
   npm.cmd run test:api
   ```

6. Start two terminals from the project root.

   ```powershell
   # Terminal 1
   npm.cmd run api
   # Terminal 2
   npm.cmd run dev
   ```

   Visit the Vite URL, normally `http://localhost:5173`. Check API readiness at `http://127.0.0.1:3001/api/health`. If the API port differs, set `$env:API_PROXY_TARGET = 'http://127.0.0.1:YOUR_PORT'` in the frontend terminal before starting Vite. For direct cross-origin use, add the actual frontend origin to `FRONTEND_ORIGINS`.

   ```powershell
   npm.cmd run lint
   npm.cmd run build
   npm.cmd run preview
   ```

   The API must remain running to use the preview storefront. The temporary verification cluster is independent of these setup steps.

## Backend layout

```text
server/
  .env.example
  db/
    migrations/001_foundation.sql
    migrate.js
    seed.js
  src/
    app.js       Express middleware and health endpoint
    catalog.js   Catalog routes and query validation
    config.js    Server-only environment configuration
    db.js        PostgreSQL pool and transaction helper
    http.js      Request IDs, logging and error responses
    index.js     HTTP listener
  test/
    catalog.test.js
```

The migration runner locks concurrent setup, records SQL checksums and commits a migration run atomically. Applied SQL files are immutable. Add a new numbered migration for changes. The seed transaction inserts 19 categories and 475 products with their original text IDs, price, original price, stock, brand, image URL and display metadata. Reruns preserve records already present. No users, passwords, orders or payment fixtures are seeded. Existing remote image URLs are preserved and remain dependent on the asset provider.

## Database schema

| Table | Keys and purpose |
|---|---|
| `users` | UUID PK, normalized unique email, Argon2id hash column, role and active status |
| `sessions` | Token digest PK, user FK, expiry and revocation |
| `categories` | Text slug PK, unique name and display order |
| `products` | Original text ID PK, category FK, product content, integer paise prices, stock and display metadata |
| `product_images` | UUID PK, product FK, unique image position per product |
| `addresses` | UUID PK, owner FK and structured shipping fields |
| `cart_items` | Composite user/product PK, positive quantity |
| `wishlist_items` | Composite user/product PK |
| `orders` | UUID PK, buyer FK, unique order number, optional buyer-scoped idempotency key, fulfillment state, INR amounts and shipping snapshot |
| `order_items` | UUID PK, order and product FKs, product name and unit-price snapshots, quantity |
| `payments` | UUID PK, order FK, provider references, state and INR amount |
| `reviews` | UUID PK, author and product FKs, matching product/order-item FK, unique author and product, bounded rating/body |
| `inventory_transactions` | UUID PK, product FK, optional order and actor FKs, nonzero stock delta and unique operation key |
| `schema_migrations` | Filename PK, checksum and applied timestamp |

Money uses PostgreSQL integers in paise. The seed converts decimal fixture values using exact integer arithmetic. The API carries paise. The storefront adapts values for the existing INR UI and its paise-based checkout arithmetic. PostgreSQL enforces status, quantity, range, key and snapshot constraints. Later services enforce session, review ownership, fulfillment transitions and inventory/payment rules. Add provider checkout-attempt/reservation tables in later migrations when implementing payments.

```mermaid
erDiagram
    USERS ||--o{ SESSIONS : owns
    USERS ||--o{ ADDRESSES : saves
    USERS ||--o{ CART_ITEMS : owns
    USERS ||--o{ WISHLIST_ITEMS : owns
    CATEGORIES ||--o{ PRODUCTS : classifies
    PRODUCTS ||--o{ PRODUCT_IMAGES : has
    PRODUCTS ||--o{ CART_ITEMS : appears_in
    PRODUCTS ||--o{ WISHLIST_ITEMS : appears_in
    USERS ||--o{ ORDERS : places
    ORDERS ||--o{ ORDER_ITEMS : contains
    PRODUCTS ||--o{ ORDER_ITEMS : referenced_by
    ORDERS ||--o{ PAYMENTS : records
    USERS ||--o{ REVIEWS : writes
    PRODUCTS ||--o{ REVIEWS : receives
    ORDER_ITEMS ||--o{ REVIEWS : references
    PRODUCTS ||--o{ INVENTORY_TRANSACTIONS : tracks
    ORDERS o|--o{ INVENTORY_TRANSACTIONS : may_trigger
    USERS o|--o{ INVENTORY_TRANSACTIONS : may_record
```

## HTTP API

| Request | Successful response |
|---|---|
| `GET /api/health` | `200 {status:"ok", database:"ready"}` if PostgreSQL is reachable and the required catalog and authentication tables exist. Returns `503` otherwise. |
| `GET /api/products` | `200 {products, nextOffset}`. Optional `q` (120 chars), `category` (100 chars), `limit` (1–100, default 50) and `offset` (0–100000, default 0). Search is a case-insensitive literal substring over name, brand and description. Category accepts slug or exact display name ignoring case. |
| `GET /api/products/:id` | `200 {product}`. Example `/api/products/1`. An invalid ID returns `400`; absent or inactive products return `404`. A trailing slash without an ID is a listing request. |
| `GET /api/categories` | `200 {categories:[{id,name}, ...]}` in catalog order. |

Errors use `{error:{code,message,requestId}}`. Invalid parameter values return `400`; rejected CORS origins return `403`; unknown routes return `404`. Logs include method, route pattern, status, duration and request ID and omit request bodies, credentials and raw query values.

Home and Shop use product and category lists fetched from Express. The current 475-product frontend loads the base catalog for Home, the unfiltered Shop and existing demo admin tools. Keyword and category navigation fetch matching API pages using `q` and `category`. The existing price, brand, rating and discount controls refine the result. Individual product navigation uses the detail endpoint. Failed requests display an explicit retry state. Seed fixtures stay out of the browser bundle.

## Phase boundary

Product reads, administrator catalog writes, stock adjustments and customer commerce use PostgreSQL. See the [Phase 4 guide](CATALOG_MANAGEMENT.md) for catalog administration and the [Phase 5 guide](COMMERCE.md) for persistent carts, wishlists and orders. Payment collection and review-module changes remain future work.

## Phase 2 verification

| Check | Observed result |
|---|---|
| Native PostgreSQL startup and connectivity | Passed using disposable loopback PostgreSQL 18.3 clusters. No permanent Windows PostgreSQL service was configured. |
| Migration and repeat run | All 13 domain tables were created. The runner reported the schema was up to date on the second run. |
| Catalog seed and repeat run | Seeded 475 products, 19 categories and 475 image records. Rerun inserted zero products. The API suite compared every seeded product ID, name, description, price, category and primary URL to the original catalog. |
| Express and API tests | Six tests passed, covering all four endpoints, pagination, search, category filtering, headers, CORS, validation, 404s and simulated database failure. |
| Browser integration | Production preview displayed all 475 products, made server requests for search and category filtering, showed 25 items under Home & Furniture, and loaded product 1 from its detail endpoint. With the API offline, list and detail views showed errors and retry controls. |
| Phase 1 regression | The cart, browser-saved order, refreshed receipt and profile displayed ₹16,863. Multiple products, quantities, fees, cart clearing, order history and empty-cart navigation passed. Cart, checkout, receipt and history were checked at an emulated 390 px viewport. |
| Build and static checks | Production build passed. Lint finished with 12 warnings and no errors. The dependency audit reported zero known vulnerabilities after compatible tooling updates. |

Browser captures are in [phase2-screenshots](../phase2-screenshots/). The long-running development setup uses the database and credentials configured by the developer in the ignored `server/.env`.
