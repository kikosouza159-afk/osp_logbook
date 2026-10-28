-- 0010_client_portfolio_operational_status.sql
-- Status operacional por carteira (cliente + produto), com motivo e trilha de auditoria.

ALTER TABLE client_portfolios
  ADD COLUMN IF NOT EXISTS inactive_reason_code VARCHAR(40),
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deactivated_by UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='client_portfolios_deactivated_by_fkey'
  ) THEN
    ALTER TABLE client_portfolios
      ADD CONSTRAINT client_portfolios_deactivated_by_fkey
      FOREIGN KEY (deactivated_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS client_portfolio_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES client_portfolios(id) ON DELETE CASCADE,
  previous_active BOOLEAN NOT NULL,
  new_active BOOLEAN NOT NULL,
  reason_code VARCHAR(40),
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_client_portfolio_status_history_portfolio
  ON client_portfolio_status_history(portfolio_id,created_at DESC);

CREATE INDEX IF NOT EXISTS ix_client_portfolios_active
  ON client_portfolios(active);
