import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";
import type { FinancialRow, BillingStart } from "@/lib/financial";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const response=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
export async function GET(){
  if((await getSessionUser())?.role!=="ADMIN")return response({error:"Acesso restrito."},403);
  try{
    const result=await query<FinancialRow & {updatedAt:string}>(`SELECT COALESCE(c.display_name,c.name,f.cliente) AS client, f.cliente AS "sourceClient", c.id::text AS "clientId", nome_servidor AS server, to_char(data,'YYYY-MM-DD') AS date,
      logados::double precision AS logged, campaign_id AS "campaignId", nome_campanha AS campaign,
      virtual_agent_type_id AS agent, chamadas_tarifadas::double precision AS calls,
      valor_tarifado::double precision AS cost, data_hora_carga::text AS "updatedAt"
      FROM osp_financial_all f LEFT JOIN osp_financial_client_map m ON m.source_client=lower(trim(f.cliente)) AND m.agent_type=f.virtual_agent_type_id LEFT JOIN clients c ON c.id=m.client_id ORDER BY data,f.cliente,nome_servidor,campaign_id,virtual_agent_type_id`);
    const updatedAt=result.rows.reduce<string|null>((latest,r)=>!latest||Date.parse(r.updatedAt)>Date.parse(latest)?r.updatedAt:latest,null);
    const rows=result.rows.map(({updatedAt:stamp,...row})=>{void stamp;return row;});
    const starts=await query<BillingStart>(`SELECT c.id::text AS "clientId",COALESCE(c.display_name,c.name) AS client,
      CASE p.code WHEN 'LOCATOR' THEN '4' WHEN 'ADA' THEN '5' ELSE p.code END AS agent,
      to_char(s.start_date,'YYYY-MM-DD') AS date,s.scope_note AS note
      FROM osp_financial_billing_start s JOIN clients c ON c.id=s.client_id JOIN products p ON p.id=s.product_id ORDER BY s.start_date,c.name`);
    return response({rows,updatedAt,billingStarts:starts.rows});
  }catch{return response({error:"Base financeira indisponível. Verifique a migrations 0019, 0020 e 0021."},503);}
}
