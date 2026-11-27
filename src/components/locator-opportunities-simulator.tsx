"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Users, Target, Gauge, CircleAlert, Download, ChevronDown, SlidersHorizontal, X } from "lucide-react";
import type { Campaign } from "./locator-opportunities";

type Scenario = { spin: string; cpc: string; agreement: string; reduction: string; capacity: string };
const defaults: Scenario = { spin:"", cpc:"29.4", agreement:"4.4", reduction:"35", capacity:"95" };
const fields: { key:keyof Scenario; label:string; min:number; max:number; step:number; hint:string }[] = [
  {key:"spin",label:"Spin Locator (opcional)",min:0,max:10000,step:.1,hint:"Em branco: Spin observado"},
  {key:"cpc",label:"Atendida → CPC (%)",min:0,max:100,step:.1,hint:"Benchmark editável"},
  {key:"agreement",label:"CPC → Acordo (%)",min:0,max:100,step:.1,hint:"Sobre CPC projetados"},
  {key:"reduction",label:"Redução desejada de HC (%)",min:0,max:100,step:1,hint:"Independente do HC mínimo"},
  {key:"capacity",label:"CPC por operador / dia",min:1,max:500,step:1,hint:"Referência: 70 a 120"}
];
const fmt=(n:number|null|undefined,d=0)=>n==null||!Number.isFinite(n)?"—":n.toLocaleString("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d});
const pct=(n:number|null|undefined,d=1)=>n==null?"—":fmt(n,d)+"%";
export const isLocator=(c:Campaign)=>c.agentType===4||c.campaign.toLowerCase().includes("locator");
const valid=(s:Scenario)=>fields.every(f=>f.key==="spin"&&s.spin.trim()===""||s[f.key].trim()!==""&&Number.isFinite(Number(s[f.key]))&&Number(s[f.key])>=f.min&&Number(s[f.key])<=f.max);

export function simulateCampaign(c:Campaign,s:Scenario){
  // The Python v5 source aligns spin and mailing to days with positive mailing.
  const positive=c.daily.filter(r=>r.mailing!=null&&r.mailing>0);
  const totalMail=positive.reduce((a,r)=>a+(r.mailing??0),0);
  const alignedAttempts=positive.reduce((a,r)=>a+r.attempts,0);
  const totalAttempts=c.daily.reduce((a,r)=>a+r.attempts,0);
  const totalAnswered=c.daily.reduce((a,r)=>a+r.answered,0);
  const mail=positive.length?totalMail/positive.length:null;
  const observedSpin=totalMail>0?alignedAttempts/totalMail:null;
  const hit=totalAttempts>0?100*totalAnswered/totalAttempts:null;
  const ok=valid(s);
  const spin=ok?(s.spin.trim()===""?observedSpin:Number(s.spin)):null;
  const attempts=mail!==null&&spin!==null?mail*spin:null;
  const answered=attempts!==null&&hit!==null?attempts*hit/100:null;
  const cpc=answered!==null?answered*Number(s.cpc)/100:null;
  const agreements=cpc!==null?cpc*Number(s.agreement)/100:null;
  const current=Math.ceil(Math.max(0,c.logged));
  const planned=ok?Math.max(0,Math.ceil(current*(1-Number(s.reduction)/100)-1e-9)):null;
  const required=cpc!==null?Math.ceil(cpc/Number(s.capacity)):null;
  const feasible=planned!==null&&required!==null?planned>=required:null;
  const reduced=planned!==null?current-planned:null;
  const utilization=planned!==null&&planned>0&&cpc!==null?100*cpc/(planned*Number(s.capacity)):null;
  return {ok,mail,observedSpin,spin,hit,attempts,answered,cpc,agreements,current,planned,required,feasible,reduced,utilization,validDays:positive.length};
}
function Inputs({scenario,onChange}:{scenario:Scenario;onChange:(key:keyof Scenario,value:string)=>void}){
  return <div className="lo-input-grid lo-sim-inputs">{fields.map(f=><label key={f.key}>{f.label}<input type="number" min={f.min} max={f.max} step={f.step} placeholder={f.key==="spin"?"Spin observado":undefined} value={scenario[f.key]} onChange={e=>onChange(f.key,e.target.value)}/><small>{f.hint}</small></label>)}</div>;
}
function exportRows(items:{c:Campaign;s:Scenario;p:ReturnType<typeof simulateCampaign>}[]){
  const header=["Cliente","Servidor","ID","Campanha","Dias","Dias mailing válido","Mailing médio válido","Spin observado","Spin projetado","Hit %","Tentativas/dia","Atendidas/dia","CPC %","CPC/dia","Acordo %","Acordos/dia","CPC/HC/dia","Redução desejada %","HC atual","HC planejado","HC necessário","HC reduzido","Utilização %","Viabilidade"];
  const quote=(v:string|number|null)=>{let raw=typeof v==="number"?String(v).replace(".",","):String(v??"");if(typeof v==="string"&&/^[\s]*[=+\-@\t\r]/.test(raw))raw="'"+raw;return '"'+raw.replaceAll('"','""')+'"';};
  const rows=items.map(({c,s,p})=>[c.client,c.server,c.campaignId,c.campaign,c.days,p.validDays,p.mail,p.observedSpin,p.spin,p.hit,p.attempts,p.answered,Number(s.cpc),p.cpc,Number(s.agreement),p.agreements,Number(s.capacity),Number(s.reduction),p.current,p.planned,p.required,p.reduced,p.utilization,p.feasible===null?"Sem dados":p.feasible?"Capacidade OK":"HC insuficiente"]);
  const csv="\uFEFF"+[header,...rows].map(row=>row.map(quote).join(";")).join("\r\n");
  const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="locator_simulacoes.csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export function LocatorSimulator({campaigns,allCampaigns,keys,setKeys}:{campaigns:Campaign[];allCampaigns:Campaign[];keys:string[];setKeys:Dispatch<SetStateAction<string[]>>}){
  const [global,setGlobal]=useState<Scenario>(defaults);
  const [overrides,setOverrides]=useState<Record<string,Partial<Scenario>>>({});
  const [expanded,setExpanded]=useState<string[]>([]);
  const [pick,setPick]=useState("");
  const candidates=useMemo(()=>campaigns.filter(c=>!isLocator(c)&&!keys.includes(c.key)),[campaigns,keys]);
  const items=useMemo(()=>allCampaigns.filter(c=>keys.includes(c.key)&&!isLocator(c)).map(c=>{const s={...global,...overrides[c.key]};return {c,s,p:simulateCampaign(c,s)};}),[allCampaigns,keys,global,overrides]);
  const missing=keys.length-items.length;
  const add=(ks:string[])=>setKeys(prev=>[...new Set([...prev,...ks])]);
  const remove=(key:string)=>{setKeys(prev=>prev.filter(k=>k!==key));setOverrides(prev=>{const next={...prev};delete next[key];return next;});setExpanded(prev=>prev.filter(k=>k!==key));};
  const totalCurrent=items.reduce((a,i)=>a+i.p.current,0);
  const totalReduced=items.reduce((a,i)=>a+(i.p.reduced??0),0);
  const invalid=items.filter(i=>!i.p.ok).length;
  const insufficient=items.filter(i=>i.p.feasible===false).length;
  const unknown=items.filter(i=>i.p.feasible===null).length;
  return <div className="lo-sim">
    <article className="lo-panel">
      <div className="lo-section-head"><div><small>CENÁRIOS OPERACIONAIS</small><h2>Qual equipe o Locator precisa?</h2></div><SlidersHorizontal size={22}/></div>
      <p className="lo-fineprint">Mailing válido × Spin × Hit% real → CPC e acordos estimados. Os filtros acima definem o período e as campanhas disponíveis para seleção. As campanhas selecionadas permanecem na comparação ao trocar o filtro de cliente.</p>
      <div className="lo-sim-picker"><label>Adicionar campanha<select value={pick} onChange={e=>setPick(e.target.value)}><option value="">Selecione uma campanha</option>{candidates.map(c=><option key={c.key} value={c.key}>{c.client} · {c.campaign} · {c.campaignId} · {c.server}</option>)}</select></label><button className="lo-btn lo-btn-secondary" disabled={!candidates.some(c=>c.key===pick)} onClick={()=>{add([pick]);setPick("");}}>+ Adicionar</button><button className="lo-btn lo-btn-secondary" disabled={!candidates.some(c=>c.mailing!=null&&c.mailing>0)} onClick={()=>add(candidates.filter(c=>c.mailing!=null&&c.mailing>0).slice(0,5).map(c=>c.key))}>+ Adicionar top 5</button></div>
    </article>
    <article className="lo-panel lo-space">
      <div className="lo-section-head"><div><small>PREMISSAS DO CENÁRIO</small><h2>Parâmetros gerais</h2></div><button className="lo-btn lo-btn-secondary" onClick={()=>{setGlobal(defaults);setOverrides({});}}>Restaurar todas as premissas</button></div>
      <Inputs scenario={global} onChange={(key,value)=>setGlobal(prev=>({...prev,[key]:value}))}/>
      {!valid(global)&&<div className="lo-warning"><CircleAlert size={16}/> Revise os limites dos parâmetros gerais.</div>}
      <p className="lo-fineprint">Recalcula automaticamente. Ajustes individuais prevalecem apenas nos campos editados.</p>
    </article>
    <div className="lo-kpis lo-space">
      <div className="lo-kpi"><div><span>Campanhas na simulação</span><Target size={20}/></div><strong>{fmt(items.length)}</strong><small>Campanhas disponíveis no período</small></div>
      <div className="lo-kpi"><div><span>HC base de referência</span><Users size={20}/></div><strong>{fmt(totalCurrent)}</strong><small>Soma por campanha, sem deduplicação</small></div>
      <div className="lo-kpi"><div><span>HC reduzido no cenário</span><Gauge size={20}/></div><strong>{invalid?"—":fmt(totalReduced)}</strong><small>Redução desejada, sujeita à capacidade</small></div>
      <div className="lo-kpi"><div><span>Planos sem capacidade</span><CircleAlert size={20}/></div><strong>{fmt(insufficient)}</strong><small>{fmt(unknown)} sem dados ou premissas válidas</small></div>
    </div>
    {missing>0&&<div className="lo-warning"><CircleAlert size={16}/> {missing} campanha(s) selecionada(s) não estão disponíveis no período atual.<button className="lo-btn lo-btn-secondary" onClick={()=>setKeys(items.map(i=>i.c.key))}>Limpar ausentes</button></div>}
    <article className="lo-panel">
      <div className="lo-section-head"><div><small>COMPARATIVO BASE × LOCATOR</small><h2>Campanhas em simulação</h2></div><button className="lo-btn lo-btn-secondary" disabled={!items.length||invalid>0} onClick={()=>exportRows(items)}><Download size={16}/> Exportar CSV</button></div>
      {!items.length?<div className="lo-empty">Selecione campanhas no mapa de oportunidades ou adicione nesta aba.</div>:<div className="lo-table-scroll"><table className="lo-table"><thead><tr><th>Campanha / Cliente</th><th>HC atual</th><th>HC planejado</th><th>HC mínimo</th><th>CPC / dia</th><th>Acordos / dia</th><th>HC reduzido</th><th>Capacidade</th><th>Ações</th></tr></thead><tbody>
        {items.map(({c,p})=><tr key={c.key}><td><strong title={c.campaign}>{c.campaign}</strong><small>{c.client} · #{c.campaignId} · {c.server}</small></td><td>{fmt(p.current)}</td><td>{fmt(p.planned)}</td><td>{fmt(p.required)}</td><td>{fmt(p.cpc)}</td><td>{fmt(p.agreements)}</td><td>{fmt(p.reduced)}</td><td><span className={"lo-sim-status "+(p.feasible===true?"good":p.feasible===false?"bad":"neutral")}>{p.feasible===true?"Capacidade OK":p.feasible===false?"HC insuficiente":"Sem dados válidos"}</span></td><td><div className="lo-sim-actions"><button className="lo-detail-btn" aria-expanded={expanded.includes(c.key)} onClick={()=>setExpanded(prev=>prev.includes(c.key)?prev.filter(k=>k!==c.key):[...prev,c.key])}>Detalhar <ChevronDown size={14}/></button><button className="lo-icon-button" aria-label={"Remover "+c.campaign} onClick={()=>remove(c.key)}><X size={15}/></button></div></td></tr>)}
      </tbody></table></div>}
    </article>
    {items.filter(i=>expanded.includes(i.c.key)).map(({c,s,p})=><article key={c.key} className="lo-panel lo-space">
      <div className="lo-section-head"><div><small>SIMULAÇÃO INDIVIDUAL · {c.client} · #{c.campaignId}</small><h2>{c.campaign}</h2></div><button className="lo-btn lo-btn-secondary" onClick={()=>setOverrides(prev=>{const next={...prev};delete next[c.key];return next;})}>Usar premissas gerais</button></div>
      {!c.mapped&&<div className="lo-warning"><CircleAlert size={16}/> Vínculo de cliente pendente. Valide a campanha antes de tomar decisões.</div>}
      {!p.ok&&<div className="lo-warning"><CircleAlert size={16}/> Parâmetros inválidos. Revise os campos.</div>}
      <div className="lo-mini-metrics"><div><small>Hit% observado</small><b>{pct(p.hit,2)}</b></div><div><small>Spin observado (dias válidos)</small><b>{fmt(p.observedSpin,2)}</b></div><div><small>Dias com mailing positivo</small><b>{p.validDays} / {c.days}</b></div><div><small>Tentativas atuais / dia</small><b>{fmt(c.attempts)}</b></div><div><small>Atendidas atuais / dia</small><b>{fmt(c.answered)}</b></div><div><small>HC médio observado</small><b>{fmt(c.logged,1)}</b></div></div>
      <div className="lo-sim-actions lo-space">{[{label:"Conservador",cpc:"20",agreement:"3"},{label:"Referência",cpc:"29.4",agreement:"4.4"},{label:"Otimista",cpc:"35",agreement:"7"}].map(preset=><button key={preset.label} className="lo-btn lo-btn-secondary" onClick={()=>setOverrides(prev=>({...prev,[c.key]:{...prev[c.key],cpc:preset.cpc,agreement:preset.agreement}}))}>{preset.label}</button>)}</div>
      <div className="lo-space"><Inputs scenario={s} onChange={(key,value)=>setOverrides(prev=>({...prev,[c.key]:{...prev[c.key],[key]:value}}))}/></div>
      <div className="lo-funnel lo-space">{[{label:"Mailing",value:p.mail,sub:"Dias com mailing positivo"},{label:"Tentativas",value:p.attempts,sub:"Spin "+fmt(p.spin,2)+"x"},{label:"Atendidas",value:p.answered,sub:"Hit "+pct(p.hit,2)},{label:"CPC",value:p.cpc,sub:s.cpc+"% das atendidas"},{label:"Acordos",value:p.agreements,sub:s.agreement+"% dos CPC"}].map(f=><div className="lo-funnel-step" key={f.label}><span>{f.label}</span><strong>{fmt(f.value)}</strong><small>{f.sub}</small></div>)}</div>
      <div className="lo-hc-results lo-space"><div><small>HC atual</small><strong>{fmt(p.current)}</strong></div><div><small>HC planejado</small><strong>{fmt(p.planned)}</strong></div><div><small>HC mínimo</small><strong>{fmt(p.required)}</strong></div><div className={p.feasible===true?"lo-hc-good":"lo-hc-alert"}><small>Utilização da capacidade diária</small><strong>{pct(p.utilization)}</strong><em>{p.feasible===null?"Sem dados":p.feasible?"Comporta o volume":"Volume acima da capacidade"}</em></div></div>
    </article>)}
    <p className="lo-fineprint">Premissa: Locator transfere CPC estimados. Não há CPC ou acordo real na base atual. As taxas são hipóteses de sensibilidade, não garantia de ganho. HC mínimo = teto(CPC / capacidade); HC planejado = teto(HC atual × (1 − redução)). Os HC por campanha podem se repetir; não representam quadro deduplicado.</p>
  </div>;
}
