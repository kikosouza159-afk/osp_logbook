import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const response = (body: unknown, status = 200) => NextResponse.json(body, {
  status, headers: { "Cache-Control": "no-store" },
});
const validDate = (value: string | null): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

type DataRow = {
  server: string; date: string; campaignId: string; campaign: string;
  client: string; mappingStatus: string; agentType: number | null;
  mailing: number | null; mailingDate: string | null;
  logged: number; attempts: number; answered: number;
};

export async function GET(request: Request) {
  if ((await getSessionUser())?.role !== "ADMIN") return response({ error: "Acesso restrito à gestão." }, 403);
  try {
    const url = new URL(request.url);
    const latest = await query<{ latest: string | null; updated: string | null }>(
      "SELECT max(data)::text AS latest, max(data_hora_carga)::text AS updated FROM osp_locator_opportunity_daily"
    );
    const maxDate = latest.rows[0]?.latest;
    if (!maxDate) return response({ rows: [], updatedAt: null, range: null });
    const startRaw = url.searchParams.get("start");
    const endRaw = url.searchParams.get("end");
    if ((startRaw && !validDate(startRaw)) || (endRaw && !validDate(endRaw))) {
      return response({ error: "Datas inválidas. Use AAAA-MM-DD." }, 400);
    }
    const end = endRaw || maxDate;
    const start = startRaw || new Date(Date.parse(end + "T12:00:00Z") - 29 * 86400000).toISOString().slice(0, 10);
    if (start > end || (Date.parse(end) - Date.parse(start)) / 86400000 > 179) {
      return response({ error: "Selecione um período de até 180 dias." }, 400);
    }
    const data = await query<DataRow>(`
      SELECT host(source_host) AS server, to_char(data,'YYYY-MM-DD') AS date,
        campaign_id AS "campaignId", nome_campanha AS campaign,
        cliente AS client, mapping_status AS "mappingStatus",
        virtual_agent_type_id AS "agentType", mailing::double precision AS mailing,
        to_char(mailing_source_date,'YYYY-MM-DD') AS "mailingDate",
        logados::double precision AS logged,
        tentativas::double precision AS attempts, atendidas::double precision AS answered
      FROM osp_locator_opportunity_daily
      WHERE data BETWEEN $1::date AND $2::date
      ORDER BY data DESC, cliente, campaign_id LIMIT 50001
    `, [start, end]);
    if (data.rows.length > 50000) {
      return response({ error: "Volume acima de 50 mil registros. Reduza o intervalo de datas." }, 413);
    }
    return response({ rows: data.rows, updatedAt: latest.rows[0]?.updated, range: { start, end }, latestDate: maxDate });
  } catch (error) {
    console.error("Locator opportunity endpoint:", error);
    return response({ error: "Base Locator indisponível. Confirme a migration 0028 e o ETL." }, 503);
  }
}
