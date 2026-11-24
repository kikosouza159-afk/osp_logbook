-- Preserve the raw ETL and historical records. Resolve commercial identity at read time.
CREATE TABLE IF NOT EXISTS public.osp_financial_server_map (
  source_host inet NOT NULL, agent_type text NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  PRIMARY KEY(source_host,agent_type)
);
CREATE TABLE IF NOT EXISTS public.osp_financial_campaign_map (
  server_key text NOT NULL, campaign_id text NOT NULL, agent_type text NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  PRIMARY KEY(server_key,campaign_id,agent_type)
);
INSERT INTO osp_financial_server_map(source_host,agent_type,client_id,product_id)
SELECT v.ip::inet,'4',c.id,p.id FROM (VALUES ('10.196.140.11','Rede Brasil P4'),('10.196.177.11','Rede Brasil P5')) v(ip,client_name)
JOIN clients c ON c.name=v.client_name JOIN products p ON p.code='LOCATOR' JOIN client_products cp ON cp.client_id=c.id AND cp.product_id=p.id
ON CONFLICT(source_host,agent_type) DO NOTHING;
INSERT INTO osp_financial_campaign_map(server_key,campaign_id,agent_type,client_id,product_id)
SELECT 'olosftfspodtb01',v.id,'5',c.id,p.id FROM (VALUES ('202'),('213'),('214')) v(id)
JOIN clients c ON c.name='AssistPay' JOIN products p ON p.code='ADA' JOIN client_products cp ON cp.client_id=c.id AND cp.product_id=p.id
ON CONFLICT(server_key,campaign_id,agent_type) DO NOTHING;
DELETE FROM osp_financial_client_map WHERE source_client='fastflow / pagbank (não segregado)' AND agent_type='5' AND client_id=(SELECT id FROM clients WHERE name='NegocieOnline');
INSERT INTO osp_financial_billing_start(client_id,product_id,start_date,scope_note)
SELECT c.id,p.id,v.dt::date,'' FROM (VALUES ('AssistPay','ADA','2026-08-01'),('Rede Brasil P4','LOCATOR','2026-08-14'),('Rede Brasil P5','LOCATOR','2026-08-14')) v(client_name,product_code,dt)
JOIN clients c ON c.name=v.client_name JOIN products p ON p.code=v.product_code JOIN client_products cp ON cp.client_id=c.id AND cp.product_id=p.id
ON CONFLICT(client_id,product_id,start_date) DO NOTHING;
CREATE OR REPLACE VIEW public.osp_financial_all AS
SELECT b.cliente,b.nome_servidor,b.data,b.logados,b.campaign_id,b.nome_campanha,b.virtual_agent_type_id,b.chamadas_tarifadas,b.valor_tarifado,b.data_hora_carga,b.source_host
FROM osp_financial_billing b
UNION ALL
SELECT h.cliente,h.nome_servidor,h.data,h.logados,h.campaign_id,h.nome_campanha,h.virtual_agent_type_id,h.chamadas_tarifadas,h.valor_tarifado,h.data_hora_carga,NULL::inet AS source_host
FROM (SELECT DISTINCT ON (lower(trim(h.nome_servidor)),h.data,h.campaign_id,h.virtual_agent_type_id) h.*
FROM osp_financial_history h
WHERE NOT EXISTS(SELECT 1 FROM osp_financial_billing b WHERE lower(trim(b.nome_servidor))=lower(trim(h.nome_servidor)) AND b.data=h.data)
ORDER BY lower(trim(h.nome_servidor)),h.data,h.campaign_id,h.virtual_agent_type_id,h.cliente_original) h;
CREATE OR REPLACE VIEW public.osp_financial_resolved AS
SELECT f.*,CASE WHEN env.shared THEN cm.client_id ELSE COALESCE(cm.client_id,sm.client_id,m.client_id) END AS resolved_client_id,
       env.shared AS shared_environment,
       (NOT env.shared OR cm.client_id IS NOT NULL) AS included_in_reporting
FROM osp_financial_all f
CROSS JOIN LATERAL (SELECT (lower(trim(f.nome_servidor))='olosftfspodtb01' OR COALESCE(f.source_host='10.195.124.1'::inet,false) OR lower(trim(f.cliente)) IN ('fastflow','fastflow / pagbank (não segregado)')) AS shared) env
LEFT JOIN osp_financial_campaign_map cm ON cm.server_key=lower(trim(f.nome_servidor)) AND cm.campaign_id=f.campaign_id AND cm.agent_type=f.virtual_agent_type_id
LEFT JOIN osp_financial_server_map sm ON sm.source_host=f.source_host AND sm.agent_type=f.virtual_agent_type_id
LEFT JOIN osp_financial_client_map m ON m.source_client=lower(trim(f.cliente)) AND m.agent_type=f.virtual_agent_type_id;
