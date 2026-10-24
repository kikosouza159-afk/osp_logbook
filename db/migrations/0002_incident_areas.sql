CREATE TABLE IF NOT EXISTS areas (
  code VARCHAR(20) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO areas(code, name, sort_order, active)
VALUES
  ('OSP', 'OSP - Olos Strategy and Planning', 10, TRUE),
  ('OTS', 'OTS - Olos Telecom Support', 20, TRUE),
  ('OLAB', 'OLAB - Olos Laboratory', 30, TRUE),
  ('ODE', 'ODE - Olos Digital Engineering', 40, TRUE),
  ('OIE', 'Olos Interaction Experts', 50, TRUE)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order,
    active = TRUE;

ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS area_code VARCHAR(20);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'incidents_area_code_fkey'
  ) THEN
    ALTER TABLE incidents
      ADD CONSTRAINT incidents_area_code_fkey
      FOREIGN KEY (area_code) REFERENCES areas(code);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS incidents_area_idx ON incidents(area_code);
CREATE INDEX IF NOT EXISTS incidents_area_created_idx ON incidents(area_code, created_at DESC);
