# MultiStore final testing checklist

## Verified locally through Phase 8

- [x] Apply PostgreSQL migrations and verify an idempotent catalog seed.
- [x] Exercise customer sessions, administrator authorization, addresses, catalog and inventory.
- [x] Verify durable cart, wishlist, checkout, receipts, order access, stock adjustment and cancellation.
- [x] Exercise Razorpay payment state, signatures, webhook replay, inventory expiry and rollback with mocked provider responses.
- [x] Verify purchase-gated reviews, administrator moderation and published rating aggregates.
- [x] Verify PostgreSQL dashboard counts, test capture and demo COD separation, refund/cancellation exclusions and India date boundaries.
- [x] Verify customer search and status changes, session revocation, administrator-only reporting, all five CSV endpoints and formula protection.
- [x] Verify administrator activity across catalog, inventory, orders, customers, payments and reviews.
- [x] Verify the five new admin views in Chrome at 390 px, CSV download, the ₹16,863 checkout regression and the production build.

## Pending external Razorpay Test Mode verification

This item remains open. The automated tests and local browser fixture do not substitute for a Razorpay-account run.

- [ ] Configure real **Test Mode** credentials and a distinct webhook secret in the ignored server environment file.
- [ ] Open the hosted Standard Checkout widget and verify that Razorpay creates a matching INR test order. Exercise success, failure, dismissal and retry using official test instruments.
- [ ] Verify the captured payment against the MultiStore receipt and admin record. Confirm that stock and cart updates occur once.
- [ ] Verify external signed webhooks over public HTTPS, including delivery retries or event replay.
- [ ] Verify a full test refund through provider data and reconcile the admin record.
- [ ] Record the environment, date and test evidence without including credentials or private transaction details.

Follow the [Razorpay Test Mode setup guide](server/PAYMENTS.md#setup-and-verification-with-a-razorpay-account).
