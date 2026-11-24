-- Energisa's ADA campaign 345 is sales; all other ADA campaigns are collections.
-- The rule uses the source IP or actual server name, not the campaign description.
CREATE OR REPLACE VIEW osp_financial_resolved AS
SELECT f.*,
 CASE WHEN env.energisa AND er.id IS NOT NULL THEN er.id
      WHEN env.shared THEN cm.client_id
      ELSE COALESCE(cm.client_id,sm.client_id,m.client_id) END AS resolved_client_id,
 env.shared AS shared_environment,
 (NOT env.shared OR cm.client_id IS NOT NULL) AS included_in_reporting
FROM osp_financial_all f
CROSS JOIN LATERAL (SELECT
 (lower(trim(f.nome_servidor))='olosftfspodtb01' OR COALESCE(f.source_host='10.195.124.1'::inet,false) OR lower(trim(f.cliente)) IN ('fastflow','fastflow / pagbank (não segregado)')) AS shared,
 (f.virtual_agent_type_id='5' AND (COALESCE(f.source_host='10.195.114.12'::inet,false) OR lower(trim(f.nome_servidor))='olosengspodtb02')) AS energisa
) env
LEFT JOIN LATERAL (SELECT c.id FROM clients c WHERE env.energisa AND c.display_name=CASE WHEN f.campaign_id='345' THEN 'Energisa - SDR' ELSE 'Energisa - Cobrança' END ORDER BY c.id LIMIT 1) er ON true
LEFT JOIN osp_financial_campaign_map cm ON cm.server_key=lower(trim(f.nome_servidor)) AND cm.campaign_id=f.campaign_id AND cm.agent_type=f.virtual_agent_type_id
LEFT JOIN osp_financial_server_map sm ON sm.source_host=f.source_host AND sm.agent_type=f.virtual_agent_type_id
LEFT JOIN osp_financial_client_map m ON m.source_client=lower(trim(f.cliente)) AND m.agent_type=f.virtual_agent_type_id;
-- Remove only the two superseded, explicitly ambiguous duplicate markers, if the confirmed markers exist.
DELETE FROM osp_financial_billing_start s USING clients c, products p
WHERE s.client_id=c.id AND s.product_id=p.id AND c.display_name='Energisa' AND p.code='ADA'
 AND s.start_date IN ('2026-10-01','2026-10-13') AND s.scope_note='Duas datas informadas; carteira não identificada.'
 AND s.poc_start IS NULL AND s.poc_end IS NULL
 AND EXISTS (SELECT 1 FROM osp_financial_billing_start t JOIN clients cc ON cc.id=t.client_id WHERE t.product_id=s.product_id AND t.start_date=s.start_date AND t.scope_note='' AND cc.display_name=CASE WHEN s.start_date='2026-10-01' THEN 'Energisa - SDR' ELSE 'Energisa - Cobrança' END);
