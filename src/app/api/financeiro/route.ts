import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";
import type { FinancialRow } from "@/lib/financial";
import readXlsxFile from "read-excel-file/node";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const response=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
async function authorized(){return (await getSessionUser())?.role==="ADMIN";}
export async function GET(){
  if(!await authorized())return response({error:"Acesso restrito."},403);
  try{
    const result=await query<{records:FinancialRow[];updated_at:Date}>("SELECT records,updated_at FROM osp_financial_snapshot WHERE id=1");
    const item=result.rows[0];
    return response({rows:item?.records??[],updatedAt:item?.updated_at??null});
  }catch{return response({error:"Base financeira indisponível. Verifique a migration 0018."},503);}
}
export async function POST(request:Request){
  const user=await getSessionUser();
  if(user?.role!=="ADMIN")return response({error:"Acesso restrito."},403);
  const origin=request.headers.get("origin");
  if(origin && origin!==new URL(request.url).origin && origin!==("https://"+request.headers.get("host")))return response({error:"Origem inválida."},403);
  if(Number(request.headers.get("content-length")||0)>8_000_000)return response({error:"Arquivo excede 8 MB."},413);
  let rows:FinancialRow[];
  try{
    const data=await request.formData();
    const file=data.get("file");
    if(!(file instanceof File)||file.size>7_500_000||!file.name.toLowerCase().endsWith(".xlsx"))return response({error:"Selecione um XLSX de até 7,5 MB."},400);
    const raw=await readXlsxFile(Buffer.from(await file.arrayBuffer()));
    const required=["Cliente","Nome_Servidor","DATA","Logados","CampaignId","NomeCampanha","VirtualAgentTypeId","Chamadas_Tarifadas","Valor_Tarifado"];
    const header=raw[0]?.map(x=>String(x??"").trim().toLowerCase())??[];
    const idx=required.map(h=>header.indexOf(h.toLowerCase()));
    if(idx.some(i=>i<0)||raw.length<2||raw.length>100001)return response({error:"Colunas obrigatórias ausentes, planilha vazia ou acima de 100 mil registros."},400);
    const seen=new Set<string>();
    rows=raw.slice(1).filter(r=>r.some(x=>x!==null&&x!=="")).map((r,i)=>{
      const v=idx.map(n=>r[n]);
      const date=v[2] instanceof Date?v[2].toISOString().slice(0,10):String(v[2]);
      const nums=[v[3],v[7],v[8]].map(Number);
      if(v.some(x=>x===null||x===undefined||x==="")||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||nums.some(x=>!Number.isFinite(x)||x<0)||!Number.isSafeInteger(nums[0])||!Number.isSafeInteger(nums[1]))throw Error("Linha inválida: "+(i+2));
      const row={client:String(v[0]),server:String(v[1]),date,logged:nums[0],campaignId:String(v[4]),campaign:String(v[5]),agent:String(v[6]),calls:nums[1],cost:nums[2]};
      const key=JSON.stringify([row.client,row.server,row.date,row.campaignId,row.agent]);
      if(seen.has(key))throw Error("Chave duplicada na linha "+(i+2));
      seen.add(key);return row;
    });
    if(!rows.length)throw Error("Planilha sem registros.");
  }catch(e){return response({error:e instanceof Error&&/^(Linha inválida|Chave duplicada|Planilha sem)/.test(e.message)?e.message:"Não foi possível ler a planilha. Confira o formato."},400);}
  try{
    const result=await query<{updated_at:Date}>(`INSERT INTO osp_financial_snapshot(id,records,updated_at,updated_by) VALUES(1,$1::jsonb,now(),$2)
    ON CONFLICT(id) DO UPDATE SET records=excluded.records,updated_at=excluded.updated_at,updated_by=excluded.updated_by RETURNING updated_at`,[JSON.stringify(rows),user.id]);
    return response({rows,updatedAt:result.rows[0].updated_at});
  }catch{return response({error:"Não foi possível gravar. A base anterior foi preservada."},503);}
}
