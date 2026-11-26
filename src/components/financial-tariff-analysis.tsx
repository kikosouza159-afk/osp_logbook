"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { formatTariff, monthNames, type TariffAmount, type TariffCampaignDay, type TariffLine } from "@/lib/financial-tariffs";

export type AnalysisSelection = {name: string; lines: TariffLine[]};
const pad = (n: number) => String(n).padStart(2,"0");
const keyFor = (r: TariffCampaignDay) => r.code ?? JSON.stringify([r.unlinkedClient,r.agent]);
const money = (cost: bigint) => formatTariff({cost,calls:0n},"cost");
function add(a: TariffAmount, r: TariffCampaignDay) { a.cost+=BigInt(r.costUnits); a.calls+=BigInt(r.calls); }
function blank(): TariffAmount {return {cost:0n,calls:0n};}

export function TariffAnalysis({selection,campaigns,year,first,initialMonth,onClose}:{
  selection: AnalysisSelection | null; campaigns: TariffCampaignDay[]; year:number; first:number;
  initialMonth:string | null; onClose:()=>void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [month,setMonth] = useState("");
  const [campaign,setCampaign] = useState("");
  const keys = useMemo(() => new Set(selection?.lines.map(l=>l.key) ?? []),[selection]);
  const rows = useMemo(() => campaigns.filter(r=>keys.has(keyFor(r)) && r.date>=year+"-"+pad(first)),[campaigns,keys,year,first]);
  const latest = rows.reduce((last,r)=>r.date.slice(0,7)>last?r.date.slice(0,7):last,"");
  useEffect(()=>{
    const el=dialog.current;
    if(selection && el && !el.open) el.showModal();
    if(!selection && el?.open) el.close();
  },[selection]);
  const effectiveMonth = month && month.startsWith(year+"-") && Number(month.slice(5))>=first ? month : initialMonth ?? (latest || year+"-"+pad(first));
  const monthly = useMemo(()=>rows.filter(r=>r.date.startsWith(effectiveMonth)),[rows,effectiveMonth]);
  const groups = useMemo(()=>{
    const map = new Map<string,{key:string; name:string; id:string;server:string; amount:TariffAmount}>();
    for(const r of monthly){
      const k=JSON.stringify([r.server,r.campaignId,r.agent]);
      let item=map.get(k);
      if(!item){item={key:k,name:r.campaignName,id:r.campaignId,server:r.server,amount:blank()};map.set(k,item);}
      add(item.amount,r);
    }
    return [...map.values()].sort((a,b)=>a.amount.cost===b.amount.cost?0:a.amount.cost>b.amount.cost?-1:1);
  },[monthly]);
  const selected=groups.some(g=>g.key===campaign)?campaign:"";
  const daily = useMemo(()=>{
    const map=new Map<string,TariffAmount>();
    for(const r of monthly){
      if(selected && JSON.stringify([r.server,r.campaignId,r.agent])!==selected)continue;
      let a=map.get(r.date);if(!a){a=blank();map.set(r.date,a);}add(a,r);
    }
    return map;
  },[monthly,selected]);
  const total=blank();for(const a of daily.values()){total.cost+=a.cost;total.calls+=a.calls;}
  const count=new Date(Date.UTC(year,Number(effectiveMonth.slice(5)),0)).getUTCDate();
  const days=Array.from({length:count},(_,i)=>({date:effectiveMonth+"-"+pad(i+1),day:i+1}));
  const values=days.map(d=>Number(daily.get(d.date)?.cost??0n)/1e8);
  const lo=Math.min(0,...values),hi=Math.max(0,...values),range=hi-lo||1;
  const scale=(v:number)=> 150-(v-lo)/range*120;
  const zero=scale(0);
  function close(){setMonth("");setCampaign("");onClose();}
  return <dialog ref={dialog} className="tariff-analysis" aria-labelledby="tariff-analysis-title" onCancel={e=>{e.preventDefault();close();}}>
    {selection && <>
      <header><div><small>FINANCEIRO / ANÁLISE DIÁRIA</small><h2 id="tariff-analysis-title">{selection.name}</h2></div>
        <button type="button" className="btn btn-secondary" aria-label="Fechar análise" onClick={close}><X size={20}/></button></header>
      <div className="tariff-analysis-controls"><label>Mês<select className="select" value={effectiveMonth} onChange={e=>{setMonth(e.target.value);setCampaign("");}}>
        {monthNames.slice(first-1).map((name,i)=><option key={name} value={year+"-"+pad(first+i)}>{name} / {year}</option>)}
      </select></label><label>Campanha<select className="select" value={selected} onChange={e=>setCampaign(e.target.value)}>
        <option value="">Todas as campanhas</option>{groups.map(g=><option key={g.key} value={g.key}>{g.id} · {g.name} ({g.server})</option>)}
      </select></label></div>
      <div className="tariff-analysis-kpis">
        <div><small>Valor tarifado</small><strong>{money(total.cost)}</strong></div>
        <div><small>Média por dia com registro</small><strong>{daily.size?money(total.cost/BigInt(daily.size)):"—"}</strong></div>
        <div><small>Chamadas tarifadas</small><strong>{formatTariff(total,"calls")}</strong></div>
        <div><small>Campanhas no mês</small><strong>{groups.length}</strong></div>
      </div>
      <h3>Evolução do valor tarifado por dia</h3>
      {!daily.size ? <p>Sem registros para o período selecionado.</p> : <div className="tariff-analysis-graph">
        <svg viewBox="0 0 850 188" role="img" aria-label="Gráfico de barras de valor tarifado por dia">
          {[0,.5,1].map(f=>{const v=lo+f*range;return <g key={f}><line x1="90" y1={scale(v)} x2="840" y2={scale(v)} stroke="currentColor" opacity=".15"/><text x="84" y={scale(v)+4} textAnchor="end" fontSize="10" fill="currentColor">{v.toLocaleString("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0})}</text></g>;})}
          {days.map((d,i)=>{const a=daily.get(d.date),v=values[i],w=750/count,x=90+i*w;return <g key={d.date}>
            {a && <rect x={x+2} y={Math.min(scale(v),zero)} width={Math.max(1,w-4)} height={Math.max(1,Math.abs(scale(v)-zero))} rx="2" fill="#fb5c28"><title>{d.date.split("-").reverse().join("/")}: {money(a.cost)}</title></rect>}
            <text x={x+w/2} y="168" textAnchor="middle" fontSize="10" fill="currentColor">{d.day}</text>
          </g>;})}
        </svg><small>Valores em R$ · Passe o mouse sobre as barras para consultar o valor diário. Dias sem registro não têm barra.</small>
      </div>}
      <h3>Campanhas do mês <small>· clique para filtrar o gráfico</small></h3>
      <div className="tariff-analysis-campaigns"><table><thead><tr><th>Campanha / Servidor</th><th>Chamadas</th><th>Valor tarifado</th></tr></thead><tbody>
        {groups.map(g=><tr key={g.key} className={selected===g.key?"is-selected":""}><td><button type="button" aria-pressed={selected===g.key} onClick={()=>setCampaign(selected===g.key?"":g.key)}>{g.id} · {g.name}<small>{g.server}</small></button></td>
          <td>{formatTariff(g.amount,"calls")}</td><td>{money(g.amount.cost)}</td></tr>)}
        {!groups.length && <tr><td colSpan={3}>Nenhuma campanha no período.</td></tr>}
      </tbody></table></div>
    </>}
  </dialog>;
}
