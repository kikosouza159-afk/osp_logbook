import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const response=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
const validDate=(s:unknown):s is string=>typeof s==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const uuid=(s:unknown):s is string=>typeof s==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
export async function GET(){
  if((await getSessionUser())?.role!=="ADMIN")return response({error:"Acesso restrito."},403);
  try{
    const [pairs,starts,sources,campaigns,servers]=await Promise.all([
      query(`SELECT c.id::text AS "clientId",COALESCE(c.display_name,c.name) AS client,p.id::text AS "productId",CASE p.code WHEN 'LOCATOR' THEN '4' ELSE '5' END AS agent,
        c.active AS active FROM client_products cp JOIN clients c ON c.id=cp.client_id JOIN products p ON p.id=cp.product_id WHERE p.code IN ('LOCATOR','ADA') ORDER BY c.name,p.code`),
      query(`SELECT s.client_id::text AS "clientId",s.product_id::text AS "productId",COALESCE(c.display_name,c.name) AS client,CASE p.code WHEN 'LOCATOR' THEN '4' ELSE '5' END AS agent,
        to_char(s.start_date,'YYYY-MM-DD') AS date,COALESCE(to_char(s.poc_start,'YYYY-MM-DD'),'') AS "pocStart",COALESCE(to_char(s.poc_end,'YYYY-MM-DD'),'') AS "pocEnd",s.scope_note AS note
        FROM osp_financial_billing_start s JOIN clients c ON c.id=s.client_id JOIN products p ON p.id=s.product_id ORDER BY s.start_date,c.name`),
      query(`WITH origins AS (SELECT lower(trim(cliente)) AS source,virtual_agent_type_id AS agent,min(cliente) AS label,count(*)::int AS records FROM osp_financial_resolved WHERE NOT shared_environment AND NOT EXISTS(SELECT 1 FROM osp_financial_server_map sm WHERE sm.source_host=osp_financial_resolved.source_host AND sm.agent_type=osp_financial_resolved.virtual_agent_type_id) GROUP BY 1,2)
        SELECT o.*,m.client_id::text AS "clientId",m.product_id::text AS "productId",COALESCE(c.display_name,c.name) AS client
        FROM origins o LEFT JOIN osp_financial_client_map m ON m.source_client=o.source AND m.agent_type=o.agent LEFT JOIN clients c ON c.id=m.client_id ORDER BY m.client_id IS NOT NULL,o.label,o.agent`),
      query(`SELECT lower(trim(f.nome_servidor)) AS "serverKey",min(f.nome_servidor) AS server,f.campaign_id AS "campaignId",f.virtual_agent_type_id AS agent,
        max(f.nome_campanha) AS campaign,count(*)::int AS records,sum(f.valor_tarifado)::double precision AS cost,
        cm.client_id::text AS "clientId",cm.product_id::text AS "productId",c.display_name AS client
        FROM osp_financial_resolved f LEFT JOIN osp_financial_campaign_map cm ON cm.server_key=lower(trim(f.nome_servidor)) AND cm.campaign_id=f.campaign_id AND cm.agent_type=f.virtual_agent_type_id
        LEFT JOIN clients c ON c.id=cm.client_id WHERE f.shared_environment GROUP BY 1,3,4,8,9,10 ORDER BY 1,3,4`),
      query(`SELECT host(sm.source_host) AS ip,sm.agent_type AS agent,c.display_name AS client FROM osp_financial_server_map sm JOIN clients c ON c.id=sm.client_id ORDER BY 1,2`)
    ]);
    return response({pairs:pairs.rows,starts:starts.rows,sources:sources.rows,campaigns:campaigns.rows,servers:servers.rows});
  }catch{return response({error:"Não foi possível carregar as configurações financeiras."},503);}
}
export async function POST(request:Request){
  const user=await getSessionUser();
  if(user?.role!=="ADMIN")return response({error:"Acesso restrito."},403);
  const origin=request.headers.get("origin");
  if(!origin||(origin!==new URL(request.url).origin&&origin!=="https://"+request.headers.get("host"))||request.headers.get("sec-fetch-site")==="cross-site")return response({error:"Origem inválida."},403);
  if(!request.headers.get("content-type")?.includes("application/json"))return response({error:"Formato inválido."},400);
  let b;try{b=await request.json();}catch{return response({error:"JSON inválido."},400);}
  if(!b||typeof b!=="object"||Array.isArray(b))return response({error:"Dados inválidos."},400);
  const {action,clientId,productId,date,previousDate,pocStart,pocEnd,note,source,agent,serverKey,campaignId}=b;
  if(action==="excludeCampaign"){
    if(typeof serverKey!=="string"||typeof campaignId!=="string"||typeof agent!=="string")return response({error:"Campanha inválida."},400);
    try{await query("DELETE FROM osp_financial_campaign_map WHERE server_key=$1 AND campaign_id=$2 AND agent_type=$3",[serverKey,campaignId,agent]);return response({ok:true});}catch{return response({error:"Não foi possível excluir o vínculo."},503);}
  }
  if(!uuid(clientId)||!uuid(productId))return response({error:"Selecione cliente e produto da matriz."},400);
  try{
    if(action==="remove"){
      if(!validDate(date))return response({error:"Data inválida."},400);
      const removed=await query("DELETE FROM osp_financial_billing_start WHERE client_id=$1 AND product_id=$2 AND start_date=$3::date RETURNING start_date",[clientId,productId,date]);
      return removed.rowCount?response({ok:true}):response({error:"Marco não encontrado."},404);
    }
    const pair=await query<{code:string}>(`SELECT p.code FROM client_products cp JOIN products p ON p.id=cp.product_id WHERE cp.client_id=$1 AND cp.product_id=$2 AND p.code IN ('LOCATOR','ADA')`,[clientId,productId]);
    if(!pair.rowCount)return response({error:"Produto não cadastrado para o cliente na matriz."},400);
    if(action==="mapCampaign"){
      if(typeof serverKey!=="string"||serverKey.length>256||typeof campaignId!=="string"||campaignId.length>100||agent!==(pair.rows[0].code==="LOCATOR"?"4":"5"))return response({error:"Campanha ou produto incompatível."},400);
      const result=await query(`INSERT INTO osp_financial_campaign_map(server_key,campaign_id,agent_type,client_id,product_id)
        SELECT $1,$2,$3,$4::uuid,$5::uuid WHERE EXISTS(SELECT 1 FROM osp_financial_resolved WHERE shared_environment AND lower(trim(nome_servidor))=$1 AND campaign_id=$2 AND virtual_agent_type_id=$3)
        ON CONFLICT(server_key,campaign_id,agent_type) DO UPDATE SET client_id=excluded.client_id,product_id=excluded.product_id RETURNING campaign_id`,[serverKey,campaignId,agent,clientId,productId]);
      return result.rowCount?response({ok:true}):response({error:"Campanha não encontrada."},404);
    }
    if(action==="map"){
      if(typeof source!=="string"||source.length>512||!source||agent!==(pair.rows[0].code==="LOCATOR"?"4":"5"))return response({error:"Origem ou produto incompatível."},400);
      const result=await query(`INSERT INTO osp_financial_client_map(source_client,agent_type,client_id,product_id)
        SELECT $1,$2,$3::uuid,$4::uuid WHERE EXISTS (SELECT 1 FROM osp_financial_resolved WHERE NOT shared_environment AND lower(trim(cliente))=$1 AND virtual_agent_type_id=$2)
        ON CONFLICT(source_client,agent_type) DO UPDATE SET client_id=excluded.client_id,product_id=excluded.product_id RETURNING source_client`,[source,agent,clientId,productId]);
      return result.rowCount?response({ok:true}):response({error:"Origem não encontrada na base financeira."},404);
    }
    if(action!=="save"||!validDate(date)||(previousDate!==null&&!validDate(previousDate))||!(pocStart===""||validDate(pocStart))||!(pocEnd===""||validDate(pocEnd))||typeof note!=="string"||note.length>500)return response({error:"Preencha datas válidas e uma observação de até 500 caracteres."},400);
    if((pocStart&&pocStart>date)||(pocEnd&&pocEnd>date)||(pocStart&&pocEnd&&pocStart>pocEnd))return response({error:"As datas da POC devem preceder ou coincidir com o início comercial, em ordem cronológica."},400);
    const values=[clientId,productId,date,pocStart||null,pocEnd||null,note.trim(),user.id];
    const saved=previousDate===null?await query(`INSERT INTO osp_financial_billing_start(client_id,product_id,start_date,poc_start,poc_end,scope_note,updated_by)
      VALUES($1,$2,$3::date,$4::date,$5::date,$6,$7) ON CONFLICT DO NOTHING RETURNING start_date`,values):
      await query(`UPDATE osp_financial_billing_start SET start_date=$3::date,poc_start=$4::date,poc_end=$5::date,scope_note=$6,updated_by=$7,updated_at=now() WHERE client_id=$1 AND product_id=$2 AND start_date=$8::date RETURNING start_date`,[...values,previousDate]);
    return saved.rowCount?response({ok:true}):response({error:"Marco já existente ou alterado por outro usuário. Atualize a lista."},409);
  }catch(e){if((e as {code?:string})?.code==="23505")return response({error:"Já existe um marco nesta data para este cliente/produto."},409);return response({error:"Não foi possível salvar. Nenhum valor tarifado foi alterado."},503);}
}
