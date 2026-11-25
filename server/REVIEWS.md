# MultiStore Phase 7 — reviews and ratings

## Setup

Run `npm.cmd run db:migrate` before starting the updated API. Use the [PostgreSQL setup guide](README.md#setup-on-windows) and [administrator bootstrap instructions](AUTHENTICATION.md#initialize-the-administrator) for a permanent development setup. For a fresh database, run `npm.cmd run db:seed` after migrating. Start `npm.cmd run api` and `npm.cmd run dev` in separate terminals. Run `npm.cmd run test:api` on a disposable seeded development database. Review tests create and clean up labeled fixtures. The normal seed adds no reviews.

## Verified purchase and ratings

Each review references an order item for the same product and customer. The API checks the purchase during submission and editing. PostgreSQL enforces the verified reference on insert or when its ownership or order-item reference changes. The existing unique customer/product key rejects concurrent duplicates.

- A customer needs a finalized, Delivered order. Demo Cash on Delivery must reach Delivered. Razorpay orders additionally need a captured INR payment matching the order total. Cancelled or refunded online orders do not qualify. A refund that invalidates the referenced purchase also excludes the review from public results.
- PostgreSQL's `published_product_reviews` view supplies both public reviews and catalog aggregates. It excludes hidden, removed, customer-deleted and purchase-ineligible reviews. The average is the arithmetic mean rounded to two decimals in the API and one decimal in the storefront. Distribution bars use the count for each rating from one through five. Unrated products return a zero count and a null average. Catalog reads override seeded rating and count metadata with these aggregates.
- The storefront displays the public first name or a generic customer name when the name looks like an email address. Public responses omit email and user or order identifiers. React renders review content as plain text.
- The owner can edit an eligible review, delete it, and manage it from **My Reviews**. The profile separately lists eligible products. Customer deletion immediately hides the item from the storefront and profile. An ordinary deleted review can be replaced. A deleted review already hidden or removed by moderation cannot be reposted to bypass that decision.
- Administrators search by product or customer name and filter by rating or status. Hide, Restore and Remove require a reason. Removal is terminal. The moderation route accepts status and reason only. PostgreSQL records the actor, timestamp and state change in an audit table.

## Database changes

Migration `006_reviews.sql` reuses `reviews` and adds moderation status, reason, moderator, timestamps and a customer deletion marker. It adds partial indexes, `review_moderation_events`, the eligible and published views, and the verified-purchase trigger. Existing review relationships to users, products and order items are retained. No historical browser reviews are imported.

## API

All paths are under `/api`. Public review pages default to newest first. Private routes are session-scoped. Writes retain origin and CSRF checks. Admin routes enforce the administrator role.

| Method and path | Behavior |
|---|---|
| `GET /products/:id/reviews` | Published verified reviews. Five per page. Supports `sort=newest\|highest\|lowest` and `offset`. |
| `GET /products/:id/review-summary` | Verified published average, count, and one-through-five distribution. |
| `GET /products/:id/review-eligibility` | Current user's eligibility, ability to submit, and existing review where applicable. |
| `POST /products/:id/reviews` | Submit `{rating,body}`. Rating must be an integer 1–5. Review text must be 1–2,000 characters. |
| `PATCH /reviews/:id` | Edit the authenticated owner's rating and review text. |
| `DELETE /reviews/:id` | Logically delete the authenticated owner's review. |
| `GET /users/me/reviews` | Own submitted reviews and delivered products eligible for review. Supports independent `offset` and `eligibleOffset`. |
| `GET /admin/reviews` | Admin listing. Supports `q`, `rating`, `status` and `offset`. |
| `PATCH /admin/reviews/:id/status` | Admin moderation. Accepts `{status,reason}` with a 3–500 character reason. |

See the [final testing checklist](../TESTING_CHECKLIST.md) for external Razorpay verification still pending.

## Verification

- All six migrations applied on disposable native PostgreSQL. The second migration run made no changes. The catalog seed preserved 475 products and 19 categories.
- All 26 integration tests passed. The review suite covered duplicate and cross-owner rejection, invalid ratings and text, cancelled and unpaid orders, captured online review eligibility, refund exclusion, review search and pagination, and rating changes after editing, deleting and moderation. Prior catalog, account, commerce and mocked Razorpay suites passed in the same run.
- On the production build, Chromium completed the ₹16,863 Demo COD checkout, marked the order delivered, and verified review submission, distribution, refresh, My Reviews editing and deletion, and administrator hide and restore. Product reviews, My Reviews and administrator reviews fit an emulated 390 px viewport. The production build passed. Lint reported 11 warnings and no errors. Captures are in [phase7-screenshots](../phase7-screenshots/).
- Browser and SQL review fixtures were created in disposable databases and labeled as test data. External Razorpay verification remains pending.
