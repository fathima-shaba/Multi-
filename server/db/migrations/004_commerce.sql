ALTER TABLE orders DROP CONSTRAINT orders_status_check;
ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'Pending';
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('Pending','Processing','Shipped','Delivered','Cancelled'));
ALTER TABLE orders ADD COLUMN request_digest text,
  ADD COLUMN discount_paise integer NOT NULL DEFAULT 0 CHECK (discount_paise >= 0);
ALTER TABLE order_items ADD COLUMN image_url text;
ALTER TABLE payments DROP CONSTRAINT payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check
  CHECK (status IN ('Pending','Authorized','Captured','Failed','Expired','Refunded','Cancelled'));
CREATE TABLE order_status_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id),
  status text NOT NULL CHECK (status IN ('Pending','Processing','Shipped','Delivered','Cancelled')),
  actor_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_status_events_timeline_idx ON order_status_events(order_id,id);
