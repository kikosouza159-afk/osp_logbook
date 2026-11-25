-- Normalize only the Velloso environment's type 2 to ADA (type 5).
-- Keep the original type in the raw tables and an audit column in the view.
CREATE OR REPLACE VIEW osp_financial_resolved AS
SELECT f.cliente,f.nome_servidor,f.data,f.logados,f.campaign_id,f.nome_campanha,
 normalized.agent_type AS virtual_agent_type_id,
 f.chamadas_tarifadas,f.valor_tarifado,f.data_hora_carga,f.source_host,
 CASE WHEN env.energisa AND er.id IS NOT NULL THEN er.id
      WHEN env.shared THEN cm.client_id
      ELSE COALESCE(cm.client_id,sm.client_id,m.client_id) END AS resolved_client_id,
 env.shared AS shared_environment,
 (NOT env.shared OR cm.client_id IS NOT NULL) AS included_in_reporting,
 f.virtual_agent_type_id AS source_virtual_agent_type_id
FROM osp_financial_all f
CROSS JOIN LATERAL (SELECT CASE WHEN f.virtual_agent_type_id='2' AND (COALESCE(f.source_host='10.196.132.11'::inet,false) OR lower(trim(f.nome_servidor))='olosvlspaedtb01') THEN '5' ELSE f.virtual_agent_type_id END AS agent_type) normalized
CROSS JOIN LATERAL (SELECT
 (lower(trim(f.nome_servidor))='olosftfspodtb01' OR COALESCE(f.source_host='10.195.124.1'::inet,false) OR lower(trim(f.cliente)) IN ('fastflow','fastflow / pagbank (não segregado)')) AS shared,
 (normalized.agent_type='5' AND (COALESCE(f.source_host='10.195.114.12'::inet,false) OR lower(trim(f.nome_servidor))='olosengspodtb02')) AS energisa
) env
LEFT JOIN LATERAL (SELECT c.id FROM clients c WHERE env.energisa AND c.display_name=CASE WHEN f.campaign_id='345' THEN 'Energisa - SDR' ELSE 'Energisa - Cobrança' END ORDER BY c.id LIMIT 1) er ON true
LEFT JOIN osp_financial_campaign_map cm ON cm.server_key=lower(trim(f.nome_servidor)) AND cm.campaign_id=f.campaign_id AND cm.agent_type=normalized.agent_type
LEFT JOIN osp_financial_server_map sm ON sm.source_host=f.source_host AND sm.agent_type=normalized.agent_type
LEFT JOIN osp_financial_client_map m ON m.source_client=lower(trim(f.cliente)) AND m.agent_type=normalized.agent_type;
