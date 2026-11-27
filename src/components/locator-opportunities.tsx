"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowDownRight, ArrowUpRight, BarChart3, CheckCircle2,
  ChevronRight, CircleAlert, Crosshair, Download, Filter, Gauge,
  RefreshCw, Search, SlidersHorizontal, Sparkles, Target, Users, X
} from "lucide-react";
import "./locator-opportunities.css";
import { LocatorSimulator, isLocator } from "./locator-opportunities-simulator";

type Daily = {
  server: string; date: string; campaignId: string; campaign: string;
  client: string; mappingStatus: "RESOLVED" | "UNRESOLVED";
  agentType: number | null; mailing: number | null; mailingDate: string | null;
  logged: number; attempts: number; answered: number;
};
export type Campaign = {
  key: string; client: string; server: string; campaign: string; campaignId: string;
  agentType: number | null; mapped: boolean; daily: Daily[]; days: number;
  mailing: number | null; logged: number; attempts: number; answered: number;
  hit: number; spin: number | null; mailingLog: number | null; atendLog: number | null;
  score: number; parts: number[];
};
type ApiData = { rows: Daily[]; range: {start:string;end:string} | null; updatedAt: string | null; latestDate?: string; error?: string };

const fmt = (value: number | null | undefined, decimals=0) =>
  value == null || !Number.isFinite(value) ? "—" :
  value.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
const pct = (value: number | null | undefined, decimals=2) => value == null ? "—" : fmt(value,decimals)+"%";
const clamp = (v:number, min:number, max:number) => Math.min(max,Math.max(min,v));
const unitScore = (v:number | null, ref:number, invert=false) =>
  v == null || !Number.isFinite(v) || v<0 ? 0 : 25 * (invert ? ref/(ref+v) : v/(ref+v));

function summarise(rows:Daily[]):Campaign[] {
  const grouped=new Map<string,Daily[]>();
  for(const row of rows){
    const key=[row.server,row.campaignId,row.client].join("|");
    const current=grouped.get(key); if(current)current.push(row); else grouped.set(key,[row]);
  }
  return [...grouped.entries()].map(([key,daily])=>{
    const n=daily.length;
    const mailingKnown=daily.filter(r=>r.mailing!=null);
    const mailing=mailingKnown.length ? mailingKnown.reduce((a,r)=>a+(r.mailing || 0),0)/mailingKnown.length : null;
    const logged=daily.reduce((a,r)=>a+r.logged,0)/n;
    const attempts=daily.reduce((a,r)=>a+r.attempts,0)/n;
    const answered=daily.reduce((a,r)=>a+r.answered,0)/n;
    const mailingLog=mailing!==null&&logged>0?mailing/logged:null;
    const atendLog=logged>0?answered/logged:null;
    // 25 pontos por dimensão. Curvas monotônicas, sem cortes que escondam oportunidades.
    const eligible=logged>0&&attempts>0&&mailing!==null;
    const parts=eligible ? [
      unitScore(mailingLog,50000/30),
      unitScore(atendLog,100,true),
      unitScore(mailing,50000),
      unitScore(logged,30),
    ] : [0,0,0,0];
    const totalAttempts=daily.reduce((a,r)=>a+r.attempts,0);
    const totalAnswered=daily.reduce((a,r)=>a+r.answered,0);
    return {
      key,client:daily[0].client,server:daily[0].server,campaign:daily[0].campaign,
      campaignId:daily[0].campaignId,agentType:daily[0].agentType,
      mapped:daily.every(r=>r.mappingStatus==="RESOLVED"),daily,days:n,
      mailing,logged,attempts,answered,
      hit:totalAttempts>0?100*totalAnswered/totalAttempts:0,
      spin:mailing!=null&&mailing>0?attempts/mailing:null,
      mailingLog,atendLog,score:parts.reduce((a,b)=>a+b,0),parts,
    };
  }).sort((a,b)=>b.score-a.score);
}
const dimensionNames=["Mailing / Log","Atendidas / Log","Mailing médio","Logados médios"];
const dimensionInfo=["Quanto maior o mailing por logado, maior a nota","Quanto menor o atendimento por logado, maior a nota","Cresce continuamente; referência de 50 mil","Cresce continuamente; referência de 30 HC"];

function downloadCsv(campaigns:Campaign[]){
  const head=["Cliente","Servidor","Campanha","ID","Tipo","Dias","Mailing medio","Logados medios","Tentativas medias","Atendidas medias","Hit %","Spin","Mailing/Log","Atend/Log","Score","Status"];
  const lines=campaigns.map(c=>[
    c.client,c.server,c.campaign,c.campaignId,c.agentType??"",c.days,c.mailing??"",
    c.logged,c.attempts,c.answered,c.hit,c.spin??"",c.mailingLog??"",c.atendLog??"",c.score,
    c.mapped?"Mapeada":"Revisar vínculo",
  ].map(v=>'"'+String(v).replaceAll('"','""')+'"').join(";"));
  const csv="\uFEFF"+[head.join(";"),...lines].join("\r\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");link.href=url;link.download="oportunidades_locator.csv";link.click();URL.revokeObjectURL(url);
}

function ScoreParts({c}:{c:Campaign}){
  return <div className="lo-score-parts">
    {c.parts.map((part,i)=><div className="lo-score-factor" key={dimensionNames[i]}>
      <div className="lo-between"><span>{dimensionNames[i]}</span><b>{fmt(part,1)} / 25</b></div>
      <div className="lo-track"><i style={{width:(part/25*100)+"%"}} /></div>
      <small>{dimensionInfo[i]}</small>
    </div>)}
  </div>;
}

function FunnelStep({label,value,sub}:{label:string;value:number|null;sub:string}){
  return <div className="lo-funnel-step"><span>{label}</span><strong>{fmt(value)}</strong><small>{sub}</small></div>;
}

function Detail({campaign,onClose}:{campaign:Campaign;onClose:()=>void}){
  const [spin,setSpin]=useState(Math.max(0.01,campaign.spin ?? 1));
  const [cpcRate,setCpcRate]=useState(29.4);
  const [agreementRate,setAgreementRate]=useState(4.4);
  const [capacity,setCapacity]=useState(95);
  const [reduction,setReduction]=useState(35);
  useEffect(()=>{const handle=(e:KeyboardEvent)=>{if(e.key==="Escape")onClose();};window.addEventListener("keydown",handle);return()=>window.removeEventListener("keydown",handle);},[onClose]);
  const attempts=campaign.mailing===null?null:campaign.mailing*spin;
  const answered=attempts===null?null:attempts*campaign.hit/100;
  const cpc=answered===null?null:answered*cpcRate/100;
  const agreements=cpc===null?null:cpc*agreementRate/100;
  const actualHc=Math.ceil(campaign.logged);
  const planned=Math.max(0,Math.ceil(actualHc*(1-reduction/100)));
  const required=cpc===null?null:Math.ceil(cpc/capacity);
  const utilization=cpc!==null && planned>0?100*cpc/(planned*capacity):null;
  const feasible=required!==null&&planned>=required;
  const daily=[...campaign.daily].sort((a,b)=>a.date.localeCompare(b.date));
  const maxDaily=Math.max(1,...daily.map(r=>r.attempts));

  return <div className="lo-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <section className="lo-modal" role="dialog" aria-modal="true" aria-labelledby="lo-detail-title">
      <header className="lo-modal-head">
        <div><div className="lo-eyebrow"><Crosshair size={14}/> Simulação executiva Locator</div>
          <h2 id="lo-detail-title">{campaign.campaign}</h2>
          <p>{campaign.client} · Campanha {campaign.campaignId} · {campaign.server} · {campaign.days} dias analisados</p>
        </div>
        <button className="lo-icon-button" onClick={onClose} title="Fechar"><X size={20}/></button>
      </header>
      <div className="lo-modal-body">
        {!campaign.mapped&&<div className="lo-warning"><CircleAlert size={17}/> Vínculo cliente/campanha ainda não confirmado neste ambiente compartilhado. Valide antes de tomar decisões.</div>}
        {campaign.mailing===null&&<div className="lo-warning"><CircleAlert size={17}/> Mailing não disponível no ETL. O funil será calculado após a extração do ReportImport.</div>}
        <div className="lo-modal-grid">
          <article className="lo-panel">
            <div className="lo-section-head"><div><small>OPERAÇÃO ATUAL</small><h3>Indicadores observados</h3></div><span className="lo-tag">Média diária</span></div>
            <div className="lo-mini-metrics">
              <div><small>Mailing médio</small><b>{fmt(campaign.mailing)}</b></div>
              <div><small>Spin atual</small><b>{fmt(campaign.spin,2)}</b></div>
              <div><small>Hit% atual</small><b>{pct(campaign.hit)}</b></div>
              <div><small>Atend / Log</small><b>{fmt(campaign.atendLog,1)}</b></div>
              <div><small>HC médio</small><b>{fmt(campaign.logged,1)}</b></div>
              <div><small>Índice</small><b>{fmt(campaign.score,1)} / 100</b></div>
            </div>
            <div className="lo-section-head lo-space"><div><small>ÍNDICE AUTOMÁTICO</small><h3>Composição da oportunidade</h3></div></div>
            <ScoreParts c={campaign}/>
          </article>
          <article className="lo-panel">
            <div className="lo-section-head"><div><small>PARÂMETROS EDITÁVEIS</small><h3>Premissas de simulação</h3></div><SlidersHorizontal size={18}/></div>
            <div className="lo-input-grid">
              <label>Spin no Locator<input type="number" min="0.01" step="0.1" value={spin} onChange={e=>setSpin(clamp(Number(e.target.value)||0.01,0.01,100))}/></label>
              <label>Hit% observado<input type="text" value={pct(campaign.hit)} readOnly title="Hit histórico, sem alteração manual"/></label>
              <label>Taxa de CPC%<input type="number" min="0" max="100" step="0.1" value={cpcRate} onChange={e=>setCpcRate(clamp(Number(e.target.value)||0,0,100))}/></label>
              <label>Acordo% sobre CPC<input type="number" min="0" max="100" step="0.1" value={agreementRate} onChange={e=>setAgreementRate(clamp(Number(e.target.value)||0,0,100))}/></label>
              <label>CPC por HC / dia<input type="number" min="1" max="300" value={capacity} onChange={e=>setCapacity(clamp(Number(e.target.value)||1,1,300))}/></label>
              <label>Redução desejada de HC (%)<input type="number" min="0" max="100" value={reduction} onChange={e=>setReduction(clamp(Number(e.target.value)||0,0,100))}/></label>
            </div>
            <p className="lo-fineprint">CPC% e Acordo% são benchmarks ajustáveis, não resultados da base SQL. A redução desejada determina o HC planejado, sem ajuste automático.</p>
          </article>
        </div>

        <article className="lo-panel lo-space">
          <div className="lo-section-head"><div><small>FUNIL PROJETADO</small><h3>O que o Locator produziria por dia</h3></div><span className="lo-tag">Hit% do histórico</span></div>
          <div className="lo-funnel">
            <FunnelStep label="Mailing" value={campaign.mailing} sub="Média histórica"/>
            <FunnelStep label="Tentativas" value={attempts} sub={"Spin "+fmt(spin,2)+"x"}/>
            <FunnelStep label="Atendidas" value={answered} sub={"Hit "+pct(campaign.hit)}/>
            <FunnelStep label="CPC" value={cpc} sub={pct(cpcRate)+" das atendidas"}/>
            <FunnelStep label="Acordos" value={agreements} sub={pct(agreementRate)+" dos CPC"}/>
          </div>
          <div className="lo-hc-results">
            <div><small>HC atual (referência)</small><strong>{fmt(actualHc)}</strong></div>
            <div><small>HC após redução desejada</small><strong>{fmt(planned)}</strong><em>{fmt(reduction,0)}% de redução</em></div>
            <div><small>HC mínimo estimado</small><strong>{fmt(required)}</strong><em>{fmt(capacity)} CPC / HC / dia</em></div>
            <div className={feasible?"lo-hc-good":"lo-hc-alert"}><small>Capacidade</small><strong>{utilization===null?"—":pct(utilization,1)}</strong><em>{required===null?"Mailing pendente":feasible?"Comporta o volume":"Volume acima da capacidade"}</em></div>
          </div>
          <div className="lo-fineprint">HC mínimo = arredondar para cima (CPC projetados ÷ capacidade por HC). Utilização é uma referência de volume diário, não ocupação de jornada. A quantidade de logados por campanha pode se repetir em outras campanhas.</div>
        </article>

        <article className="lo-panel lo-space">
          <div className="lo-section-head"><div><small>HISTÓRICO OPERACIONAL</small><h3>Funil dia a dia</h3></div><span className="lo-tag">{daily.length} registros</span></div>
          <div className="lo-bars">
            {daily.slice(-24).map(row=><div className="lo-bar-row" key={row.date}>
              <span>{row.date.slice(5)}</span><div className="lo-bar-bg"><i style={{width:(row.attempts/maxDaily*100)+"%"}}/></div><b>{fmt(row.attempts)}</b>
            </div>)}
          </div>
          <div className="lo-table-scroll"><table className="lo-table">
            <thead><tr><th>Data</th><th>Mailing</th><th>Logados</th><th>Tentativas</th><th>Atendidas</th><th>Hit%</th><th>Spin</th></tr></thead>
            <tbody>{[...daily].reverse().map(r=><tr key={r.date}><td>{r.date.split("-").reverse().join("/")}</td><td>{fmt(r.mailing)}</td><td>{fmt(r.logged)}</td><td>{fmt(r.attempts)}</td><td>{fmt(r.answered)}</td><td>{pct(r.attempts>0?100*r.answered/r.attempts:0)}</td><td>{fmt(r.mailing&&r.mailing>0?r.attempts/r.mailing:null,2)}</td></tr>)}</tbody>
          </table></div>
          <p className="lo-fineprint">Atendidas seguem a definição da consulta de origem: AgentId &gt; 0. O Mailing mantém a última importação bem-sucedida até a data do evento.</p>
        </article>
      </div>
    </section>
  </div>;
}

function BubbleMap({campaigns,onPick}:{campaigns:Campaign[];onPick:(c:Campaign)=>void}){
  const data=campaigns.filter(c=>c.mailingLog!==null&&c.atendLog!==null).slice(0,65);
  if(!data.length)return <div className="lo-empty">Sem campanhas com Mailing e Logados para desenhar o mapa.</div>;
  const maxX=Math.max(2500,...data.map(c=>c.mailingLog||0));
  const maxY=Math.max(120,...data.map(c=>c.atendLog||0));
  return <div className="lo-map-wrap">
    <div className="lo-map-caption"><span><ArrowUpRight size={15}/> Mais mailing por operador</span><span><ArrowDownRight size={15}/> Menos atendidas por operador</span></div>
    <svg className="lo-bubble" viewBox="0 0 850 355" role="img" aria-label="Mapa de oportunidades. Eixo horizontal: Mailing por logado. Eixo vertical: Atendidas por logado, menor no topo.">
      {Array.from({length:5},(_,i)=><g key={i}><line x1="64" y1={45+i*63} x2="816" y2={45+i*63} stroke="#dfe5ee" strokeDasharray="4 5"/><text x="57" y={49+i*63} textAnchor="end" fill="#7d8497" fontSize="11">{fmt(maxY*i/4)}</text></g>)}
      {Array.from({length:5},(_,i)=><g key={i}><line x1={64+i*188} y1="45" x2={64+i*188} y2="297" stroke="#edf0f4"/><text x={64+i*188} y="317" textAnchor="middle" fill="#7d8497" fontSize="11">{fmt(maxX*i/4)}</text></g>)}
      <text x="440" y="345" textAnchor="middle" fill="#677287" fontSize="12">Mailing / Logados · Maior é melhor →</text>
      <text x="14" y="174" fill="#677287" fontSize="11" transform="rotate(-90 14 174)" textAnchor="middle">Atendidas / Log · Menor é melhor ↑</text>
      {data.map(c=>{
        const x=64+(c.mailingLog||0)/maxX*752;
        const y=45+(c.atendLog||0)/maxY*252;
        const r=clamp(7+Math.sqrt(Math.max(0,c.mailing||0))/80,7,26);
        const color=c.score>=60?"#fb5c28":c.score>=40?"#345f99":"#9fa9b8";
        return <g key={c.key} className="lo-bubble-dot" onClick={()=>onPick(c)} role="button" tabIndex={0}
          onKeyDown={e=>{if(e.key==="Enter"||e.key===" ")onPick(c);}}>
          <circle cx={x} cy={y} r={r+5} fill={color} opacity=".10"/>
          <circle cx={x} cy={y} r={r} fill={color} opacity=".74" stroke="white" strokeWidth="2"/>
          <title>{c.client} · {c.campaign} | Score {fmt(c.score,1)} | Mailing/Log {fmt(c.mailingLog)} | Atend/Log {fmt(c.atendLog,1)}</title>
        </g>;
      })}
    </svg>
    <div className="lo-legend"><span><i className="lo-dot high"/>Score ≥ 60</span><span><i className="lo-dot mid"/>40–59</span><span><i className="lo-dot low"/>Abaixo de 40</span><small>Tamanho: Mailing médio · Clique na bolha para detalhar</small></div>
  </div>;
}

export function LocatorOpportunities(){
  const [data,setData]=useState<ApiData>({rows:[],range:null,updatedAt:null});
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [refresh,setRefresh]=useState(0);
  const [start,setStart]=useState("");
  const [end,setEnd]=useState("");
  const [client,setClient]=useState("Todos");
  const [textFilter,setTextFilter]=useState("");
  const [showLocator,setShowLocator]=useState(true);
  const [showUnmapped,setShowUnmapped]=useState(false);
  const [selected,setSelected]=useState<Campaign|null>(null);
  const [explain,setExplain]=useState(false);
  const [tab,setTab]=useState<"map"|"simulator">("map");
  const [simulationKeys,setSimulationKeys]=useState<string[]>([]);
  const toggleSimulation=(key:string)=>setSimulationKeys(prev=>prev.includes(key)?prev.filter(k=>k!==key):[...prev,key]);

  useEffect(()=>{
    let cancelled=false;const controller=new AbortController();
    (async()=>{setLoading(true);setError("");try{
      const p=new URLSearchParams();if(start)p.set("start",start);if(end)p.set("end",end);
      const response=await fetch("/api/oportunidades"+(p.size?"?"+p.toString():""),{cache:"no-store",signal:controller.signal});
      const result:ApiData=await response.json();if(!response.ok)throw new Error(result.error||"Falha na consulta");
      if(!cancelled){setData(result);}
    }catch(e){if(!cancelled&&!(e instanceof Error&&e.name==="AbortError"))setError(e instanceof Error?e.message:"Falha de rede");}
    finally{if(!cancelled)setLoading(false);}})();
    return()=>{cancelled=true;controller.abort();};
  },[refresh,start,end]);

  const all=useMemo(()=>summarise(data.rows),[data.rows]);
  const clients=useMemo(()=>["Todos",...new Set(all.map(c=>c.client))].sort((a,b)=>a==="Todos"?-1:b==="Todos"?1:a.localeCompare(b,"pt-BR")),[all]);
  const ranked=useMemo(()=>all.filter(c=>
    (client==="Todos"||c.client===client)
    &&(showLocator||c.agentType!==4)
    &&(showUnmapped||c.mapped)
    &&(!textFilter||[c.campaign,c.campaignId,c.client].join(" ").toLocaleLowerCase("pt-BR").includes(textFilter.toLocaleLowerCase("pt-BR")))
  ),[all,client,showLocator,showUnmapped,textFilter]);
  const top=ranked[0];
  const high=ranked.filter(c=>c.score>=60).length;
  const totals=ranked.reduce((s,c)=>({attempts:s.attempts+c.attempts,answered:s.answered+c.answered}),{attempts:0,answered:0});
  const hit=totals.attempts?100*totals.answered/totals.attempts:0;

  return <div className="lo">
    <div className="lo-hero">
      <div><div className="lo-eyebrow"><Sparkles size={15}/> OSP Gestão · Intelligence Studio</div>
        <h1>{tab==="map"?"Mapa de Oportunidades":"Simulador"} <span>Locator</span></h1>
        <p>Encontre campanhas com espaço para automatizar o esforço, dimensionar transferências e otimizar o HC.</p>
      </div>
      <button className="lo-btn lo-btn-ghost" onClick={()=>setRefresh(n=>n+1)} disabled={loading}><RefreshCw size={16} className={loading?"lo-rotate":""}/> Atualizar</button>
    </div>
    <nav className="lo-sim-tabs" aria-label="Visões Locator">
      <button type="button" aria-pressed={tab==="map"} onClick={()=>setTab("map")}><Target size={16}/> Mapa de oportunidades</button>
      <button type="button" aria-pressed={tab==="simulator"} onClick={()=>setTab("simulator")}><SlidersHorizontal size={16}/> Simulador Locator ({simulationKeys.length})</button>
    </nav>
    <div className="lo-toolbar lo-panel">
      <label><span>Cliente</span><select value={client} onChange={e=>setClient(e.target.value)}>{clients.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
      <label><span>Período inicial</span><input type="date" value={start||data.range?.start||""} onChange={e=>setStart(e.target.value)}/></label>
      <label><span>Período final</span><input type="date" value={end||data.range?.end||""} onChange={e=>setEnd(e.target.value)}/></label>
      <label className="lo-search"><span>Buscar campanha</span><div><Search size={15}/><input placeholder="Nome ou ID da campanha" value={textFilter} onChange={e=>setTextFilter(e.target.value)}/></div></label>
      <div className="lo-toolbar-bottom">
        <label className="lo-check"><input type="checkbox" checked={showLocator} onChange={e=>setShowLocator(e.target.checked)}/> Mostrar já Locator</label>
        <label className="lo-check"><input type="checkbox" checked={showUnmapped} onChange={e=>setShowUnmapped(e.target.checked)}/> Vínculos pendentes</label>
      </div>
    </div>
    {error&&<div className="lo-warning"><CircleAlert size={18}/>{error}</div>}
    {loading?<div className="lo-empty">Consultando campanhas e recalculando o índice…</div>:!error&&tab==="map"&&
    <>
      <div className="lo-kpis">
        <div className="lo-kpi"><div><span>Campanhas analisadas</span><Target size={20}/></div><strong>{fmt(ranked.length)}</strong><small>{fmt(new Set(ranked.map(c=>c.client)).size)} clientes no filtro</small></div>
        <div className="lo-kpi"><div><span>Score acima de 60</span><Sparkles size={20}/></div><strong>{fmt(high)}</strong><small>Campanhas em destaque</small></div>
        <div className="lo-kpi"><div><span>Hit% consolidado</span><Activity size={20}/></div><strong>{pct(hit)}</strong><small>Atendidas / Tentativas</small></div>
        <div className="lo-kpi"><div><span>Maior oportunidade</span><Gauge size={20}/></div><strong>{top?fmt(top.score,1):"—"}<em>/ 100</em></strong><small>{top?top.campaign:"Nenhuma campanha"}</small></div>
      </div>
      <div className="lo-columns">
        <article className="lo-panel lo-chart-panel">
          <div className="lo-section-head"><div><small>EXPLORAÇÃO ESTRATÉGICA</small><h2>Mapa de oportunidades</h2></div><span className="lo-tag"><Filter size={13}/> {fmt(ranked.length)} campanhas</span></div>
          <BubbleMap campaigns={ranked} onPick={setSelected}/>
        </article>
        <article className="lo-panel lo-top-panel">
          <div className="lo-section-head"><div><small>TOP 5 · ADERÊNCIA</small><h2>Campanhas prioritárias</h2></div></div>
          <div className="lo-top-list">{ranked.slice(0,5).map((c,i)=><button className="lo-top-item" key={c.key} onClick={()=>setSelected(c)}>
            <span className="lo-order">{String(i+1).padStart(2,"0")}</span>
            <span className="lo-top-name"><strong>{c.campaign}</strong><small>{c.client}</small></span>
            <span className="lo-score-pill">{fmt(c.score,1)}</span><ChevronRight size={15}/>
          </button>)}</div>
          {!ranked.length&&<div className="lo-empty">Nenhuma campanha encontrada.</div>}
          <button className="lo-text-button" onClick={()=>setExplain(true)}>Entender o índice automático <ChevronRight size={15}/></button>
        </article>
      </div>
      <article className="lo-panel lo-space">
        <div className="lo-section-head"><div><small>RANKING MULTICRITÉRIO · 4 DIMENSÕES</small><h2>Oportunidades por campanha</h2></div>
          <div className="lo-sim-actions"><button className="lo-btn lo-btn-secondary" onClick={()=>setTab("simulator")}>Simular selecionadas ({simulationKeys.length})</button><button className="lo-btn lo-btn-secondary" onClick={()=>downloadCsv(ranked)} disabled={!ranked.length}><Download size={16}/> Exportar CSV</button></div>
        </div>
        <div className="lo-table-scroll"><table className="lo-table">
          <thead><tr><th>Simular</th><th>#</th><th>Campanha / Cliente</th><th>Mailing / Log</th><th>Atend / Log</th><th>Mailing médio</th><th>Logados</th><th>Hit%</th><th>Spin</th><th>Score</th><th>Ação</th></tr></thead>
          <tbody>{ranked.map((c,i)=><tr key={c.key}><td><input type="checkbox" className="lo-sim-check" aria-label={"Selecionar "+c.campaign+" "+c.client} checked={simulationKeys.includes(c.key)} onChange={()=>toggleSimulation(c.key)} disabled={isLocator(c)}/></td><td><b className="lo-rank">{i+1}</b></td>
            <td><strong>{c.campaign}</strong><small>{c.client} · #{c.campaignId} {c.agentType===4?"· Já Locator":""} {!c.mapped?"· Revisar vínculo":""}</small></td>
            <td className="lo-accent">{fmt(c.mailingLog)}</td><td>{fmt(c.atendLog,1)}</td><td>{fmt(c.mailing)}</td><td>{fmt(c.logged,1)}</td>
            <td>{pct(c.hit)}</td><td>{fmt(c.spin,2)}</td><td><span className="lo-score-pill">{fmt(c.score,1)}</span></td>
            <td><button className="lo-detail-btn" onClick={()=>setSelected(c)}>Detalhar <ChevronRight size={15}/></button></td>
          </tr>)}</tbody>
        </table></div>
        {!ranked.length&&<div className="lo-empty">Sem dados neste filtro. Confira a última carga ETL e as opções de vínculos.</div>}
      </article>
      <div className="lo-footer"><span>Atualização da base: {data.updatedAt?new Date(data.updatedAt).toLocaleString("pt-BR"):"Ainda sem carga"} · Fonte SQL Server → Neon</span><span>Índice de 0 a 100 · Hit% informativo, fora do score</span></div>
    </>}
    <div hidden={tab!=="simulator"||loading||!!error}><LocatorSimulator campaigns={ranked} allCampaigns={all} keys={simulationKeys} setKeys={setSimulationKeys}/></div>
    {selected&&<Detail key={selected.key} campaign={selected} onClose={()=>setSelected(null)}/>}
    {explain&&<div className="lo-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setExplain(false);}}><section className="lo-explain lo-panel" role="dialog" aria-modal="true">
      <div className="lo-section-head"><div><small>METODOLOGIA TRANSPARENTE</small><h2>Índice de Oportunidade Locator</h2></div><button className="lo-icon-button" onClick={()=>setExplain(false)}><X size={20}/></button></div>
      <p>O índice atribui até 25 pontos para cada dimensão. É uma curva contínua: valores acima dos limites de referência continuam crescendo, sem eliminar campanhas menores.</p>
      <div className="lo-methods"><p><b>1. Mailing/Log</b> = 25 × X / (X + 1.667), com X = Mailing médio / Logados médios.</p><p><b>2. Atend/Log</b> = 25 × 100 / (100 + Y), com Y = Atendidas médias / Logados médios. Quanto menor, melhor.</p><p><b>3. Mailing médio</b> = 25 × M / (M + 50.000).</p><p><b>4. Logados</b> = 25 × H / (H + 30).</p></div>
      <p>Para receber nota, a campanha precisa ter Mailing, operadores e tentativas válidas. A pontuação não representa ROI comprovado nem CPC real. O Hit% continua no ranking para análise adicional.</p>
    </section></div>}
  </div>;
}
