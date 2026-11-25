ALTER TABLE reviews
  ADD COLUMN moderation_status text NOT NULL DEFAULT 'Published'
    CHECK (moderation_status IN ('Published','Hidden','Removed')),
  ADD COLUMN moderation_reason text,
  ADD COLUMN moderated_at timestamptz,
  ADD COLUMN moderated_by uuid REFERENCES users(id),
  ADD COLUMN deleted_at timestamptz;

CREATE INDEX reviews_public_product_idx ON reviews(product_id,created_at DESC,id DESC)
  WHERE moderation_status='Published' AND deleted_at IS NULL;
CREATE INDEX reviews_moderation_idx ON reviews(moderation_status,created_at DESC,id DESC);

CREATE TABLE review_moderation_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  review_id uuid NOT NULL REFERENCES reviews(id),
  actor_user_id uuid NOT NULL REFERENCES users(id),
  previous_status text NOT NULL CHECK (previous_status IN ('Published','Hidden','Removed')),
  status text NOT NULL CHECK (status IN ('Published','Hidden','Removed')),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 3 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX review_moderation_events_history_idx ON review_moderation_events(review_id,id);

CREATE VIEW eligible_review_purchases AS
SELECT i.id AS order_item_id,i.product_id,o.user_id,o.id AS order_id,o.created_at AS order_date
FROM order_items i JOIN orders o ON o.id=i.order_id JOIN users u ON u.id=o.user_id
WHERE o.status='Delivered' AND o.finalized_at IS NOT NULL AND u.role='customer'
  AND (o.payment_method='demo_cod' OR (
    o.payment_method='razorpay' AND EXISTS (
      SELECT 1 FROM payments p WHERE p.order_id=o.id AND p.provider='razorpay' AND p.status='Captured'
        AND p.amount_paise=o.total_paise AND p.currency=o.currency
    )
  ));

CREATE FUNCTION check_verified_review_purchase() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM eligible_review_purchases e WHERE e.order_item_id=NEW.order_item_id
      AND e.product_id=NEW.product_id AND e.user_id=NEW.user_id) THEN
    RAISE EXCEPTION 'Review requires an eligible order item' USING ERRCODE='23514', CONSTRAINT='reviews_verified_purchase';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER verified_review_purchase
BEFORE INSERT OR UPDATE OF user_id,product_id,order_item_id ON reviews
FOR EACH ROW EXECUTE FUNCTION check_verified_review_purchase();

CREATE VIEW published_product_reviews AS
SELECT r.id,r.product_id,r.user_id,r.rating,r.body,r.created_at,r.updated_at
FROM reviews r JOIN eligible_review_purchases e
  ON e.order_item_id=r.order_item_id AND e.product_id=r.product_id AND e.user_id=r.user_id
WHERE r.moderation_status='Published' AND r.deleted_at IS NULL;
