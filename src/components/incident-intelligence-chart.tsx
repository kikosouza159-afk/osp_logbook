"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  AreaChart,
  CalendarRange,
  Eye,
  EyeOff,
  Layers3,
  RadioTower,
  Sparkles,
  Target,
  Code2,
  TrendingUp,
} from "lucide-react";

export type IncidentIntelligenceRow = {
  day:string;
  area_code:string;
  area_name:string;
  problem_type_code:string;
  problem_type_label:string;
  total:number;
};

type Mode = "area" | "problem";
type Range = 7 | 14 | 30;

const CURRENT_AREAS = [
  {code:"OSP",name:"Planejamento Estratégico",icon:Target,color:"#000049"},
  {code:"OTS",name:"Telecom",icon:RadioTower,color:"#345F99"},
  {code:"OPC",name:"Curadoria",icon:Sparkles,color:"#FB5C28"},
  {code:"ODE",name:"Desenvolvimento",icon:Code2,color:"#7565A8"},
] as const;

const PROBLEM_COLORS = [
  "#FB5C28",
  "#345F99",
  "#000049",
  "#7565A8",
  "#4C7FB8",
  "#F58A63",
  "#25256D",
  "#8A96A8",
  "#5E79A1",
];

function dateList(today:string,range:Range) {
  const [year,month,day]=today.split("-").map(Number);
  const end=new Date(Date.UTC(year,month-1,day));
  return Array.from({length:range},(_,index)=>{
    const value=new Date(end);
    value.setUTCDate(end.getUTCDate()-(range-1-index));
    return value.toISOString().slice(0,10);
  });
}

function shortDate(date:string) {
  const [,month,day]=date.split("-");
  return `${day}/${month}`;
}

function longDate(date:string) {
  const [year,month,day]=date.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR",{
    weekday:"short",
    day:"2-digit",
    month:"short",
    timeZone:"UTC",
  }).format(new Date(Date.UTC(year,month-1,day))).replace(".","");
}

function formatNumber(value:number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function IncidentIntelligenceChart({
  rows,
  today,
}:{
  rows:IncidentIntelligenceRow[];
  today:string;
}) {
  const [mode,setMode]=useState<Mode>("area");
  const [range,setRange]=useState<Range>(14);
  const [selectedArea,setSelectedArea]=useState("OSP");
  const [hidden,setHidden]=useState<string[]>([]);
  const [hoverIndex,setHoverIndex]=useState<number|null>(null);

  const dates=useMemo(()=>dateList(today,range),[today,range]);
  const firstDate=dates[0];

  const periodRows=useMemo(
    ()=>rows.filter(row=>row.day>=firstDate && row.day<=today),
    [rows,firstDate,today]
  );

  const areas=useMemo(()=>{
    const extras=new Map<string,{code:string;name:string;icon:typeof Layers3;color:string}>();
    for(const row of periodRows) {
      if (!CURRENT_AREAS.some(area=>area.code===row.area_code) && !extras.has(row.area_code)) {
        extras.set(row.area_code,{
          code:row.area_code,
          name:row.area_name,
          icon:Layers3,
          color:"#848484",
        });
      }
    }
    return [...CURRENT_AREAS,...extras.values()];
  },[periodRows]);

  const areaTotals=useMemo(()=>{
    const map=new Map<string,number>();
    for(const row of periodRows) map.set(row.area_code,(map.get(row.area_code)??0)+Number(row.total));
    return map;
  },[periodRows]);

  const problemMeta=useMemo(()=>{
    const map=new Map<string,{key:string;label:string;area:string;total:number}>();
    for(const row of periodRows) {
      if(row.area_code!==selectedArea) continue;
      const current=map.get(row.problem_type_code);
      map.set(row.problem_type_code,{
        key:row.problem_type_code,
        label:row.problem_type_label,
        area:row.area_code,
        total:(current?.total??0)+Number(row.total),
      });
    }
    return [...map.values()].sort((a,b)=>b.total-a.total || a.label.localeCompare(b.label,"pt-BR"));
  },[periodRows,selectedArea]);

  const series=useMemo(()=>{
    if(mode==="area") {
      return areas
        .map(area=>({
          key:area.code,
          label:`${area.name} (${area.code})`,
          shortLabel:area.code,
          color:area.color,
          total:areaTotals.get(area.code)??0,
        }))
        .filter(item=>item.total>0 || CURRENT_AREAS.some(area=>area.code===item.key));
    }
    return problemMeta.map((problem,index)=>({
      key:problem.key,
      label:problem.label,
      shortLabel:problem.label,
      color:PROBLEM_COLORS[index%PROBLEM_COLORS.length],
      total:problem.total,
    }));
  },[mode,areas,areaTotals,problemMeta]);

  const visibleSeries=series.filter(item=>!hidden.includes(item.key));

  const values=useMemo(()=>{
    const map=new Map<string,Map<string,number>>();
    for(const day of dates) map.set(day,new Map());
    for(const row of periodRows) {
      const key=mode==="area"
        ? row.area_code
        : row.area_code===selectedArea ? row.problem_type_code : "";
      if(!key || !map.has(row.day)) continue;
      const bucket=map.get(row.day)!;
      bucket.set(key,(bucket.get(key)??0)+Number(row.total));
    }
    return map;
  },[dates,periodRows,mode,selectedArea]);

  const dailyTotals=dates.map(day=>
    visibleSeries.reduce((sum,item)=>sum+(values.get(day)?.get(item.key)??0),0)
  );
  const maxPoint=Math.max(
    1,
    ...dates.flatMap(day=>visibleSeries.map(item=>values.get(day)?.get(item.key)??0))
  );
  const maxDaily=Math.max(1,...dailyTotals);
  const totalPeriod=periodRows.reduce((sum,row)=>sum+Number(row.total),0);
  const peakIndex=dailyTotals.indexOf(Math.max(...dailyTotals));
  const peakDay=dates[Math.max(peakIndex,0)];

  const topArea=areas
    .map(area=>({label:`${area.name} (${area.code})`,total:areaTotals.get(area.code)??0}))
    .sort((a,b)=>b.total-a.total)[0];

  const topProblem=useMemo(()=>{
    const totals=new Map<string,{label:string;total:number}>();
    for(const row of periodRows) {
      const current=totals.get(row.problem_type_code);
      totals.set(row.problem_type_code,{
        label:row.problem_type_label,
        total:(current?.total??0)+Number(row.total),
      });
    }
    return [...totals.values()].sort((a,b)=>b.total-a.total)[0];
  },[periodRows]);

  const W=1040;
  const H=342;
  const M={left:52,right:22,top:28,bottom:44};
  const plotW=W-M.left-M.right;
  const plotH=H-M.top-M.bottom;
  const xStep=dates.length>1 ? plotW/(dates.length-1) : plotW;
  const xAt=(index:number)=>M.left+(dates.length>1 ? index*xStep : plotW/2);
  const yAt=(value:number)=>M.top+plotH-(value/maxPoint)*plotH;
  const labelEvery=range===7 ? 1 : range===14 ? 2 : 5;

  function pathFor(key:string) {
    const points=dates.map((day,index)=>({
      x:xAt(index),
      y:yAt(values.get(day)?.get(key)??0),
    }));

    if(!points.length) return "";
    if(points.length===1) return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

    let path=`M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

    for(let index=0;index<points.length-1;index++) {
      const current=points[index];
      const next=points[index+1];
      const middleX=(current.x+next.x)/2;

      path += ` C ${middleX.toFixed(2)} ${current.y.toFixed(2)}, ${middleX.toFixed(2)} ${next.y.toFixed(2)}, ${next.x.toFixed(2)} ${next.y.toFixed(2)}`;
    }

    return path;
  }

  function toggleSeries(key:string) {
    setHidden(current=>current.includes(key)
      ? current.filter(item=>item!==key)
      : [...current,key]
    );
  }

  function changeMode(next:Mode) {
    setMode(next);
    setHidden([]);
    setHoverIndex(null);
  }

  function changeArea(code:string) {
    setSelectedArea(code);
    setHidden([]);
    setHoverIndex(null);
  }

  const hoveredDay=hoverIndex===null ? null : dates[hoverIndex];
  const hoveredValues=hoveredDay
    ? visibleSeries
        .map(item=>({...item,value:values.get(hoveredDay)?.get(item.key)??0}))
        .sort((a,b)=>b.value-a.value)
    : [];

  return <section className="card incident-intel">
    <div className="incident-intel-head">
      <div className="incident-intel-title">
        <span className="incident-intel-kicker"><Activity size={13}/> Incident Intelligence</span>
        <h2>Mapa diário de incidentes</h2>
        <p>Volume por Área Responsável e por Tipo do incidente, com leitura diária e exploração interativa.</p>
      </div>

      <div className="incident-intel-controls">
        <div className="incident-intel-toggle" aria-label="Dimensão do gráfico">
          <button type="button" className={mode==="area" ? "active" : ""} onClick={()=>changeMode("area")}>
            <Layers3 size={14}/> Área
          </button>
          <button type="button" className={mode==="problem" ? "active" : ""} onClick={()=>changeMode("problem")}>
            <AreaChart size={14}/> Tipo do incidente
          </button>
        </div>
        <div className="incident-intel-range" aria-label="Período do gráfico">
          {([7,14,30] as Range[]).map(item=>
            <button
              type="button"
              key={item}
              className={range===item ? "active" : ""}
              onClick={()=>{setRange(item);setHoverIndex(null);}}
            >
              {item}D
            </button>
          )}
        </div>
      </div>
    </div>

    <div className="incident-intel-pulse">
      <article>
        <span><TrendingUp size={14}/> Volume no período</span>
        <strong>{formatNumber(totalPeriod)}</strong>
        <small>{range} dias analisados</small>
      </article>
      <article>
        <span><CalendarRange size={14}/> Pico diário</span>
        <strong>{formatNumber(Math.max(...dailyTotals,0))}</strong>
        <small>{peakDay ? longDate(peakDay) : "Sem movimento"}</small>
      </article>
      <article>
        <span><Target size={14}/> Área líder</span>
        <strong>{topArea?.total ? topArea.label.split(" (")[1]?.replace(")","") ?? "—" : "—"}</strong>
        <small>{topArea?.total ? `${formatNumber(topArea.total)} incidente(s)` : "Sem registros"}</small>
      </article>
      <article>
        <span><Sparkles size={14}/> Tipo líder</span>
        <strong className="textual">{topProblem?.label ?? "—"}</strong>
        <small>{topProblem ? `${formatNumber(topProblem.total)} incidente(s)` : "Sem registros"}</small>
      </article>
    </div>

    {mode==="problem" && <div className="incident-intel-area-picker">
      <span>Investigar área</span>
      <div>
        {areas.filter(area=>CURRENT_AREAS.some(current=>current.code===area.code)).map(area=>{
          const Icon=area.icon;
          return <button
            type="button"
            key={area.code}
            className={selectedArea===area.code ? "active" : ""}
            onClick={()=>changeArea(area.code)}
          >
            <Icon size={14}/>
            <strong>{area.code}</strong>
            <small>{areaTotals.get(area.code)??0}</small>
          </button>;
        })}
      </div>
    </div>}

    <div className="incident-intel-legend">
      {series.length ? series.map(item=>{
        const off=hidden.includes(item.key);
        return <button
          type="button"
          key={item.key}
          className={off ? "muted" : ""}
          onClick={()=>toggleSeries(item.key)}
          title={off ? "Exibir série" : "Ocultar série"}
        >
          <i style={{background:item.color}}/>
          <span>{item.label}</span>
          <strong>{formatNumber(item.total)}</strong>
          {off ? <EyeOff size={12}/> : <Eye size={12}/>}
        </button>;
      }) : <span className="incident-intel-no-series">Nenhum tipo de incidente registrado nesta área no período.</span>}
    </div>

    <div className="incident-intel-chart-wrap">
      <svg
        className="incident-intel-chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={mode==="area" ? "Gráfico diário de incidentes por área" : "Gráfico diário por tipo de incidente"}
        onPointerMove={(event)=>{
          const rect=event.currentTarget.getBoundingClientRect();
          const viewX=((event.clientX-rect.left)/rect.width)*W;
          const raw=Math.round((viewX-M.left)/xStep);
          setHoverIndex(Math.min(dates.length-1,Math.max(0,raw)));
        }}
        onPointerLeave={()=>setHoverIndex(null)}
      >
        <defs>
          <linearGradient id="incidentIntelGlow" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#345F99" stopOpacity=".11"/>
            <stop offset="100%" stopColor="#345F99" stopOpacity="0"/>
          </linearGradient>
          <filter id="incidentIntelSoftGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.2" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {[0,1,2,3,4].map(index=>{
          const y=M.top+(plotH/4)*index;
          const value=Math.round(maxPoint-(maxPoint/4)*index);
          return <g key={index}>
            <line x1={M.left} x2={W-M.right} y1={y} y2={y} className="incident-intel-grid-line"/>
            <text x={M.left-12} y={y+4} textAnchor="end" className="incident-intel-y-label">{value}</text>
          </g>;
        })}

        {dates.map((day,index)=>{
          const total=dailyTotals[index];
          const barHeight=(total/maxDaily)*(plotH*.30);
          return <rect
            key={day}
            x={xAt(index)-Math.max(2,xStep*.16)}
            y={M.top+plotH-barHeight}
            width={Math.max(4,xStep*.32)}
            height={barHeight}
            rx="3"
            className="incident-intel-density"
          />;
        })}

        {visibleSeries.map(item=><g key={item.key}>
          <path
            d={pathFor(item.key)}
            fill="none"
            stroke={item.color}
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#incidentIntelSoftGlow)"
            className="incident-intel-line"
          />
          {dates.map((day,index)=>{
            const value=values.get(day)?.get(item.key)??0;
            if(value===0 && hoverIndex!==index) return null;
            return <circle
              key={day}
              cx={xAt(index)}
              cy={yAt(value)}
              r={hoverIndex===index ? 4.1 : 2.4}
              fill={item.color}
              stroke="var(--incident-chart-point-stroke,#fff)"
              strokeWidth="1.5"
            />;
          })}
        </g>)}

        {hoverIndex!==null && <>
          <rect
            x={Math.max(M.left,xAt(hoverIndex)-Math.max(9,xStep*.38))}
            y={M.top}
            width={Math.max(18,xStep*.76)}
            height={plotH}
            rx="8"
            fill="url(#incidentIntelGlow)"
          />
          <line
            x1={xAt(hoverIndex)}
            x2={xAt(hoverIndex)}
            y1={M.top}
            y2={M.top+plotH}
            className="incident-intel-crosshair"
          />
        </>}

        {dates.map((day,index)=>{
          const shouldShow=index===0 || index===dates.length-1 || index%labelEvery===0;
          if(!shouldShow) return null;
          return <text
            key={day}
            x={xAt(index)}
            y={H-14}
            textAnchor={index===0 ? "start" : index===dates.length-1 ? "end" : "middle"}
            className="incident-intel-x-label"
          >
            {shortDate(day)}
          </text>;
        })}
      </svg>

      {hoveredDay && <div
        className="incident-intel-tooltip"
        style={{left:`${Math.min(82,Math.max(8,(xAt(hoverIndex!)/W)*100))}%`}}
      >
        <div className="incident-intel-tooltip-head">
          <strong>{longDate(hoveredDay)}</strong>
          <span>{formatNumber(dailyTotals[hoverIndex!]??0)} total</span>
        </div>
        <div className="incident-intel-tooltip-list">
          {hoveredValues.map(item=><div key={item.key}>
            <i style={{background:item.color}}/>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>)}
        </div>
      </div>}
    </div>

    <div className="incident-intel-footer">
      <span><i/> Passe o mouse sobre o gráfico para investigar o dia.</span>
      <span>Clique nas legendas para ligar ou desligar séries.</span>
    </div>
  </section>;
}
