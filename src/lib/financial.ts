export type FinancialRow = { client:string; environment?:string; lifecycle?: "POC_SEM_APROVACAO"|"SEM_POC"|null; sourceClient?:string; clientId?:string|null; server:string; date:string; logged:number; campaignId:string; campaign:string; agent:string; calls:number; cost:number };
export type BillingStart = {clientId:string;client:string;agent:string;date:string;note:string};
export type FinancialSnapshot = { rows:FinancialRow[]; updatedAt:string|null; billingStarts?:BillingStart[] };
export const money = (v:number) => v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
export const integer = (v:number) => v.toLocaleString("pt-BR",{maximumFractionDigits:0});
export const unit = (v:number|null) => v===null ? "—" : v.toLocaleString("pt-BR",{style:"currency",currency:"BRL",minimumFractionDigits:4,maximumFractionDigits:4});
export const sum = (rows:FinancialRow[]) => {
  const cost = rows.reduce((n,r)=>n+r.cost,0);
  const calls = rows.reduce((n,r)=>n+r.calls,0);
  return {cost,calls,unit:calls>0?cost/calls:null,days:new Set(rows.map(r=>r.date)).size};
};
export const group = (rows:FinancialRow[], key:(r:FinancialRow)=>string) => {
  const groups = new Map<string,FinancialRow[]>();
  rows.forEach(r=>{const k=key(r);const a=groups.get(k);if(a)a.push(r);else groups.set(k,[r]);});
  return Array.from(groups,([label,items])=>({label,items,...sum(items)}));
};

// Financial presentation only: preserve the original matrix client ID for billing dates.
export const financialClientName = (name:string) => /^Rede Brasil(?: P[45])?$/i.test(name.trim()) ? "Rede Brasil" : /^Energisa(?: - (?:Cobrança|SDR|Vendas))?$/i.test(name.trim()) ? "Energisa" : /^setra$/i.test(name.trim()) ? "Setra" : name;
export function consolidateFinancialRow(r:FinancialRow):FinancialRow {
  const client=financialClientName(r.client);
  if(client==="Energisa")return {...r,client,environment:r.client==="Energisa - Cobrança"?"Cobrança":/ - (SDR|Vendas)$/i.test(r.client)?"Vendas":"A definir"};
  if(client!=="Rede Brasil")return client===r.client?r:{...r,client};
  const server=r.server.trim().toUpperCase();
  const environment=server==="OLOSRBRSPODTB32"?"P4":server==="OLOSRBRSPODTB42"?"P5":/ P4$/i.test(r.client)?"P4":/ P5$/i.test(r.client)?"P5":server==="OLOSRBRSPODTB12"?"Histórico / P2":"Histórico / não identificado";
  return {...r,client,environment};
}
