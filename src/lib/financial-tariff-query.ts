import { query } from "./db";
import type { TariffCampaignDay, TariffDay, TariffProject, TariffReport } from "./financial-tariffs";

export async function getTariffReport(requestedYear?: string): Promise<TariffReport> {
  const [activityYears, catalog] = await Promise.all([
    query<{year: number}>(`
      SELECT DISTINCT extract(year FROM data)::int AS year
      FROM osp_financial_resolved WHERE included_in_reporting ORDER BY year DESC`),
    query<TariffProject>(`
      SELECT project_code AS code, project_name AS name, client_name AS client, agent_type AS agent,
             billing_condition AS condition, owner_name AS owner, project_status AS status,
             to_char(poc_start, 'YYYY-MM-DD') AS "pocStart", to_char(billing_start, 'YYYY-MM-DD') AS "billingStart"
      FROM osp_financial_projects ORDER BY client_name, project_code`),
  ]);
  const currentYear = Number(new Intl.DateTimeFormat("pt-BR", {year: "numeric", timeZone: "America/Sao_Paulo"}).format(new Date()));
  const recordedYears = activityYears.rows.map(row => row.year);
  const years = [...new Set([currentYear, ...recordedYears])].sort((a, b) => b - a);
  const year = years.includes(Number(requestedYear)) ? Number(requestedYear) : recordedYears[0] ?? currentYear;
  const daily = await query<TariffDay>(`
    SELECT to_char(data, 'YYYY-MM-DD') AS date, project_code AS code, unlinked_client AS "unlinkedClient",
           agent_type AS agent, (cost * 100000000)::numeric(38,0)::text AS "costUnits", calls::text AS calls
    FROM osp_financial_project_daily
    WHERE data >= make_date($1::int, 1, 1) AND data < make_date($1::int + 1, 1, 1)`, [year]);
  const campaigns = await query<TariffCampaignDay>(`
    WITH reported AS (
      SELECT f.*, coalesce(c.display_name, c.name, f.cliente) AS reported_client
      FROM osp_financial_resolved f LEFT JOIN clients c ON c.id=f.resolved_client_id
      WHERE f.included_in_reporting AND f.data >= make_date($1::int,1,1)
        AND f.data < make_date($1::int+1,1,1)
    ), assigned AS (
      SELECT r.*, coalesce(campaign.project_code, client_link.project_code) AS code
      FROM reported r
      LEFT JOIN osp_financial_project_links campaign
        ON campaign.reported_client=lower(btrim(r.reported_client))
        AND campaign.agent_type=r.virtual_agent_type_id
        AND campaign.server_key<>'' AND campaign.server_key=lower(btrim(r.nome_servidor))
        AND campaign.campaign_id=r.campaign_id
      LEFT JOIN osp_financial_project_links client_link
        ON client_link.reported_client=lower(btrim(r.reported_client))
        AND client_link.agent_type=r.virtual_agent_type_id
        AND client_link.server_key='' AND client_link.campaign_id=''
    )
    SELECT to_char(data,'YYYY-MM-DD') AS date, code,
      CASE WHEN code IS NULL THEN reported_client END AS "unlinkedClient",
      virtual_agent_type_id AS agent, nome_servidor AS server, campaign_id AS "campaignId",
      coalesce(max(nome_campanha), campaign_id) AS "campaignName",
      (sum(valor_tarifado)*100000000)::numeric(38,0)::text AS "costUnits",
      sum(chamadas_tarifadas)::text AS calls
    FROM assigned GROUP BY data,code,CASE WHEN code IS NULL THEN reported_client END,
      virtual_agent_type_id,nome_servidor,campaign_id
  `,[year]);
  return { year, years, projects: catalog.rows, days: daily.rows, campaigns: campaigns.rows };
}
