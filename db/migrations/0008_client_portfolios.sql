CREATE TABLE IF NOT EXISTS commercials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS commercials_name_uq
  ON commercials (LOWER(name));

CREATE TABLE IF NOT EXISTS client_portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  analyst_id UUID REFERENCES users(id) ON DELETE SET NULL,
  commercial_id UUID REFERENCES commercials(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id, product_id)
);

CREATE INDEX IF NOT EXISTS client_portfolios_analyst_idx
  ON client_portfolios(analyst_id, active);
CREATE INDEX IF NOT EXISTS client_portfolios_commercial_idx
  ON client_portfolios(commercial_id, active);

INSERT INTO commercials(name)
VALUES
  ('Amanda'),
  ('Gabriel Barca'),
  ('Areceli'),
  ('Andreas'),
  ('Arianne'),
  ('Fernanda'),
  ('Douglas'),
  ('Paulo Grecco')
ON CONFLICT DO NOTHING;

INSERT INTO client_portfolios(client_id,product_id,analyst_id,active)
SELECT
  cp.client_id,
  cp.product_id,
  primary_link.analyst_id,
  TRUE
FROM client_products cp
LEFT JOIN LATERAL (
  SELECT ac.analyst_id
  FROM analyst_clients ac
  WHERE ac.client_id=cp.client_id AND ac.is_primary=TRUE
  ORDER BY ac.created_at
  LIMIT 1
) primary_link ON TRUE
ON CONFLICT(client_id,product_id) DO NOTHING;
