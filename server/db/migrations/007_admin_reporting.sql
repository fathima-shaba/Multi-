CREATE TABLE admin_activity (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_name text NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_activity_recent_idx ON admin_activity(created_at DESC,id DESC);
CREATE INDEX admin_activity_target_idx ON admin_activity(target_type,target_id,created_at DESC);
CREATE INDEX customers_registration_idx ON users(created_at DESC,id DESC) WHERE role='customer';
CREATE INDEX finalized_orders_reporting_idx ON orders(created_at,status) WHERE finalized_at IS NOT NULL;
CREATE INDEX captured_test_reporting_idx ON payments(verified_at,order_id)
  WHERE provider='razorpay' AND status='Captured' AND verified_at IS NOT NULL;
CREATE INDEX inventory_activity_recent_idx ON inventory_transactions(created_at DESC,id DESC);

CREATE VIEW reporting_orders AS
SELECT * FROM orders WHERE finalized_at IS NOT NULL;

CREATE VIEW verified_test_receipts AS
SELECT p.id AS payment_id,p.order_id,p.amount_paise,p.verified_at
FROM payments p JOIN reporting_orders o ON o.id=p.order_id
WHERE p.provider='razorpay' AND p.status='Captured' AND p.verified_at IS NOT NULL
  AND o.payment_method='razorpay' AND o.status<>'Cancelled'
  AND p.currency=o.currency AND p.amount_paise=o.total_paise;
