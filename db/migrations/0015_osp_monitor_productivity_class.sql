-- 0015_osp_monitor_productivity_class.sql
-- Adiciona a dimensão Produtivo/Improdutivo ao monitor de Attempts.
-- Regra de origem:
--   AgentId > 0 = PRODUTIVO
--   AgentId = 0 = IMPRODUTIVO
--
-- Registros históricos anteriores à implantação permanecem NULL,
-- pois a classificação não pode ser reconstruída com segurança
-- a partir da base já agregada.

ALTER TABLE osp_monitor_tabulation
  ADD COLUMN IF NOT EXISTS productivity_class TEXT;

CREATE INDEX IF NOT EXISTS ix_osp_monitor_tabulation_productivity
  ON osp_monitor_tabulation(
    reference_date,
    client_name,
    product_code,
    campaign_id,
    productivity_class,
    reference_hour
  );
