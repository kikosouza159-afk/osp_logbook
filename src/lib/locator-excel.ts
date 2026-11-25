export type Daily = {
  server: string; date: string; campaignId: string; campaign: string;
  client: string; mappingStatus: "RESOLVED" | "UNRESOLVED";
  agentType: number | null; mailing: number | null; mailingDate: string | null;
  logged: number; attempts: number; answered: number;
};
const normal = (v:unknown) => String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
const aliases = {
  date:["data","date","dia"], client:["cliente","client","nomecliente"],
  server:["servidor","nomeservidor","server","ip","host","sourcehost"],
  campaignId:["campaignid","idcampanha","campanhaid","id"],
  campaign:["nomecampanha","campanha","campaign","description","descricao"],
  agentType:["virtualagenttypeid","tipo","tipodeagente","agenttype","produto"],
  mailing:["mailing","mailingmedio","totalrecordsimported"],
  mailingDate:["mailingdata","datamailing","mailingsourcedate"],
  logged:["logados","hc","logadosmedios","logged"],
  attempts:["tentativas","discado","discagens","attempts"],
  answered:["atendidas","atendimento","atendimentos","contato","answered"]
} as const;
type Field=keyof typeof aliases;
const required:Field[]=["date","client","campaign","mailing","logged","attempts","answered"];
const blank=(v:unknown)=>v==null||(typeof v==="string"&&!v.trim());
function parseDate(v:unknown):string|null{
  if(blank(v))return null;
  let d:string;
  if(v instanceof Date){if(!Number.isFinite(v.getTime()))throw Error("data inválida");d=v.toISOString().slice(0,10);}
  else if(typeof v==="number"&&Number.isInteger(v)&&v>=61&&v<=2958465){d=new Date(Date.UTC(1899,11,30)+v*86400000).toISOString().slice(0,10);}
  else{const s=String(v).trim();const m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);d=m?m[3]+"-"+m[2].padStart(2,"0")+"-"+m[1].padStart(2,"0"):s;}
  if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d)throw Error("data inválida: "+String(v));
  return d;
}
function count(v:unknown,label:string,nullable=false):number|null{
  if(blank(v)){if(nullable)return null;throw Error(label+" não informado");}
  // Accept numbers and unambiguous Brazilian thousands/decimal notation.
  const s=String(v).trim();
  const n=typeof v==="number"?v:/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)?Number(s.replace(/\./g,"").replace(",",".")):/^\d+(,\d+)?$/.test(s)?Number(s.replace(",",".")):/^\d+\.\d+$/.test(s)?Number(s):NaN;
  if(!Number.isSafeInteger(n)||n<0)throw Error(label+" precisa ser um inteiro não negativo");
  return n;
}
function parseType(v:unknown):number|null{
  if(blank(v))return null;
  const s=normal(v);if(s==="locator")return 4;if(s==="ada")return 5;if(s==="ad")return 3;if(s==="humano")return 0;
  if(/^\d+$/.test(String(v).trim()))return count(v,"Tipo");
  throw Error("Tipo de agente inválido; use o ID ou Locator/ADA/AD/Humano");
}
export const templateHeaders=["Data","Cliente","Nome_Servidor","CampaignId","NomeCampanha","VirtualAgentTypeId","Mailing","Logados","Tentativas","Atendidas","MailingData"];
export function parseOpportunityRows(input:unknown[][]):Daily[]{
  const first=input.findIndex(row=>row.some(v=>!blank(v)));
  if(first<0)throw Error("Planilha vazia.");
  if(input.length-first>50001)throw Error("Limite de 50 mil registros por planilha.");
  const header=input[first].map(normal);
  const indexes=Object.fromEntries(Object.entries(aliases).map(([key,options])=>{
    const matches=header.map((h,i)=>({h,i})).filter(({h})=>(options as readonly string[]).includes(h));
    if(matches.length>1)throw Error("Colunas ambíguas para "+key+". Mantenha apenas uma.");
    return [key,matches[0]?.i??-1];
  })) as Record<Field,number>;
  const missing=required.filter(k=>indexes[k]<0);
  if(missing.length)throw Error("Colunas obrigatórias ausentes: "+missing.map(k=>aliases[k][0]).join(", ")+". Baixe o modelo.");
  const rows:Daily[]=[];const seen=new Set<string>();const identities=new Map<string,string>();
  for(let i=first+1;i<input.length;i++){
    const r=input[i];if(r.every(blank))continue;
    const get=(k:Field)=>indexes[k]<0?null:r[indexes[k]];
    try{
      const date=parseDate(get("date"));if(!date)throw Error("Data não informada");
      const client=String(get("client")??"").trim(),campaign=String(get("campaign")??"").trim();
      if(!client||!campaign)throw Error("Cliente e NomeCampanha são obrigatórios");
      const server=String(get("server")??"").trim()||"Excel";
      const campaignId=String(get("campaignId")??"").trim()||campaign;
      const agentType=parseType(get("agentType"));
      const mailing=count(get("mailing"),"Mailing",true),logged=count(get("logged"),"Logados")!,attempts=count(get("attempts"),"Tentativas")!,answered=count(get("answered"),"Atendidas")!;
      if(answered>attempts)throw Error("Atendidas não pode superar Tentativas");
      const key=JSON.stringify([server,client,campaignId].map(v=>v.toLocaleLowerCase("pt-BR")));
      const dayKey=key+"|"+date;
      if(seen.has(dayKey))throw Error("registro duplicado para cliente/servidor/campanha/dia");
      const identity=JSON.stringify([server,client,campaignId,agentType]);
      if(identities.has(key)&&identities.get(key)!==identity)throw Error("identificação ou tipo inconsistente para a mesma campanha");
      identities.set(key,identity);seen.add(dayKey);
      rows.push({server,date,campaignId,campaign,client,mappingStatus:"RESOLVED",agentType,mailing,mailingDate:parseDate(get("mailingDate")),logged,attempts,answered});
    }catch(e){throw Error("Linha "+(i+1)+": "+(e instanceof Error?e.message:String(e)));}
  }
  if(!rows.length)throw Error("Nenhum registro encontrado abaixo do cabeçalho.");
  return rows;
}
