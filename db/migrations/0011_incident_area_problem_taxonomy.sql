-- 0011_incident_area_problem_taxonomy.sql
-- Taxonomia estruturada de Área Responsável + Tipo de Problema.

CREATE TABLE IF NOT EXISTS incident_problem_types (
  code VARCHAR(64) PRIMARY KEY,
  area_code VARCHAR(20) NOT NULL REFERENCES areas(code),
  label VARCHAR(160) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE incidents ADD COLUMN IF NOT EXISTS problem_type_code VARCHAR(64);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='incidents_problem_type_code_fkey'
  ) THEN
    ALTER TABLE incidents
      ADD CONSTRAINT incidents_problem_type_code_fkey
      FOREIGN KEY(problem_type_code) REFERENCES incident_problem_types(code);
  END IF;
END $$;

INSERT INTO areas(code,name,sort_order,active)
VALUES
  ('OTS','Telecom',10,TRUE),
  ('OPC','Curadoria',20,TRUE),
  ('ODE','Desenvolvimento',30,TRUE)
ON CONFLICT(code) DO UPDATE SET
  name=EXCLUDED.name,
  sort_order=EXCLUDED.sort_order,
  active=TRUE;

UPDATE areas SET active=FALSE WHERE code NOT IN ('OTS','OPC','ODE');

INSERT INTO incident_problem_types(code,area_code,label,sort_order,active) VALUES
 ('OTS_CONGESTIONAMENTO','OTS','Congestionamento',10,TRUE),
 ('OTS_CALLANLYSE','OTS','Callanlyse',20,TRUE),
 ('OTS_IMPOSSIVEL_COMPLETAR','OTS','Impossível Completar',30,TRUE),
 ('OTS_LINHA_MUD','OTS','Linha Muda',40,TRUE),
 ('OTS_RUIDO','OTS','Ruído',50,TRUE),
 ('OTS_CANAIS','OTS','Canais',60,TRUE),
 ('OTS_OUTROS','OTS','Outros',70,TRUE),
 ('OPC_VOZES','OPC','Vozes',10,TRUE),
 ('OPC_TABULACAO_INCORRETA','OPC','Tabulação incorreta',20,TRUE),
 ('OPC_FALHA_ENTENDIMENTO','OPC','Falha de entendimento',30,TRUE),
 ('OPC_FLUXO_INCORRETO','OPC','Fluxo incorreto',40,TRUE),
 ('OPC_FRASEOLOGIA_JORNADA','OPC','Fraseologia/Jornada',50,TRUE),
 ('OPC_INTERRUPCAO','OPC','Interrupção',60,TRUE),
 ('OPC_OUTROS','OPC','Outros',70,TRUE),
 ('ODE_ALTERACAO_FLUXO','ODE','Alteração Fluxo',10,TRUE),
 ('ODE_REPETICAO','ODE','Repetição',20,TRUE),
 ('ODE_FALHA_INTEGRACAO','ODE','Falha de integração (API/SMS/WhatsApp)',30,TRUE),
 ('ODE_AISM','ODE','AISM',40,TRUE),
 ('ODE_ERRO_TABULACAO','ODE','Erro de Tabulação',50,TRUE),
 ('ODE_ERRO_FLUXO','ODE','Erro no fluxo',60,TRUE),
 ('ODE_FALHA_TRANSFERENCIA','ODE','Falha na transferência',70,TRUE),
 ('ODE_OUTROS','ODE','Outros',80,TRUE)
ON CONFLICT(code) DO UPDATE SET
 area_code=EXCLUDED.area_code,
 label=EXCLUDED.label,
 sort_order=EXCLUDED.sort_order,
 active=TRUE,
 updated_at=NOW();

CREATE INDEX IF NOT EXISTS ix_incident_problem_types_area
  ON incident_problem_types(area_code,active,sort_order);

CREATE INDEX IF NOT EXISTS ix_incidents_problem_type
  ON incidents(problem_type_code);
