CREATE TABLE IF NOT EXISTS public.osp_financial_client_map (
  source_client text NOT NULL,
  agent_type text NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  PRIMARY KEY(source_client,agent_type)
);
CREATE TABLE IF NOT EXISTS public.osp_financial_billing_start (
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  start_date date NOT NULL,
  scope_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(client_id,product_id,start_date)
);
INSERT INTO public.osp_financial_client_map(source_client,agent_type,client_id,product_id)
SELECT lower(trim(v.source_client)),v.agent_type,c.id,p.id FROM (VALUES
('4','ARANHA E FERREIRA','Aranha e Ferreira'),
('5','BOTICARIO','Boticário'),
('4','COBRAR ADVOGADOS','Cobrar Advogados'),
('4','CREDITAS','Creditas'),
('4','EM DIA','EmDia'),
('5','Energisa','Energisa'),
('4','FULLTIME','Full Time'),
('4','LINK','Link Solucoes'),
('4','MAX RECOVERY','Max Recovery'),
('4','NOVAQUEST','NovaQuest'),
('4','PEREZ REZENDE','Perez de Rezende'),
('4','PRECISÃO GLOBAL','Precisão Global'),
('4','REDE BRASIL','Rede Brasil'),
('4','REIS ADV','Reis Advogados'),
('4','RENAC','Renac'),
('5','SETRA','Setra'),
('4','TALENTOS','Talentos'),
('4','VERRESCHI','Verreschi'),
('4','FERREIRA E CHAGAS','Ferreira e Chagas'),
('4','TRC','TRC TABORDA'),
('4','MEETCALL','MeetCall'),
('5','NegocieOnline','NegocieOnline')
) v(agent_type,source_client,client_name)
JOIN public.clients c ON c.name=v.client_name
JOIN public.products p ON p.code=CASE v.agent_type WHEN '4' THEN 'LOCATOR' WHEN '5' THEN 'ADA' END
JOIN public.client_products cp ON cp.client_id=c.id AND cp.product_id=p.id
ON CONFLICT(source_client,agent_type) DO NOTHING;
INSERT INTO public.osp_financial_billing_start(client_id,product_id,start_date,scope_note)
SELECT c.id,p.id,v.start_date::date,v.scope_note FROM (VALUES
('4','NovaQuest','2026-04-16',''),
('4','Talentos','2026-05-04',''),
('4','Ferreira e Chagas','2026-06-01','Duas datas informadas; carteira não identificada.'),
('4','Creditas','2026-07-29',''),
('4','Renac','2026-08-01',''),
('4','Link Solucoes','2026-06-26',''),
('4','Aranha e Ferreira','2026-08-14',''),
('4','Perez de Rezende','2026-11-05',''),
('4','Ferreira e Chagas','2026-08-24','Duas datas informadas; carteira não identificada.'),
('4','Precisão Global','2026-11-03',''),
('4','Cobrar Advogados','2026-08-01',''),
('4','Full Time','2026-08-01',''),
('4','TRC TABORDA','2026-10-26',''),
('4','Rede Brasil','2026-08-14',''),
('4','EmDia','2026-09-08','Informado como EmDia (Liderança); escopo da carteira a confirmar.'),
('4','Max Recovery','2026-10-21',''),
('4','O Boticário','2026-11-13','Cadastro distinto de Boticário; origem BOTICARIO tipo 4 a confirmar.'),
('4','Reis Advogados','2026-10-21',''),
('4','MeetCall','2026-11-03',''),
('4','Verrechi','2026-10-21','Cadastro distinto de Verreschi; correspondência da origem a confirmar.'),
('5','Energisa','2026-10-13','Duas datas informadas; carteira não identificada.'),
('5','Energisa','2026-10-01','Duas datas informadas; carteira não identificada.'),
('5','NegocieOnline','2026-08-01','')
) v(agent_type,client_name,start_date,scope_note)
JOIN public.clients c ON c.name=v.client_name
JOIN public.products p ON p.code=CASE v.agent_type WHEN '4' THEN 'LOCATOR' WHEN '5' THEN 'ADA' END
JOIN public.client_products cp ON cp.client_id=c.id AND cp.product_id=p.id
ON CONFLICT(client_id,product_id,start_date) DO NOTHING;
