import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";
import type { FinancialRow } from "@/lib/financial";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const response=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
export async function GET(){
  if((await getSessionUser())?.role!=="ADMIN")return response({error:"Acesso restrito."},403);
  try{
    const result=await query<FinancialRow & {updatedAt:string}>(`SELECT cliente AS client, nome_servidor AS server, to_char(data,'YYYY-MM-DD') AS date,
      logados::double precision AS logged, campaign_id AS "campaignId", nome_campanha AS campaign,
      virtual_agent_type_id AS agent, chamadas_tarifadas::double precision AS calls,
      valor_tarifado::double precision AS cost, data_hora_carga::text AS "updatedAt"
      FROM osp_financial_billing ORDER BY data,cliente,nome_servidor,campaign_id,virtual_agent_type_id`);
    const updatedAt=result.rows.reduce<string|null>((latest,r)=>!latest||Date.parse(r.updatedAt)>Date.parse(latest)?r.updatedAt:latest,null);
    const rows=result.rows.map(({updatedAt:stamp,...row})=>{void stamp;return row;});
    return response({rows,updatedAt});
  }catch{return response({error:"Base financeira indisponível. Verifique a migration 0019."},503);}
}
