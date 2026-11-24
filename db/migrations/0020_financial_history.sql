CREATE TABLE IF NOT EXISTS public.osp_financial_history (
  cliente_original text NOT NULL,
  cliente text NOT NULL,
  nome_servidor text NOT NULL,
  data date NOT NULL,
  logados bigint NOT NULL,
  campaign_id text NOT NULL,
  nome_campanha text NOT NULL,
  virtual_agent_type_id text NOT NULL,
  chamadas_tarifadas bigint NOT NULL,
  valor_tarifado numeric(28,8) NOT NULL,
  data_hora_carga timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(cliente_original,nome_servidor,data,campaign_id,virtual_agent_type_id)
);
CREATE INDEX IF NOT EXISTS osp_financial_history_server_date_idx ON public.osp_financial_history (lower(trim(nome_servidor)),data);
CREATE INDEX IF NOT EXISTS osp_financial_billing_server_date_idx ON public.osp_financial_billing (lower(trim(nome_servidor)),data);
CREATE OR REPLACE VIEW public.osp_financial_all AS
SELECT cliente,nome_servidor,data,logados,campaign_id,nome_campanha,virtual_agent_type_id,chamadas_tarifadas,valor_tarifado,data_hora_carga FROM public.osp_financial_billing
UNION ALL
SELECT cliente,nome_servidor,data,logados,campaign_id,nome_campanha,virtual_agent_type_id,chamadas_tarifadas,valor_tarifado,data_hora_carga FROM (
 SELECT DISTINCT ON (lower(trim(h.nome_servidor)),h.data,h.campaign_id,h.virtual_agent_type_id) h.* FROM public.osp_financial_history h
 WHERE NOT EXISTS (SELECT 1 FROM public.osp_financial_billing b WHERE lower(trim(b.nome_servidor))=lower(trim(h.nome_servidor)) AND b.data=h.data)
 ORDER BY lower(trim(h.nome_servidor)),h.data,h.campaign_id,h.virtual_agent_type_id,h.cliente_original
) history;
