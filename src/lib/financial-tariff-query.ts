import { query } from "./db";
import type { TariffDay, TariffProject, TariffReport } from "./financial-tariffs";

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
  return { year, years, projects: catalog.rows, days: daily.rows };
}
