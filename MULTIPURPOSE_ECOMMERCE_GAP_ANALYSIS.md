# Multipurpose E-Commerce Website

## Official requirements gap analysis and architecture proposal

**Application brand:** MultiStore  
**Source baseline:** local checkout at `a763e9c`, reviewed on 25 November 2026  
**Prior evidence:** [MULTISTORE_PROJECT_ANALYSIS.md](./MULTISTORE_PROJECT_ANALYSIS.md), especially its browser verification addendum.

The existing React frontend can be retained. It already demonstrates catalog browsing, basic cart operations, a simulated order, order history for the current mock identity, and an administrator shell. The official requirements add account security, durable shared records, verified payments, stock guarantees and additional customer and admin workflows. Approve a Node.js/Express API, PostgreSQL and Razorpay Standard Checkout in Test Mode before implementation. Start by fixing the amount displayed on confirmation and standardizing INR.

I rechecked the tracked application source, styles, configuration, route definitions and prior audit evidence. The tracked source has no changes since the earlier audit. The earlier headless browser run exercised one customer checkout and the guest admin redirect. This review did not repeat browser tests. It assigns source-backed statuses where source establishes behavior. Real-device layouts, administration write workflows and hosted behavior were outside the previous browser run. Seller attribution can stay in the product design. Seller onboarding is outside the official submission scope.

## 1. Requirements comparison

**Fully implemented** means that the named behavior exists within its narrowly defined scope and no blocking defect was identified. **Partially implemented** means only part of the requirement is delivered. **Missing** means there is no working implementation. **Implemented but defective** means the main path exists and has a concrete defect. **Not verified** means the available evidence cannot establish the requirement's acceptance criteria. **Critical** covers security, payment integrity or inventory consistency. **High** covers core scope or material demo failures. **Medium** covers usability and supporting features. **Low** covers cosmetic cleanup.

Paths in the comparison tables are relative to `src/` unless otherwise indicated. Where a file is proposed its name is preceded by **new**.

### User management

| Module | Required feature | Current implementation | Completion status | Relevant source files | Required modifications | Priority |
|---|---|---|---|---|---|---|
| User | Registration | Form creates a local customer object. Password is discarded and duplicate emails are allowed. Prior browser test confirmed the local session. | Partially implemented | `pages/Register.jsx`, `context/AuthContext.jsx` | Validate and normalize email, hash password, enforce a unique account and create a server session. | Critical |
| User | Login | Nonempty credentials create a mock customer with a new timestamp ID. A hardcoded comparison grants admin. | Implemented but defective | `pages/Login.jsx`, `context/AuthContext.jsx` | Verify credentials against a stored hash. Return a stable account ID, generic errors and a server-managed session. Remove the embedded credential. | Critical |
| User | Logout | Clears browser identity and goes home. | Partially implemented | `context/AuthContext.jsx`, `components/Navbar.jsx` | Revoke the server session, clear private view state and reset the active cart view to the guest cart. | High |
| User | Profile management | Displays name, email and role. There are no profile edit controls. | Partially implemented | `pages/Profile.jsx` | Add editable profile fields and validated updates. Require reauthentication and an ownership check for sensitive changes. | High |
| User | Password changes | No change form or password record. | Missing | `context/AuthContext.jsx`, `pages/Profile.jsx` | Verify the current password, hash the replacement, revoke other sessions and present clear feedback. | High |
| User | Authentication | User object is read from localStorage. There is no trusted session issuer or verifier. | Missing | `context/AuthContext.jsx`, root `package.json` | Add database-backed sessions, secure cookies and identity middleware. | Critical |
| User | Authorization | Role checks exist in the UI. Browser state is the authority. | Partially implemented | `context/AuthContext.jsx`, `pages/admin/Dashboard.jsx` | Enforce admin roles and resource ownership on the API. | Critical |
| User | Customer and administrator roles | The UI branches on `user` and `admin`. Public registration creates a mock customer. | Partially implemented | `context/AuthContext.jsx`, `components/Navbar.jsx` | Store and constrain roles in PostgreSQL. Provision admins through a setup command and ignore client-supplied roles. | Critical |
| User | Protected routes | Profile and checkout redirect guests to login. The admin layout redirects guests and non-admins home. Guest admin redirection was browser-verified. | Partially implemented | `App.jsx`, `pages/{Profile,Checkout}.jsx`, `pages/admin/Dashboard.jsx` | Restore the session before route decisions, preserve safe return URLs and put equivalent rules on sensitive APIs. | High |

### Product management

| Module | Required feature | Current implementation | Completion status | Relevant source files | Required modifications | Priority |
|---|---|---|---|---|---|---|
| Product | Product listing | Seed-backed grid and empty state. Prior browser run displayed 25 Electronics cards. | Fully implemented | `pages/Shop.jsx`, `components/ProductCard.jsx`, `data/mockData.js` | Preserve the grid and replace seed reads with a paginated API during integration. | Medium |
| Product | Product details | Dynamic route, ID lookup, missing-item recovery and similar items. Several actions on the page are placeholders. | Fully implemented | `App.jsx`, `pages/ProductDetails.jsx` | Keep the details layout. Load the API record and resolve the separate action gaps below. | Medium |
| Product | Multiple product categories | Nineteen seeded category strings organize the catalog. | Fully implemented | `data/mockData.js`, `pages/{Shop,Home}.jsx`, `components/Navbar.jsx` | Migrate to category rows with stable IDs and URL slugs. | Medium |
| Product | Keyword search | The navbar text field has no search handler or query wiring. | Missing | `components/Navbar.jsx`, `pages/Shop.jsx` | Submit a URL query and implement case-insensitive name, brand and description matching with pagination. | High |
| Product | Category filters | Shop matches a URL category. Sidebar changes clear selected brands, but some links construct raw queries that break on ampersands. | Implemented but defective | `pages/{Home,Shop,ProductDetails}.jsx`, `components/Navbar.jsx` | Use slugs or URLSearchParams everywhere. Verify Home & Furniture links and filter state when entering from global navigation. | High |
| Product | Price filters | Numeric min/max matching and price sorting exist. Inverted ranges are accepted and the default max is finite. | Implemented but defective | `pages/Shop.jsx` | Reject inverted bounds and allow omitted bounds. Send validated paise ranges and sort controls to the API. | Medium |
| Product | Images, descriptions, prices and stock information | Images, description and prices render. Stock is mainly conveyed by cart controls or sold-out text. Remote images lack fallback. | Partially implemented | `data/mockData.js`, `pages/ProductDetails.jsx`, `components/ProductCard.jsx`, `pages/admin/ManageProducts.jsx` | Use reliably hosted images with fallback, validated product content and a clear stock label. | High |
| Product | Admin create, edit and delete | Local add/edit modal and delete action are wired. Product initialization overwrites all changes at reload. Staff mutations were not exercised in the prior browser run. | Implemented but defective | `pages/admin/ManageProducts.jsx`, `context/ShopContext.jsx` | Persist admin changes through role-checked endpoints. Validate fields and archive products referenced by orders. Confirm destructive actions. | High |
| Product | Category management | Static category list and a category selector on products. | Missing | `data/mockData.js`, `context/ShopContext.jsx`, `pages/admin/ManageProducts.jsx` | Add category listing, creation, editing and archive/reassignment rules. | High |

### Shopping cart

| Module | Required feature | Current implementation | Completion status | Relevant source files | Required modifications | Priority |
|---|---|---|---|---|---|---|
| Cart | Add products | Card and detail handlers add a snapshot or increment the existing line. Details add-to-cart was browser-verified. Repeated adds can exceed stock. | Fully implemented | `components/ProductCard.jsx`, `pages/ProductDetails.jsx`, `context/CartContext.jsx` | Preserve add behavior and apply the inventory checks listed below. | High |
| Cart | Remove products | Remove handler filters out the selected line. | Fully implemented | `pages/Cart.jsx`, `context/CartContext.jsx` | Connect customer removals to the cart API and retain guest removal. | Medium |
| Cart | Update quantities | Plus/minus change quantity and zero removes a line. Plus checks the stored snapshot rather than current catalog stock. | Implemented but defective | `pages/Cart.jsx`, `context/CartContext.jsx` | Validate positive integers, check current stock, return available quantity on rejection and synchronize the saved cart. | High |
| Cart | Correct price and totals | Cart MRP, discount and delivery math are wired. The prior test showed the correct cart amount. Checkout duplicates the rules, cart uses stale prices and free-delivery labels can contradict the fee. | Implemented but defective | `pages/{Cart,Checkout}.jsx`, `context/CartContext.jsx`, `components/ProductCard.jsx` | Use server quotes and integer paise. Centralize the fee rule and render totals from one contract. | High |
| Cart | Wishlist | Header route is undeclared. Card handler has no mutation and detail heart has no handler. | Missing | `App.jsx`, `components/{Navbar,ProductCard}.jsx`, `pages/ProductDetails.jsx` | Implement customer wishlist CRUD, feedback and a dedicated page using current product data. | High |
| Cart | Persistent cart | Origin-wide localStorage cart survives reload. Accounts share one cart and cart data includes stale product snapshots. | Partially implemented | `context/CartContext.jsx` | Store one cart per customer. Keep only product IDs and quantities in the guest cart. Define a bounded merge once on sign-in. | High |
| Cart | Checkout | The cart leads into an address, summary and mock payment flow. The prior browser test placed a local order. | Partially implemented | `pages/{Cart,Checkout}.jsx`, `context/ShopContext.jsx` | Load a server quote, validate ownership and address, disable duplicate submission and render a durable order receipt. | High |

### Order management

| Module | Required feature | Current implementation | Completion status | Relevant source files | Required modifications | Priority |
|---|---|---|---|---|---|---|
| Order | Order creation | Creates a local Processing object with cart snapshots and shipping details. Verified in prior checkout test. | Partially implemented | `pages/Checkout.jsx`, `context/ShopContext.jsx` | Create order and lines in a transaction with checkout ownership, stock, server prices and a retry key. | Critical |
| Order | Unique order IDs | Uses a timestamp-prefixed ID. There is no uniqueness constraint. | Partially implemented | `context/ShopContext.jsx` | Use database-generated UUIDs and an optional unique customer-facing order number. | High |
| Order | Shipping address management | Address form and in-checkout edit exist. No address book. Receipt history reads `zipCode` although checkout writes `pincode`. | Implemented but defective | `pages/{Checkout,Profile}.jsx` | Add saved addresses, selection and validation. Standardize `pincode` and snapshot the selected address on the order. | High |
| Order | Order confirmation | Local receipt shows ID/status, but recalculates amount after clearing the cart. | Implemented but defective | `pages/Checkout.jsx`, `context/ShopContext.jsx` | Display the submitted order snapshot or fetch a receipt by order ID. Remove the unimplemented email claim unless email is added. | High |
| Order | Customer order history | Profile filters local orders using the current user ID. Re-login can generate a different ID; the separate Orders link is broken. | Implemented but defective | `context/AuthContext.jsx`, `pages/Profile.jsx`, `components/Navbar.jsx`, `App.jsx` | List the authenticated customer's DB orders. Route the Orders link to the history page and handle direct reloads. | High |
| Order | Order tracking | Track Order opens general history and shows one current status. No per-order detail or timeline. | Partially implemented | `pages/{Checkout,Profile}.jsx` | Add an owner-checked detail route and a timestamped status timeline. Carrier tracking is optional. | High |
| Order | Administrator status management | Admin list can select statuses directly in browser state. No transition or audit guard. | Implemented but defective | `pages/admin/ManageOrders.jsx`, `context/ShopContext.jsx` | Validate transitions, audit actor/time and make cancellation/restocking idempotent. | High |
| Order | Processing, Shipped, Delivered, Cancelled | All four values are shown and persisted locally. Reverse and arbitrary jumps are possible. | Partially implemented | `pages/admin/ManageOrders.jsx`, `pages/Profile.jsx`, `context/ShopContext.jsx` | Constrain fulfillment statuses and implement Processing → Shipped → Delivered or eligible Processing → Cancelled. Keep payment state separate. | High |

### Payment

| Module | Required feature | Current implementation | Completion status | Relevant source files | Required modifications | Priority |
|---|---|---|---|---|---|---|
| Payment | Payment method selection | Radio buttons show UPI, card and COD. Submission ignores the selected value. | Implemented but defective | `pages/Checkout.jsx` | Submit a valid controlled method. Offer online test payment and optional COD only when that branch is implemented. | High |
| Payment | Secure gateway in Test Mode | No gateway client, API, environment settings or webhooks exist. Payment logos are presentation assets. | Missing | `pages/Checkout.jsx`, `components/Footer.jsx`, root `package.json` | Integrate Razorpay Standard Checkout using test credentials, backend-created orders and restricted secrets. | Critical |
| Payment | Payment verification | No signature validation or provider status check. | Missing | `pages/Checkout.jsx`, `context/ShopContext.jsx` | Verify checkout responses and signed webhooks, reconcile amount/currency/capture state and finalize once. | Critical |
| Payment | Success and failure handling | Success UI follows every local submit. No provider failure, dismissal, pending or retry state. | Implemented but defective | `pages/Checkout.jsx` | Add pending verification, verified success, failed/dismissed and retriable flows. Retain the cart on failure. | High |
| Payment | Payment confirmation | Existing success view confirms a local order only. No verified receipt, method or reference. | Missing | `pages/Checkout.jsx`, `pages/Profile.jsx` | Fetch server-confirmed payment status and show date, final INR total and a customer-safe payment reference. | High |
| Payment | Consistent INR throughout | Storefront amounts use rupee symbols. Profile, admin dashboard, product table and order table contain dollar formats. | Implemented but defective | `pages/{Cart,Checkout,Profile,ProductDetails}.jsx`, `components/ProductCard.jsx`, `pages/admin/{Dashboard,ManageOrders,ManageProducts}.jsx` | Use a shared INR formatter with paise at the API boundary. Check quotes, receipts, order lines, report figures and staff tables. | High |

### Inventory

| Module | Required feature | Current implementation | Completion status | Relevant source files | Required modifications | Priority |
|---|---|---|---|---|---|---|
| Inventory | Product stock management | Seeded stock is editable in admin. Reload restores the seed, and the form lacks a minimum. | Implemented but defective | `data/mockData.js`, `context/ShopContext.jsx`, `pages/admin/ManageProducts.jsx` | Persist on-hand counts, validate nonnegative integer changes and record movement reasons. | High |
| Inventory | Automatic reduction after successful placement | Local submit decrements stock without verifying payment or validating inventory. Reload restores seed quantities. | Implemented but defective | `context/ShopContext.jsx`, `pages/Checkout.jsx` | Reserve available units for online attempts and decrement on-hand only at verified order finalization. Confirmed COD can finalize immediately. | Critical |
| Inventory | Out-of-stock validation | Product buttons disable only at zero and cart plus uses stale stock. | Implemented but defective | `components/ProductCard.jsx`, `pages/{Cart,ProductDetails}.jsx`, `context/CartContext.jsx` | Display current availability and recheck in cart, quote and finalization services. | Critical |
| Inventory | Prevent purchases above available stock | The cart, checkout and inventory update lack a complete cumulative or concurrent check. | Missing | `context/{Cart,Shop}Context.jsx`, `pages/Checkout.jsx` | Enforce quantities under row locks, with nonnegative DB constraints and concurrency tests for the last unit. | Critical |
| Inventory | Low-stock indicators | Admin dashboard counts stock ≤5 and product table uses stock badges. | Fully implemented | `pages/admin/{Dashboard,ManageProducts}.jsx` | Keep the indicators and compute them from persisted available stock with a documented threshold. | Medium |
| Inventory | Administrator inventory management | Product form edits stock. There is no durable inventory view, reason or history. | Partially implemented | `pages/admin/ManageProducts.jsx`, `context/ShopContext.jsx` | Add relative stock adjustments, stock movement history and low-stock filtering within the admin shell. | High |

### Review and rating

| Module | Required feature | Current implementation | Completion status | Relevant source files | Required modifications | Priority |
|---|---|---|---|---|---|---|
| Review | Product star ratings | 1–5 selection is wired and cards/details display aggregate ratings. Seed ratings and counts are synthetic. | Partially implemented | `components/{ReviewSection,ProductCard}.jsx`, `pages/ProductDetails.jsx`, `data/mockData.js` | Use real validated rating rows and represent unrated products clearly. | Medium |
| Review | Customer reviews | Signed-in users submit text and rating into product state. Refresh resets reviews. | Implemented but defective | `components/ReviewSection.jsx`, `context/ShopContext.jsx` | Store reviews in the DB, validate length and support updating the customer's own review. | High |
| Review | Average rating | Provider averages embedded review ratings on submit, but leaves the separate fabricated count unchanged and loses updates on reload. | Implemented but defective | `context/ShopContext.jsx`, `components/ProductCard.jsx`, `pages/ProductDetails.jsx` | Derive mean and count from the same review rows and expose them in catalog data. | Medium |
| Review | Verified-purchase eligibility | Any signed-in mock identity can submit. | Missing | `components/ReviewSection.jsx`, `context/ShopContext.jsx` | Require a Delivered order line belonging to the reviewer and enforce one review per product/customer. | High |
| Review | Review display on details | A review list, stars, author/date and empty state are rendered. | Fully implemented | `pages/ProductDetails.jsx`, `components/ReviewSection.jsx` | Retain the presentation and load persisted, paginated reviews with eligibility feedback. | Medium |

### Administration

| Module | Required feature | Current implementation | Completion status | Relevant source files | Required modifications | Priority |
|---|---|---|---|---|---|---|
| Admin | Centralized dashboard | Sidebar, metrics and recent orders exist. Data is local and admin gate trusts browser state. | Partially implemented | `App.jsx`, `pages/admin/Dashboard.jsx` | Retain the dashboard shell and replace data with an admin-only overview endpoint. | High |
| Admin | Customer management | Order table displays customer IDs. No customer directory or status actions. | Missing | `App.jsx`, `pages/admin/{Dashboard,ManageOrders}.jsx`, `context/AuthContext.jsx` | Add a paginated customer directory and active/suspended status action with audit trail and session revocation. | High |
| Admin | Product management | Local create/edit/delete. Changes disappear on reload. | Implemented but defective | `pages/admin/ManageProducts.jsx`, `context/ShopContext.jsx` | Connect the existing screens to admin product endpoints. | High |
| Admin | Category management | No page or mutation workflow. | Missing | `App.jsx`, `pages/admin/Dashboard.jsx`, `data/mockData.js` | Add an Admin Categories route and scoped mutations. | High |
| Admin | Order management | Basic order list and unrestricted status selector. | Partially implemented | `pages/admin/ManageOrders.jsx`, `context/ShopContext.jsx` | Add filters, order detail, signed-in operator history and valid status actions. | High |
| Admin | Inventory management | Product stock field and low-stock badges exist. Durable adjustments and movement records are absent. | Partially implemented | `pages/admin/{Dashboard,ManageProducts}.jsx` | Add stock view and adjustment endpoints and display auditable movement history. | High |
| Admin | Payment records | No persistent payment records and no admin payment page. | Missing | `App.jsx`, `pages/admin/Dashboard.jsx`, `pages/Checkout.jsx` | Add paginated records by date/state/method, safe reference fields and order links. | High |
| Admin | Sales reports | No reporting by period or export. | Missing | `pages/admin/Dashboard.jsx`, `App.jsx` | Add a date range, order counts by state, collected revenue and product sales. CSV export is optional. | High |
| Admin | Revenue and order statistics | Dashboard sums every stored order, including cancelled and unpaid simulated records, and displays a dollar label. | Implemented but defective | `pages/admin/Dashboard.jsx` | Define order counts by fulfillment state and net collected revenue from verified capture/collection less refunds. Label test-mode data. | High |

### Cross-cutting requirements

| Module | Required feature | Current implementation | Completion status | Relevant source files | Required modifications | Priority |
|---|---|---|---|---|---|---|
| Quality | Mobile, tablet and desktop responsiveness | CSS breakpoints exist. End-to-end viewport and touch QA are incomplete, with hover menus and wide tables requiring attention. | Not verified | `components/{Navbar,ProductCard}.css`, `pages/{Shop,Checkout}.css`, `pages/admin/Admin.css` | Test touch/keyboard flows at 360, 768 and 1440 px. Add click-operated menus, responsive tables and usable filter controls. | High |
| Quality | Consistent, professional interface | Shared styles and page layouts exist. Currency, action states and presentation copy vary. | Partially implemented | `index.css`, `App.css`, `pages/*.css`, `pages/admin/Admin.css` | Preserve the visual design. Apply shared money, status, form and feedback presentation with visible focus. | Medium |
| Quality | Proper validation | Native required/email/URL checks and blank review guard exist. PIN, phone, stock, ranges and ownership are insufficiently validated. | Partially implemented | `pages/{Login,Register,Checkout,Shop}.jsx`, `components/ReviewSection.jsx`, `pages/admin/ManageProducts.jsx` | Validate typed requests on the server and mirror helpful field checks in the UI. | High |
| Quality | Loading states | Current app loads fixture state synchronously. No general request, retry or mutation loading state exists. | Missing | `context/*.jsx`, `pages/Shop.jsx`, `pages/Checkout.jsx` | Add loading, disabled pending submit, timed-out and retry states during API integration. | Medium |
| Quality | Error messages | Login error, product not-found and catalog/cart empty states exist. No shared operation error contract. | Partially implemented | `pages/{Login,ProductDetails,Shop,Cart}.jsx` | Map structured server errors to inline fields and accessible page alerts. | High |
| Quality | Success notifications | Checkout has a confirmation view. Most mutations have no explicit confirmation feedback. | Partially implemented | `pages/Checkout.jsx`, `pages/admin/ManageProducts.jsx`, `components/ReviewSection.jsx` | Retain the receipt and add accessible action feedback for account, cart and staff updates. | Medium |
| Quality | Persistent database | Browser storage only. Catalog, reviews and changed stock reset. No database implementation. | Missing | `context/*.jsx`, `data/mockData.js`, root `package.json` | Introduce PostgreSQL migrations, explicit seed command, backup and restore. | Critical |
| Quality | Secure backend authentication and authorization | No backend service or application endpoints. | Missing | root `package.json`, `context/AuthContext.jsx`, `App.jsx` | Implement server sessions, role/ownership middleware and security tests. | Critical |
| Quality | Functional navigation, buttons and forms | Main paths are wired, but Orders, Wishlist, Seller, About, Help and Policy links can open empty bodies. Buy Now, PIN check, Save for Later and more advertise unfinished interactions. | Implemented but defective | `App.jsx`, `components/{Navbar,Footer,ProductCard}.jsx`, `pages/{Home,Cart,ProductDetails}.jsx` | Wire required workflows and a 404. Resolve each remaining link with a real destination or remove it from the release UI. | High |
| Quality | No unnecessary placeholders | Static countdown, mock review counts, placeholder seller/policy links, shipping and offer claims, email promise and synthetic specifications remain visible. | Implemented but defective | `pages/{Home,Shop,ProductDetails,Checkout}.jsx`, `components/Footer.jsx`, `data/mockData.js` | Keep labeled demo data and genuine test checkout. Remove dead controls and unsupported claims. | High |

## 2. Checkout defect and regression acceptance

**Prior headless browser result:** product 1 cart total **₹16,863**. The order stored numeric **16863**, with status **Processing**, and the cart emptied. Confirmation displayed **₹40**. Profile rendered **$16863.00** and omitted the saved PIN.

- `pages/Checkout.jsx` passes the correct pre-clear `totalAmount` to `placeOrder`, stores the returned ID, sets the success view and clears the cart. The success view reuses a price derived from the live basket. When that basket is empty, the subtotal is 0 and the shipping formula charges ₹40. The receipt reads this new total.
- `pages/Profile.jsx` prepends a dollar symbol and calls `toFixed(2)`; it also reads `shippingDetails.zipCode` instead of the submitted `pincode`. The admin product/order tables and overview have independent dollar formatting.
- **First approved patch:** snapshot the complete submitted order result in checkout, including ID, amount and status, then clear the cart. Use a shared `en-IN` / `INR` formatter with a consistent decimal policy, and align the address field name. Keep the existing shipping rule at this stage: ₹40 for subtotal up to and including ₹500 and free above ₹500, on a nonempty basket.
- **Integrated solution:** return a persisted order receipt with `subtotalPaise`, `deliveryPaise`, `totalPaise`, `currency`, `status` and `paymentStatus`. After confirmation, route to `/orders/:orderId`. Render the order snapshot on direct visit or reload. The successful checkout must clear purchased cart items once, after finalization. It may keep unrelated cart changes made during payment.
- **Acceptance:** repeat the case using an expected total of **1,686,300 paise**. Cart quote, Razorpay test order, stored receipt, confirmation, profile and admin order must agree and show INR. Verify that clearing the cart and reloading the receipt preserve the result. Test ₹499, ₹500 and ₹501, a decimal price, an empty cart, a payment decline, and correct PIN display. Failed or unresolved payment must preserve the basket and show a recoverable state.

## 3. Current stack and frontend retention

| Area | Current |
|---|---|
| Frontend | React and React DOM ^19.2.8, JavaScript/JSX, HTML, plain CSS, React Router DOM ^7.18.3, Lucide React ^1.37.0 |
| State/data | React Context and hooks, JavaScript seed data, browser localStorage |
| Tooling | npm lockfile, Vite ^8.2.2, Vite React plugin ^6.1.0, Oxlint ^1.79.0, Git |
| Backend/data/payment | No API service, persistent database or gateway. Vite is the development/build tool. |
| External browser assets | Seeded Unsplash URLs, Google Fonts and Wikimedia logos. Connectivity and image availability are not guaranteed by the app. |

**Retain React, routes, CSS, logo, home banners, cards, catalog grid, cart presentation, checkout steps and admin shell.** Replace data access beneath the existing hooks gradually and add screens using the current styles. Introduce a small API client, auth/session bootstrapping, receipt/history, wishlist, saved addresses and required admin views. Use accessible interaction changes for hover-dependent navigation. Keep the brand **MultiStore** and use **Multipurpose E-Commerce Website** on submission materials. During the first phase, update browser metadata to the agreed branding. Generate a fresh `dist/` from source for each release.

## 4. Recommended architecture

**One deployable application backend.** Node.js 24 LTS, Express 5, PostgreSQL, parameterized SQL through a PostgreSQL driver, migrations, one runtime schema validator and a DB-backed session store. Existing JavaScript can be used on both sides. Modules under proposed `server/src/` handle auth, catalog, basket, orders, inventory, payment, reviews and reports. Route handlers parse and authorize requests, services enforce business rules and transactions, and repository functions perform queries. Checkout, webhooks and cancellation use explicit transactions with consistent lock ordering. [Node release status](https://nodejs.org/en/about/previous-releases) · [Express 5 reference](https://expressjs.com/en/5x/api/) · [PostgreSQL row locking](https://www.postgresql.org/docs/18/explicit-locking.html)

**Same-origin deployment.** Serve the SPA and `/api/v1` through one HTTPS origin. Use Vite's proxy for local API calls. The host serves static assets directly and rewrites only UI routes to the SPA shell. Keep PostgreSQL private. Use a public HTTPS test environment for webhooks, environment-scoped keys and a separate test database. Provide versioned migrations, a repeatable seed and redacted request logs. Use an explicit admin bootstrap command. Preserve current product IDs as import keys where useful for existing links, and import curated data into durable tables. Existing browser orders and mock identities contain synthetic records and should stay out of the shared database. A guest cart can migrate as product identifiers and quantities after validation.

**Roles and lifecycle.** Guest reads catalog and keeps a local cart. Customer has a session and owns carts, addresses, wishlist, orders and reviews. Admin manages products, categories, adjustments, customers, orders and reports. Online checkout attempts remain separate from fulfillment orders until verified. Customer order fulfillment uses Processing, Shipped, Delivered and Cancelled. Payment attempts use states such as Pending, Authorized, Captured, Failed, Expired and Refunded with an exception/reconciliation state when needed. If COD is retained, payment starts unpaid and is recorded as collected only by an authorized delivery/collection action. Sales reporting distinguishes test captures and optional COD collections.

## 5. Proposed database tables and relationships

All application tables below are proposed. Use UUID primary keys unless a natural or composite PK is listed. Use generated timestamps, indexed foreign keys, normalized unique emails, restrict deletion of purchase history and store money as integer paise. A request-scoped transaction owns both stock and order writes.

| Table | Core fields and relationships |
|---|---|
| `users` | ID, name, normalized email unique, password hash, role, active/suspended flag, timestamps. One user has many sessions, addresses, checkout attempts, orders and reviews. |
| `sessions` | Opaque token digest PK, user FK, expiry, last-used and revocation fields. |
| `addresses` | User FK, label, recipient, phone, line(s), locality, city, state, `pincode`, country and optional default marker. One user has zero or many. |
| `categories` | Name, unique slug, active flag and timestamps. One category has many products. |
| `sellers` | Name and optional attribution fields. Reference only if original seller display is retained. One seller has many products; product seller FK is nullable. |
| `products` | Category FK, optional seller FK, unique SKU/slug, name, description, brand, image URL, price in paise, optional MRP, on-hand and reserved quantities, active flag and created time. Constrain nonnegative values and reserved ≤ on-hand. Add optional `product_images` only if multiple views enter scope. |
| `carts`, `cart_items` | One active cart per authenticated user. Items use composite cart/product key with a positive integer quantity. Products may be present in many carts. |
| `wishlist_items` | Composite user/product PK with added time. One row per saved product and customer. |
| `checkout_attempts` | User FK, client idempotency key unique per user, request fingerprint, status, method, finalized order ID if any, accepted shipping/quote snapshots, expiry and times. A retry fingerprint mismatch returns conflict. |
| `checkout_items` | Attempt FK, product FK, quantity, product name and quoted unit price. One attempt has one or more lines. These rows back bounded reservations. |
| `orders` | User FK, unique public order number, unique source attempt FK, fulfillment status, subtotal/delivery/total paise, currency, immutable shipping snapshot, timestamps. One order per finalized checkout attempt. |
| `order_items` | Order and product FKs, name/SKU snapshots, unit price paise and quantity. Product soft deletion preserves this linkage. |
| `order_status_events` | Order FK, optional admin actor FK, from/to status, reason and occurrence time. One order has many events. |
| `payments` | Checkout attempt FK, nullable order FK until finalization, provider/method, state, unique provider order and payment IDs when present, captured/refunded amounts, currency, mode and timestamps. Allow multiple attempts without creating multiple fulfilled orders. |
| `payment_events` | Provider event ID unique, optional payment FK, event kind, digest or minimally retained metadata, receive/processed timestamps. Supports deduplication and reconciliation. |
| `inventory_movements` | Product FK, optional order/checkout and actor FKs, quantity delta, reason, unique business operation reference and timestamp. Records placement, cancellation and manual adjustments. |
| `reviews` | Product and user FKs, eligible order-item FK, rating 1–5, content and timestamps, unique product/user pair. |
| `admin_audit_events` | Admin actor, action, target type/ID, timestamp and safe metadata for customer suspension, category/product changes and financial/stock actions. |

Index order history by user/date, catalog by category/active, checkout expiry by state/date and reporting by payment state/time. Enforce one successful fulfillment per attempt. Use order and payment data for sales reports. A table for report totals is unnecessary at the expected demo scale.

## 6. Proposed API contract

Base path `/api/v1`. Public and customer endpoints use stable resource IDs. Customers derive identity from their session. Use pagination, field-level validation errors, `401`/ `403` for access rules, `404` for absent resources, `409` for stock/state conflicts and `422` for invalid business inputs. Private lists and receipts must enforce ownership before returning data.

| Access | Method and path | Purpose |
|---|---|---|
| Public | `GET /categories`, `GET /products`, `GET /products/:id`, `GET /products/:id/reviews` | Catalog, category/filter/search/sort pagination, product details and review list |
| Public/session | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/session` | Session lifecycle. Register creates customers only. |
| Customer | `GET/PATCH /me`, `POST /me/password` | Read/update profile and change password |
| Customer | `GET/POST /me/addresses`, `PATCH/DELETE /me/addresses/:id` | Own saved shipping addresses |
| Customer | `GET /me/cart`, `PUT/DELETE /me/cart/items/:productId`, `POST /me/cart/merge` | Persistent basket, exact quantity updates and one-time guest merge |
| Customer | `GET /me/wishlist`, `PUT/DELETE /me/wishlist/:productId` | Browse, add and remove saved products |
| Customer | `POST /checkout/quote`, `POST /checkout/attempts`, `GET /checkout/attempts/:id` | Server pricing, bounded reservation, gateway order creation and recovery after refresh |
| Customer | `POST /checkout/attempts/:id/verify` | Validate gateway response; return pending or verified receipt reference |
| Provider | `POST /webhooks/razorpay` | Verify signed raw request and process events idempotently |
| Customer | `GET /me/orders`, `GET /me/orders/:id` | List history, details, shipping snapshot, payment summary and timeline |
| Customer | `GET /products/:id/review-eligibility`, `PUT /products/:id/my-review` | Check Delivered order line and create/update own review |
| Admin | `GET /admin/overview`, `GET /admin/reports/sales` | KPIs and date-filtered sales |
| Admin | `GET /admin/customers`, `GET /admin/customers/:id`, `PATCH /admin/customers/:id/status` | Customer directory and account suspension/activation |
| Admin | `GET/POST /admin/products`, `PATCH/DELETE /admin/products/:id` | Catalog management and soft archive |
| Admin | `GET/POST /admin/categories`, `PATCH/DELETE /admin/categories/:id` | Category management; enforce product references on archive/reassignment |
| Admin | `GET /admin/inventory`, `POST /admin/inventory/:productId/adjustments`, `GET /admin/inventory/:productId/movements` | Low stock, audited adjustments and history |
| Admin | `GET /admin/orders`, `GET /admin/orders/:id`, `PATCH /admin/orders/:id/status` | Filter orders and enforce fulfillment transitions |
| Admin | `GET /admin/payments`, `GET /admin/payments/:id` | Payment records with masked or safe references. Optional COD collection requires a separate audited action. |
| Operations | `GET /healthz`, `GET /readyz` | Liveness/readiness without environment or credential disclosure |

## 7. Razorpay Test Mode integration

1. Configure Razorpay **Standard Checkout** with a test account and a staging webhook. The browser receives the public test key ID and provider order ID. API and webhook secrets stay on the server. Use the supported hosted controls for card/UPI methods available in the test account. Use official test instruments. [Integration steps](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/) · [Test payment details](https://razorpay.com/docs/payments/payments/test-card-details/)
2. For a valid quote, save the checkout attempt and reserve inventory in a short DB transaction. Then create the Razorpay order from the persisted INR amount in paise, outside the stock transaction. Persist the provider order ID before returning it to the browser. Protect concurrent attempt creation with a DB-scoped idempotency record. When gateway creation times out ambiguously, reconcile the prior attempt, using the internal reference and provider records before opening a replacement. Do not assume provider order creation is inherently idempotent.
3. The browser opens hosted checkout and sends the payment ID and signature to the backend. Compute the checkout signature using the **server-stored provider order ID** and returned payment ID. Verify the signature, the authenticated attempt owner, provider order linkage, exact amount and INR currency. Confirm provider capture before treating the payment as settled. An authorization or browser callback alone leaves the order pending verification. [Razorpay signature and capture steps](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/)
4. Verify webhook signatures against the original raw bytes with the separate webhook secret. Deduplicate using the provider event identity. Handle callback/webhook races and out-of-order delivery using one finalization service and monotonic payment state transitions. Bind exactly one final order and stock movement to a successful attempt. Show confirmed receipt only after DB commit. [Razorpay webhook validation](https://razorpay.com/docs/webhooks/validate-test/)
5. When a gateway attempt fails or times out, keep the cart and show retry or pending verification. An expiry worker releases reservations once after reconciling provider state. If a late capture wins after release, either reacquire stock under lock and finalize if policy permits, or move it into a visible refund/reconciliation state without overselling. For the demo, configure and test one clear policy for cancelling prepaid Processing orders and reflecting any test refund in reports. COD is optional and must represent an unpaid order until a verified business collection event.
6. Rehearse one test success, one decline and a retry, a browser refresh after success, and a duplicate or delayed webhook. Label the gateway and payment records **Test Mode** so demonstration activity is distinguishable from actual payments.

## 8. Security improvements

| Area | Approval target |
|---|---|
| Identity | Remove the embedded demo credential. Apply Argon2id password hashing, unique normalized email and login rate limits. Enforce current-password verification and session revocation on password updates. [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) |
| Sessions | Opaque sessions with token digests at rest, rotation on login and privilege changes, expiry and revocation. Set Secure, HttpOnly and SameSite cookies over HTTPS. Use origin and CSRF checks for state-changing cookie-authenticated requests. The signed webhook has its own verification boundary. [OWASP sessions](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) |
| Authorization | Server-side role and ownership checks for order, address, review, cart, payment and admin endpoints. Block public role assignment and disable sessions for suspended accounts. |
| Data protection | Minimize sensitive fields in responses and logs. Keep shipping data and sessions out of localStorage. Use restrictive DB access, secret-backed environment configuration, TLS, bounded request bodies and backups tested with a restore. |
| Input/output | Validate all writes with shared constraints. Use parameterized SQL, safe text rendering and an explicit image-host policy. Add an appropriate Content Security Policy and allow the provider origins required by hosted checkout. |
| Commerce integrity | Price and stock come from the server. Use paise, stock locks, unique operation keys, request fingerprints, status transitions and audit records. Limit webhook processing to verified provider events. |
| Operational controls | Use separate test/live configuration where applicable, keep test reporting labeled, scan locked dependencies during CI, and monitor failed verification and unresolved payment exceptions. |

## 9. Phased roadmap and approval gates

| Phase | Scope and files | Acceptance gate |
|---|---|---|
| 0 — Scope approval | Approve Express/PostgreSQL/Razorpay Test Mode, same-origin sessions, reserve-then-finalize checkout, guest cart behavior and fulfillment policy. | Agree on architecture, demo environment and whether to retain COD. |
| 1 — Repair current demo | Edit `src/pages/{Checkout,Profile,Cart,Home,ProductDetails}.jsx`, `src/pages/admin/`, `src/components/{Navbar,Footer}.jsx`, `src/App.jsx`, a **new** money utility and `index.html`. | ₹16,863 regression fixed, PIN present, category URL encoded, order navigation and 404 handled, current working flows still visible. |
| 2 — API foundations and identity | Add `server/src/`, `server/db/migrations/`, `server/db/seeds/`, environment template, API client and validation. Update `src/context/AuthContext.jsx`, login/register/profile, guards and Vite proxy. | Fresh start reproducible. Re-login restores stable account, password changes work, guests/customers cannot access admin endpoints. |
| 3 — Catalog, cart and customer data | Connect `src/context/{Shop,Cart}Context.jsx`, `Shop.jsx`, cards and admin product page. Add category/wishlist/address/admin inventory screens, services and migrations. | Listing/search/category filters work, persistent cart and wishlist are account-isolated, stock and catalog edits survive reload. |
| 4 — Orders, inventory and gateway | Add checkout/order/payment services, webhook route, expiration/reconciliation task, migrations and order detail UI. Update checkout, profile and admin orders. | Successful test capture finalizes one order, stock drops once, failure retains cart, late/replayed events reconcile and checkout cannot oversell. |
| 5 — Reviews and full administration | Connect `src/components/ReviewSection.jsx`, admin shell and new customers, payments and sales views. | Delivered purchase permits review, aggregates match real rows, staff can manage supported resources and reports reconcile to payments. |
| 6 — QA and deployment | Add browser/API tests and CI, update deployment config and README, regenerate build from source and provision HTTPS test webhook. | Responsive demo, clean seeded setup, deep links, cross-role flows, logging, backup/restore and reviewable test evidence. |

## 10. Testing and release evidence

Previous audit recorded a passing build, 17 lint warnings and no errors, HTTP smoke checks, and one browser checkout. There is no tracked automated test suite or test script. Build and lint results are historical for the audited commit.

| Layer | Required coverage |
|---|---|
| Unit | Paise arithmetic, delivery thresholds, formatter, purchase eligibility, address/field validation, checkout failure mapping, allowed order/payment transitions and report formulas. |
| API + disposable PostgreSQL | Account creation and duplicate email, login/logout, password change and revocation, cart isolation and merge, admin CRUD, category reassignment, order ownership, shipment timeline, reviews, revenue and status filters. |
| Transaction and concurrency | Two buyers on final unit, duplicate submit with same key and changed payload, callback/webhook race, retry after network interruption, stale quote, expired reservation, late capture, cancellation/restock once, and failed write rollback. |
| Razorpay Test Mode | Success, decline, dismissal, pending capture, successful verification, amount/currency mismatch, event replay/order reversal and trusted webhook delivery. Use an isolated test account for live sandbox checks and fixture-backed integration tests for deterministic CI. |
| Browser | Guest browse and sign-in return, filters/URL encoding, cart/wishlist, address edits, INR receipt regression, profile order view, admin guard, each primary staff flow and direct reloads. |
| Security | Access matrix for public/customer/admin; cross-customer resource isolation, session expiry/revocation, CSRF, rate limits, invalid signatures, safe rendering and no secret leakage in built client or logs. |
| Responsive/accessibility | 360 px phone, 768 px tablet and 1440 px desktop; mobile tap behavior, keyboard navigation and focus states, checkout error announcements, admin tables and dialogs. |
| Deployment | Fresh install and migration, deterministic seed, production build and SPA fallback, assets without external image access, test webhooks over HTTPS, log review and restore exercise. |

Record the tested commit, browser, viewport, payment mode, expected/actual result and test evidence. Review CSS and functional UX on real devices before claiming responsive acceptance.

## 11. Estimated module completion

The percentages estimate coverage of official requirements, including reusable local UI. They are calculated uniformly from the matrix: **Fully implemented = 1**, **Partially implemented = 0.5**, **Implemented but defective = 0.25**, **Missing = 0**, and **Not verified = 0 credited pending evidence**. Sum each module's feature weights and divide by its number of rows. The eight module percentages overlap where the official requirements repeat admin features. Cross-cutting rows are outside those eight denominators. This measure does not estimate time remaining or establish production readiness.

| Module | Estimate | Justification |
|---|---|---|
| User management | **36%** (3.25/9) | Mock forms and route guards provide UI groundwork. Trustworthy identity, stable accounts and password changes are missing. |
| Product management | **47%** (4.25/9) | Catalog, page and category display are reusable. Search, durable admin writes and category management remain. |
| Shopping cart | **50%** (3.5/7) | Add/remove work locally. Quantity, price, persistence and checkout depend on server integration, and wishlist is absent. |
| Order management | **38%** (3/8) | Local order placement, history and statuses exist with confirmed receipt and identity defects. |
| Payment | **13%** (0.75/6) | Selection and success UI have little reusable business logic. Gateway, verification and financial records are absent. |
| Inventory management | **38%** (2.25/6) | Stock fields, badges and local reduction exist. The core allocation and durability guarantees remain. |
| Review and rating | **40%** (2/5) | Review UI and average calculation are reusable. Durability and verified-purchase checks remain. |
| Administration | **22%** (2/9) | The shell, basic product/order pages and metrics exist. Customer, category, payment and reporting workflows remain. |

**Approval decision requested:** retain the existing React design and use Express + PostgreSQL, cookie-backed sessions and Razorpay Standard Checkout in Test Mode. Keep the initial release focused on customer purchase and administrator operations. Use verified gateway checkout as the main demo flow and retain COD only if the team approves and implements its collection lifecycle. After approval, begin with the receipt, currency and navigation repairs in Phase 1.

