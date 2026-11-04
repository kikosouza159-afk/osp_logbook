-- 0012_osp_monitor_engine.sql
-- Estrutura de ingestao do OSP Monitor Engine.

CREATE TABLE IF NOT EXISTS osp_monitor_tabulation (
  id BIGSERIAL PRIMARY KEY,
  server_ip TEXT NOT NULL,
  server_name TEXT NOT NULL,
  reference_date DATE NOT NULL,
  reference_hour SMALLINT NOT NULL CHECK (reference_hour BETWEEN 0 AND 23),
  campaign_id INTEGER NOT NULL,
  campaign_name TEXT NOT NULL,
  route TEXT,
  disposition_id INTEGER NOT NULL,
  tabulation TEXT NOT NULL,
  seconds_bucket TEXT NOT NULL,
  quantity BIGINT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  seconds BIGINT NOT NULL DEFAULT 0 CHECK (seconds >= 0),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_osp_monitor_tabulation_date_campaign
  ON osp_monitor_tabulation(reference_date,campaign_id,reference_hour);
CREATE INDEX IF NOT EXISTS ix_osp_monitor_tabulation_disposition
  ON osp_monitor_tabulation(reference_date,disposition_id,tabulation);
CREATE INDEX IF NOT EXISTS ix_osp_monitor_tabulation_route
  ON osp_monitor_tabulation(reference_date,route);

CREATE TABLE IF NOT EXISTS osp_monitor_pbx_return (
  id BIGSERIAL PRIMARY KEY,
  server_ip TEXT NOT NULL,
  server_name TEXT NOT NULL,
  reference_date DATE NOT NULL,
  reference_hour SMALLINT NOT NULL CHECK (reference_hour BETWEEN 0 AND 23),
  campaign_id INTEGER NOT NULL,
  campaign_name TEXT NOT NULL,
  pbx_disposition_id INTEGER NOT NULL,
  return_description TEXT NOT NULL,
  quantity BIGINT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_osp_monitor_pbx_date_campaign
  ON osp_monitor_pbx_return(reference_date,campaign_id,reference_hour);
CREATE INDEX IF NOT EXISTS ix_osp_monitor_pbx_return
  ON osp_monitor_pbx_return(reference_date,pbx_disposition_id,return_description);

CREATE TABLE IF NOT EXISTS osp_monitor_etl_control (
  run_id UUID PRIMARY KEY,
  source_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('RUNNING','SUCCESS','ERROR')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  rows_tabulation INTEGER NOT NULL DEFAULT 0,
  rows_pbx_return INTEGER NOT NULL DEFAULT 0,
  deleted_tabulation INTEGER NOT NULL DEFAULT 0,
  deleted_pbx_return INTEGER NOT NULL DEFAULT 0,
  inserted_tabulation INTEGER NOT NULL DEFAULT 0,
  inserted_pbx_return INTEGER NOT NULL DEFAULT 0,
  source_server TEXT,
  etl_host TEXT,
  duration_ms BIGINT,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS ix_osp_monitor_etl_control_started
  ON osp_monitor_etl_control(started_at DESC);
CREATE INDEX IF NOT EXISTS ix_osp_monitor_etl_control_status
  ON osp_monitor_etl_control(status,started_at DESC);

CREATE OR REPLACE VIEW osp_monitor_etl_status AS
SELECT
  run_id,source_date,status,started_at,finished_at,
  rows_tabulation,rows_pbx_return,
  inserted_tabulation,inserted_pbx_return,
  source_server,etl_host,duration_ms,error_message,
  EXTRACT(EPOCH FROM (NOW() - COALESCE(finished_at,started_at)))::BIGINT AS seconds_since_update
FROM osp_monitor_etl_control
ORDER BY started_at DESC
LIMIT 1;
