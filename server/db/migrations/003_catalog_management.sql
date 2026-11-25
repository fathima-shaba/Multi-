ALTER TABLE categories ADD COLUMN description text NOT NULL DEFAULT '',
  ADD COLUMN active boolean NOT NULL DEFAULT true,
  ADD COLUMN archived_at timestamptz;
CREATE UNIQUE INDEX categories_name_normalized_idx ON categories(lower(name));
