CREATE TABLE IF NOT EXISTS osp_alerta (
  id BIGSERIAL PRIMARY KEY,
  data DATE NOT NULL,
  hora SMALLINT NOT NULL CHECK (hora BETWEEN 0 AND 23),
  servidor VARCHAR(100),
  cliente VARCHAR(150),
  agent_id INTEGER,
  campaign_id INTEGER,
  disposition_id INTEGER,
  tabulacao TEXT,
  nome_campanha VARCHAR(255),
  classificado VARCHAR(50),
  quantidade BIGINT NOT NULL DEFAULT 0,
  segundos BIGINT NOT NULL DEFAULT 0,
  produto SMALLINT NOT NULL,
  data_hora_carga TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_osp_alerta_data
  ON osp_alerta(data);

CREATE INDEX IF NOT EXISTS idx_osp_alerta_cliente_data
  ON osp_alerta(cliente, data);

CREATE INDEX IF NOT EXISTS idx_osp_alerta_produto_data
  ON osp_alerta(produto, data);

CREATE INDEX IF NOT EXISTS idx_osp_alerta_campaign_data
  ON osp_alerta(campaign_id, data);

CREATE TABLE IF NOT EXISTS osp_alerta_etl_log (
  id BIGSERIAL PRIMARY KEY,
  load_date DATE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL,
  source_rows INTEGER NOT NULL DEFAULT 0,
  inserted_rows INTEGER NOT NULL DEFAULT 0,
  duration_ms BIGINT,
  source_table VARCHAR(255) NOT NULL DEFAULT 'ProfessionalServices02.dbo.OSP_Alerta',
  message TEXT
);

CREATE INDEX IF NOT EXISTS idx_osp_alerta_etl_log_started
  ON osp_alerta_etl_log(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_osp_alerta_etl_log_status
  ON osp_alerta_etl_log(status, started_at DESC);
