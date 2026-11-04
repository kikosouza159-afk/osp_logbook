-- 0013_osp_monitor_client_product.sql
-- Identificacao do snapshot por Cliente e Produto para o OSP Monitor Engine.

ALTER TABLE osp_monitor_tabulation
  ADD COLUMN IF NOT EXISTS client_name TEXT,
  ADD COLUMN IF NOT EXISTS product_code TEXT;

ALTER TABLE osp_monitor_pbx_return
  ADD COLUMN IF NOT EXISTS client_name TEXT,
  ADD COLUMN IF NOT EXISTS product_code TEXT;

CREATE INDEX IF NOT EXISTS ix_osp_monitor_tabulation_client_product
  ON osp_monitor_tabulation(reference_date,client_name,product_code,campaign_id);

CREATE INDEX IF NOT EXISTS ix_osp_monitor_pbx_client_product
  ON osp_monitor_pbx_return(reference_date,client_name,product_code,campaign_id);
