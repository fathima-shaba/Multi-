ALTER TABLE users ADD COLUMN phone text CHECK (phone ~ '^[0-9]{10}$');

CREATE TABLE auth_attempts (
  bucket text PRIMARY KEY,
  attempts integer NOT NULL CHECK (attempts > 0),
  expires_at timestamptz NOT NULL
);
CREATE INDEX auth_attempts_expiry_idx ON auth_attempts(expires_at);
