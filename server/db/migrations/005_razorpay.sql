ALTER TABLE products ADD COLUMN reserved_stock integer NOT NULL DEFAULT 0
  CHECK (reserved_stock >= 0 AND reserved_stock <= stock);

ALTER TABLE orders ADD COLUMN payment_method text NOT NULL DEFAULT 'demo_cod'
  CHECK (payment_method IN ('demo_cod','razorpay')),
  ADD COLUMN reservation_state text NOT NULL DEFAULT 'None'
  CHECK (reservation_state IN ('None','Held','Released','Consumed')),
  ADD COLUMN reservation_expires_at timestamptz,
  ADD COLUMN finalized_at timestamptz;
UPDATE orders SET finalized_at=created_at;
CREATE UNIQUE INDEX orders_online_hold_user_idx ON orders(user_id) WHERE reservation_state='Held';
CREATE INDEX orders_reservation_expiry_idx ON orders(reservation_expires_at) WHERE reservation_state='Held';

ALTER TABLE payments DROP CONSTRAINT payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check CHECK (status IN
  ('Creating','CreationUnknown','Pending','Authorized','Captured','Failed','Expired','Refunded',
   'Cancelled','RefundRequired','ReconciliationRequired'));
ALTER TABLE payments ADD COLUMN method text,
  ADD COLUMN failure_reason text,
  ADD COLUMN verified_at timestamptz;
CREATE UNIQUE INDEX payments_razorpay_order_idx ON payments(provider_order_id)
  WHERE provider='razorpay' AND provider_order_id IS NOT NULL;
CREATE UNIQUE INDEX payments_razorpay_internal_idx ON payments(order_id) WHERE provider='razorpay';
CREATE INDEX payments_listing_idx ON payments(created_at DESC,id DESC);

CREATE TABLE payment_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
