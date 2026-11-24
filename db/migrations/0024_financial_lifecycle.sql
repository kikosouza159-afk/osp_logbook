CREATE TABLE IF NOT EXISTS osp_financial_lifecycle (
 scope_key text NOT NULL, agent_type text NOT NULL,
 status text NOT NULL CHECK(status IN ('POC_SEM_APROVACAO','SEM_POC')),
 note text NOT NULL DEFAULT '', updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(scope_key,agent_type)
);
INSERT INTO osp_financial_lifecycle(scope_key,agent_type,status,note)
SELECT c.id::text,v.agent,v.status,v.note FROM (VALUES
 ('Boticário','5','POC_SEM_APROVACAO','Não teve aprovação da POC'),
 ('Setra','5','POC_SEM_APROVACAO','Não teve aprovação da POC'),
 ('Cruzeiro do Sul','5','SEM_POC','Não entrou em POC')
) v(name,agent,status,note) JOIN clients c ON c.display_name=v.name
ON CONFLICT(scope_key,agent_type) DO NOTHING;
INSERT INTO osp_financial_lifecycle(scope_key,agent_type,status,note)
VALUES ('source:syscob','4','POC_SEM_APROVACAO','Não teve aprovação da POC'),('source:setra','4','POC_SEM_APROVACAO','Não teve aprovação da POC')
ON CONFLICT(scope_key,agent_type) DO NOTHING;
INSERT INTO clients(name,display_name,active) SELECT 'Elo','Elo',true WHERE NOT EXISTS(SELECT 1 FROM clients WHERE lower(trim(display_name))='elo');
INSERT INTO client_products(client_id,product_id)
SELECT c.id,p.id FROM clients c CROSS JOIN products p WHERE lower(trim(c.display_name))='elo' AND p.code='LOCATOR'
ON CONFLICT DO NOTHING;
INSERT INTO client_portfolios(client_id,product_id,active)
SELECT c.id,p.id,false FROM clients c CROSS JOIN products p WHERE lower(trim(c.display_name))='elo' AND p.code='LOCATOR'
ON CONFLICT(client_id,product_id) DO NOTHING;
INSERT INTO osp_financial_client_map(source_client,agent_type,client_id,product_id)
SELECT 'elo','4',c.id,p.id FROM clients c CROSS JOIN products p WHERE lower(trim(c.display_name))='elo' AND p.code='LOCATOR'
ON CONFLICT(source_client,agent_type) DO NOTHING;
INSERT INTO osp_financial_billing_start(client_id,product_id,start_date,scope_note)
SELECT c.id,p.id,v.dt::date,'' FROM (VALUES
 ('Boticário','LOCATOR','2026-11-13'),('Verreschi','LOCATOR','2026-10-21'),
 ('Energisa - Cobrança','ADA','2026-10-13'),('Energisa - SDR','ADA','2026-10-01')
) v(name,product,dt) JOIN clients c ON c.display_name=v.name JOIN products p ON p.code=v.product
ON CONFLICT(client_id,product_id,start_date) DO NOTHING;
UPDATE osp_financial_billing_start s SET scope_note='',updated_at=now() FROM clients c,products p WHERE s.client_id=c.id AND s.product_id=p.id AND c.display_name='EmDia' AND p.code='LOCATOR' AND s.start_date='2026-09-08' AND s.scope_note='Informado como EmDia (Liderança); escopo da carteira a confirmar.';
