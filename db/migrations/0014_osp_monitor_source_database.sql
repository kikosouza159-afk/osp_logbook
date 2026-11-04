-- 0014_osp_monitor_source_database.sql
-- Registra o banco SQL Server de origem (ProfessionalServices02/03).

ALTER TABLE osp_monitor_tabulation
  ADD COLUMN IF NOT EXISTS source_database TEXT;

ALTER TABLE osp_monitor_pbx_return
  ADD COLUMN IF NOT EXISTS source_database TEXT;

CREATE INDEX IF NOT EXISTS ix_osp_monitor_tabulation_source_db
  ON osp_monitor_tabulation(reference_date,source_database,server_ip,campaign_id);

CREATE INDEX IF NOT EXISTS ix_osp_monitor_pbx_source_db
  ON osp_monitor_pbx_return(reference_date,source_database,server_ip,campaign_id);
