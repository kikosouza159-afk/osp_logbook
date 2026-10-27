-- 0009_checklist_product_scope.sql
-- Separa o checklist por cliente + produto sem apagar os registros legados.

ALTER TABLE daily_checklists
  ADD COLUMN IF NOT EXISTS product_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname='daily_checklists_product_id_fkey'
  ) THEN
    ALTER TABLE daily_checklists
      ADD CONSTRAINT daily_checklists_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES products(id);
  END IF;
END $$;

UPDATE daily_checklists dc
SET product_id=(
  SELECT cp.product_id
  FROM client_portfolios cp
  WHERE cp.client_id=dc.client_id
    AND cp.analyst_id=dc.analyst_id
    AND cp.active=TRUE
  ORDER BY cp.updated_at DESC NULLS LAST,cp.id
  LIMIT 1
)
WHERE dc.product_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM client_portfolios cp
    WHERE cp.client_id=dc.client_id
      AND cp.analyst_id=dc.analyst_id
      AND cp.active=TRUE
  );

WITH single_portfolio AS (
  SELECT client_id,MIN(product_id::text)::uuid AS product_id
  FROM client_portfolios
  WHERE active=TRUE
  GROUP BY client_id
  HAVING COUNT(*)=1
)
UPDATE daily_checklists dc
SET product_id=sp.product_id
FROM single_portfolio sp
WHERE dc.client_id=sp.client_id
  AND dc.product_id IS NULL;

ALTER TABLE daily_checklists
  DROP CONSTRAINT IF EXISTS daily_checklists_checklist_date_analyst_id_client_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS ux_daily_checklists_scope
  ON daily_checklists(checklist_date,analyst_id,client_id,product_id)
  WHERE product_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_daily_checklists_legacy_scope
  ON daily_checklists(checklist_date,analyst_id,client_id)
  WHERE product_id IS NULL;

CREATE INDEX IF NOT EXISTS ix_daily_checklists_product_id
  ON daily_checklists(product_id);
