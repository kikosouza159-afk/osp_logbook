CREATE TABLE IF NOT EXISTS commercial_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO commercial_contacts(name)
VALUES
  ('Amanda'),
  ('Gabriel Barca'),
  ('Areceli'),
  ('Andreas'),
  ('Arianne'),
  ('Fernanda'),
  ('Douglas'),
  ('Paulo Grecco')
ON CONFLICT(name) DO NOTHING;

ALTER TABLE client_products
  ADD COLUMN IF NOT EXISTS analyst_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS commercial_contact_id UUID REFERENCES commercial_contacts(id),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE client_products cp
SET analyst_id = (
      SELECT ac.analyst_id
      FROM analyst_clients ac
      WHERE ac.client_id = cp.client_id
      ORDER BY ac.is_primary DESC, ac.created_at NULLS LAST
      LIMIT 1
    ),
    updated_at = NOW()
WHERE cp.analyst_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM analyst_clients ac
    WHERE ac.client_id = cp.client_id
  );

CREATE INDEX IF NOT EXISTS idx_client_products_analyst
  ON client_products(analyst_id);

CREATE INDEX IF NOT EXISTS idx_client_products_commercial
  ON client_products(commercial_contact_id);
