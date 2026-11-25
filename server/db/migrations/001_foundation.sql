CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (email = lower(trim(email))),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  password_hash text NOT NULL CHECK (password_hash LIKE '$argon2id$%'),
  role text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  token_digest text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL CHECK (expires_at > created_at),
  revoked_at timestamptz
);
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE categories (
  id text PRIMARY KEY,
  name text NOT NULL UNIQUE,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id text PRIMARY KEY,
  category_id text NOT NULL REFERENCES categories(id),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  description text NOT NULL,
  brand text,
  price_paise integer NOT NULL CHECK (price_paise >= 0),
  original_price_paise integer CHECK (original_price_paise >= price_paise),
  discount_percent smallint CHECK (discount_percent BETWEEN 0 AND 100),
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  catalog_metadata jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(catalog_metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_category_idx ON products(category_id, active, display_order, id);
CREATE INDEX products_listing_idx ON products(active, display_order, id);

CREATE TABLE product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url text NOT NULL CHECK (url ~ '^https?://'),
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, position)
);

CREATE TABLE addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient text NOT NULL,
  phone text NOT NULL,
  address_line text NOT NULL,
  locality text,
  city text NOT NULL,
  state text NOT NULL,
  pincode text NOT NULL CHECK (pincode ~ '^[0-9]{6}$'),
  country_code char(2) NOT NULL DEFAULT 'IN',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX addresses_user_idx ON addresses(user_id);

CREATE TABLE cart_items (
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  product_id text REFERENCES products(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);
CREATE INDEX cart_items_product_idx ON cart_items(product_id);

CREATE TABLE wishlist_items (
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  product_id text REFERENCES products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);
CREATE INDEX wishlist_items_product_idx ON wishlist_items(product_id);

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  order_number text NOT NULL UNIQUE,
  idempotency_key text,
  status text NOT NULL DEFAULT 'Processing'
    CHECK (status IN ('Processing', 'Shipped', 'Delivered', 'Cancelled')),
  currency char(3) NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  subtotal_paise integer NOT NULL CHECK (subtotal_paise >= 0),
  delivery_paise integer NOT NULL CHECK (delivery_paise >= 0),
  total_paise integer NOT NULL CHECK (total_paise::bigint = subtotal_paise::bigint + delivery_paise),
  shipping_snapshot jsonb NOT NULL CHECK (jsonb_typeof(shipping_snapshot) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);
CREATE INDEX orders_user_date_idx ON orders(user_id, created_at DESC);
CREATE INDEX orders_status_date_idx ON orders(status, created_at DESC);

CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  product_id text NOT NULL REFERENCES products(id),
  product_name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price_paise integer NOT NULL CHECK (unit_price_paise >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, product_id),
  UNIQUE (id, product_id)
);
CREATE INDEX order_items_product_idx ON order_items(product_id);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  provider text NOT NULL,
  provider_order_id text,
  provider_payment_id text,
  status text NOT NULL CHECK (status IN ('Pending', 'Authorized', 'Captured', 'Failed', 'Expired', 'Refunded')),
  amount_paise integer NOT NULL CHECK (amount_paise >= 0),
  currency char(3) NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_payment_id)
);
CREATE INDEX payments_order_idx ON payments(order_id);
CREATE INDEX payments_provider_order_idx ON payments(provider, provider_order_id);
CREATE INDEX payments_status_date_idx ON payments(status, created_at DESC);

CREATE TABLE reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  product_id text NOT NULL REFERENCES products(id),
  order_item_id uuid NOT NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, user_id),
  FOREIGN KEY (order_item_id, product_id) REFERENCES order_items(id, product_id)
);
CREATE INDEX reviews_user_idx ON reviews(user_id);
CREATE INDEX reviews_order_item_idx ON reviews(order_item_id);

CREATE TABLE inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL REFERENCES products(id),
  order_id uuid REFERENCES orders(id),
  actor_user_id uuid REFERENCES users(id),
  delta integer NOT NULL CHECK (delta <> 0),
  reason text NOT NULL CHECK (length(trim(reason)) > 0),
  operation_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX inventory_product_date_idx ON inventory_transactions(product_id, created_at DESC);
CREATE INDEX inventory_order_idx ON inventory_transactions(order_id);
CREATE INDEX inventory_actor_idx ON inventory_transactions(actor_user_id);
