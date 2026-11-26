CREATE TABLE IF NOT EXISTS public.osp_financial_projects (
  project_code text PRIMARY KEY,
  project_name text NOT NULL,
  client_name text NOT NULL,
  agent_type text NOT NULL CHECK (agent_type IN ('4', '5')),
  billing_condition text NOT NULL,
  owner_name text NOT NULL,
  project_status text NOT NULL,
  poc_start date,
  billing_start date,
  UNIQUE (project_code, agent_type)
);

-- Empty server/campaign identifies a client-wide assignment for this product.
CREATE TABLE IF NOT EXISTS public.osp_financial_project_links (
  reported_client text NOT NULL CHECK (reported_client <> '' AND reported_client = lower(btrim(reported_client))),
  agent_type text NOT NULL,
  server_key text NOT NULL DEFAULT '' CHECK (server_key = lower(btrim(server_key))),
  campaign_id text NOT NULL DEFAULT '',
  project_code text NOT NULL,
  CHECK ((server_key = '') = (campaign_id = '')),
  PRIMARY KEY (reported_client, agent_type, server_key, campaign_id),
  FOREIGN KEY (project_code, agent_type) REFERENCES public.osp_financial_projects (project_code, agent_type)
);

CREATE OR REPLACE VIEW public.osp_financial_project_daily AS
WITH reported AS (
  SELECT f.*, coalesce(c.display_name, c.name, f.cliente) AS reported_client
  FROM public.osp_financial_resolved f
  LEFT JOIN public.clients c ON c.id = f.resolved_client_id
  WHERE f.included_in_reporting
), assigned AS (
  SELECT r.data, r.reported_client, r.virtual_agent_type_id AS agent_type,
         r.valor_tarifado, r.chamadas_tarifadas,
         coalesce(campaign.project_code, client_link.project_code) AS project_code
  FROM reported r
  LEFT JOIN public.osp_financial_project_links campaign
    ON campaign.reported_client = lower(btrim(r.reported_client))
   AND campaign.agent_type = r.virtual_agent_type_id
   AND campaign.server_key <> '' AND campaign.server_key = lower(btrim(r.nome_servidor))
   AND campaign.campaign_id = r.campaign_id
  LEFT JOIN public.osp_financial_project_links client_link
    ON client_link.reported_client = lower(btrim(r.reported_client))
   AND client_link.agent_type = r.virtual_agent_type_id
   AND client_link.server_key = '' AND client_link.campaign_id = ''
)
SELECT data, project_code, agent_type,
       CASE WHEN project_code IS NULL THEN reported_client END AS unlinked_client,
       sum(valor_tarifado) AS cost, sum(chamadas_tarifadas) AS calls
FROM assigned
GROUP BY data, project_code, agent_type, CASE WHEN project_code IS NULL THEN reported_client END;
