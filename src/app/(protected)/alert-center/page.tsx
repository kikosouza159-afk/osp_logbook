import Link from "next/link";
import {
  Activity,
  BarChart3,
  Boxes,
  Clock3,
  Database,
  Gauge,
  Layers3,
  PhoneCall,
  RadioTower,
  RefreshCw,
  Server,
  ShieldCheck,
  TimerReset,
  Waves,
  Zap,
} from "lucide-react";
import { query } from "@/lib/db";

type SummaryRow = {
  rows_count: string;
  volume: string;
  seconds: string;
  campaigns: string;
  last_sync: string | null;
};

type CampaignRow = {
  campaign_id: number;
  campaign_name: string;
  volume: string;
};

type RankingRow = {
  label: string;
  volume: string;
  seconds?: string;
  tma?: string;
};

type DurationRow = {
  bucket: string;
  volume: string;
  seconds: string;
  tma: string;
};

type HourRow = {
  hour: number;
  volume: string;
  seconds: string;
  tma: string;
};

type MatrixRow = {
  category: string;
  hour: number;
  volume: string;
  seconds?: string;
};

type HeatRow = {
  row_label: string;
  column_label: string;
  volume: string;
  seconds?: string;
};

type ProductivityRow = {
  productivity_class: string;
  volume: string;
};

type PbxSummaryRow = {
  volume: string;
  returns_count: string;
  signaling_count: string;
  last_sync: string | null;
};

type PbxPairRow = {
  return_description: string;
  signaling_extra_info: string;
  volume: string;
};

type EtlRow = {
  status: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  inserted_tabulation: string | null;
  inserted_pbx_return: string | null;
  error_message: string | null;
};

const n = (value: string | number | null | undefined) => Number(value || 0);

function integer(value: number) {
  return new Intl.NumberFormat("pt-BR").format(Math.round(value));
}

function compact(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    notation: value >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function percent(value: number, digits = 1) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value) + "%";
}

function secondsLabel(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0s";
  if (value < 60) return value < 10 ? value.toFixed(1).replace(".", ",") + "s" : Math.round(value) + "s";
  const min = Math.floor(value / 60);
  const sec = Math.round(value % 60);
  return min + "m " + String(sec).padStart(2, "0") + "s";
}

function dateTime(value: string | null) {
  if (!value) return "Sem sincronização";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function cleanBucket(value: string) {
  return value.replace(/^[a-z]\.\s*/i, "");
}

function variation(current: number, previous: number) {
  if (previous === 0) {
    if (current === 0) return { pct: 0, state: "stable" as const, text: "0,0%" };
    return { pct: null, state: "new" as const, text: "NOVO" };
  }
  const pct = ((current - previous) / previous) * 100;
  const abs = Math.abs(pct);
  const state = abs >= 40 ? "critical" as const : abs >= 25 ? "warning" as const : "stable" as const;
  const sign = pct > 0 ? "+" : "";
  return { pct, state, text: sign + percent(pct) };
}

function queryHref({
  view,
  date,
  campaign,
  productivity,
}: {
  view: "attempts" | "pbx";
  date: string;
  campaign: number | null;
  productivity?: string;
}) {
  const params = new URLSearchParams();
  params.set("view", view);
  params.set("date", date);
  if (campaign !== null) params.set("campaign", String(campaign));
  if (productivity && productivity !== "ALL") params.set("productivity", productivity);
  return "/alert-center?" + params.toString();
}

function Ranking({
  title,
  subtitle,
  rows,
  tone = "blue",
  totalBase,
}: {
  title: string;
  subtitle: string;
  rows: RankingRow[];
  tone?: "blue" | "orange" | "navy";
  totalBase?: number;
}) {
  const rankedTotal = rows.reduce((sum, row) => sum + n(row.volume), 0);
  const total = totalBase && totalBase > 0 ? totalBase : rankedTotal;
  const max = Math.max(...rows.map(row => n(row.volume)), 1);

  return <section className="card ac-panel">
    <div className="ac-panel-head">
      <div><h2>{title}</h2><p>{subtitle}</p></div>
      <span className={"ac-status-dot " + tone}/>
    </div>
    <div className="ac-ranking">
      {rows.map((row, index) => {
        const value = n(row.volume);
        return <div className="ac-rank" key={row.label}>
          <div className="ac-rank-top">
            <span className="ac-rank-order">{String(index + 1).padStart(2, "0")}</span>
            <strong title={row.label}>{row.label}</strong>
            <b>{integer(value)}</b>
          </div>
          <div className="ac-track"><i className={tone} style={{width: Math.max(value ? 2 : 0, (value / max) * 100) + "%"}}/></div>
          <div className="ac-rank-meta">
            <span className="ac-rep-badge">{total ? percent((value / total) * 100) : "0,0%"} representatividade</span>
            <span>{integer(value)} ocorrências</span>
            {row.tma && <span>TMA {secondsLabel(n(row.tma))}</span>}
          </div>
        </div>;
      })}
      {!rows.length && <div className="ac-empty">Sem dados para o recorte.</div>}
    </div>
  </section>;
}

function DurationComboChart({ rows }: { rows: DurationRow[] }) {
  const total = rows.reduce((sum,row)=>sum+n(row.volume),0);
  const maxVolume = Math.max(...rows.map(row=>n(row.volume)),1);
  const maxTma = Math.max(...rows.map(row=>n(row.tma)),1);

  return <section className="card ac-panel ac-duration-tech">
    <div className="ac-panel-head">
      <div>
        <h2>Faixa de segundos · Quantidade × TMA</h2>
        <p>Volume por faixa com marcador luminoso de TMA. Passe o mouse sobre cada coluna para abrir os detalhes.</p>
      </div>
      <Waves size={19}/>
    </div>

    <div className="ac-tech-chart">
      <div className="ac-tech-grid">
        {[100,75,50,25,0].map(level=><span key={level} style={{bottom:level+"%"}}><b>{level}%</b></span>)}
      </div>

      <div className="ac-tech-bars">
        {rows.map(row=>{
          const value=n(row.volume);
          const tma=n(row.tma);
          const volumeHeight=Math.max(value?4:0,(value/maxVolume)*100);
          const tmaPosition=Math.max(4,Math.min(96,(tma/maxTma)*100));
          const rep=total?(value/total)*100:0;
          return <div className="ac-tech-column" key={row.bucket}>
            <div className="ac-tech-plot">
              <div className="ac-tech-tooltip">
                <strong>{row.bucket}</strong>
                <div><span>Quantidade</span><b>{integer(value)}</b></div>
                <div><span>TMA</span><b>{secondsLabel(tma)}</b></div>
                <div><span>Representatividade</span><b>{percent(rep)}</b></div>
              </div>
              <div className="ac-tech-tma-line" style={{bottom:tmaPosition+"%"}}>
                <i/>
              </div>
              <div className="ac-tech-bar" style={{height:volumeHeight+"%"}}>
                <span/>
              </div>
            </div>
            <strong className="ac-tech-label" title={row.bucket}>{cleanBucket(row.bucket)}</strong>
          </div>;
        })}
      </div>
    </div>

    <div className="ac-chart-legend">
      <span><i className="bar"/>Quantidade</span>
      <span><i className="line"/>Marcador TMA</span>
    </div>
  </section>;
}

function RepresentationView({
  title,
  subtitle,
  rows,
  totalBase,
  tone = "blue",
}: {
  title: string;
  subtitle: string;
  rows: {label:string;volume:string}[];
  totalBase: number;
  tone?: "blue" | "orange" | "navy";
}) {
  const maxPct = Math.max(...rows.map(row=>totalBase?(n(row.volume)/totalBase)*100:0),1);

  return <section className="card ac-panel">
    <div className="ac-panel-head">
      <div><h2>{title}</h2><p>{subtitle}</p></div>
      <BarChart3 size={19}/>
    </div>

    <div className="ac-rep-grid">
      {rows.map((row,index)=>{
        const value=n(row.volume);
        const pct=totalBase?(value/totalBase)*100:0;
        return <article className="ac-rep-card" key={row.label}>
          <div className="ac-rep-top">
            <span>{String(index+1).padStart(2,"0")}</span>
            <strong title={row.label}>{row.label}</strong>
            <b>{percent(pct)}</b>
          </div>
          <div className="ac-rep-track"><i className={tone} style={{width:Math.max(value?3:0,(pct/maxPct)*100)+"%"}}/></div>
          <div className="ac-rep-foot"><span>{integer(value)} ocorrências</span><span>{percent(pct)} do total</span></div>
        </article>;
      })}
      {!rows.length && <div className="ac-empty">Sem dados para o recorte.</div>}
    </div>
  </section>;
}

function TabulationPanel({
  rows,
  total,
  selectedProductivity,
  generalVolume,
  productiveVolume,
  unproductiveVolume,
  selectedDate,
  selectedCampaign,
}: {
  rows: RankingRow[];
  total: number;
  selectedProductivity: string;
  generalVolume: number;
  productiveVolume: number;
  unproductiveVolume: number;
  selectedDate: string;
  selectedCampaign: number | null;
}) {
  return <section className="card ac-panel" id="tabulacoes">
    <div className="ac-panel-head">
      <div>
        <h2>Tabulações · visão geral</h2>
        <p>Quantidade, TMA e representatividade sobre o volume do recorte selecionado.</p>
      </div>
      <Layers3 size={19}/>
    </div>

    <div className="ac-tab-filter-grid">
      <Link className={"ac-tab-filter "+(selectedProductivity==="ALL"?"active":"")} href={queryHref({view:"attempts",date:selectedDate,campaign:selectedCampaign})+"#tabulacoes"}>
        <small>Geral</small><strong>{integer(generalVolume)}</strong><span>100% da base</span>
      </Link>
      <Link className={"ac-tab-filter productive "+(selectedProductivity==="PRODUTIVO"?"active":"")} href={queryHref({view:"attempts",date:selectedDate,campaign:selectedCampaign,productivity:"PRODUTIVO"})+"#tabulacoes"}>
        <small>Produtivo</small><strong>{integer(productiveVolume)}</strong><span>{generalVolume?percent((productiveVolume/generalVolume)*100):"0,0%"}</span>
      </Link>
      <Link className={"ac-tab-filter unproductive "+(selectedProductivity==="IMPRODUTIVO"?"active":"")} href={queryHref({view:"attempts",date:selectedDate,campaign:selectedCampaign,productivity:"IMPRODUTIVO"})+"#tabulacoes"}>
        <small>Improdutivo</small><strong>{integer(unproductiveVolume)}</strong><span>{generalVolume?percent((unproductiveVolume/generalVolume)*100):"0,0%"}</span>
      </Link>
    </div>

    <div className="ac-ranking ac-tab-ranking">
      {rows.map((row,index)=>{
        const value=n(row.volume);
        const rep=total?(value/total)*100:0;
        return <div className="ac-rank ac-tab-rank" key={row.label}>
          <div className="ac-rank-top">
            <span className="ac-rank-order">{String(index+1).padStart(2,"0")}</span>
            <strong title={row.label}>{row.label}</strong>
            <b>{integer(value)}</b>
          </div>
          <div className="ac-track"><i className="orange" style={{width:Math.max(value?2:0,rep)+"%"}}/></div>
          <div className="ac-rank-meta">
            <span className="ac-rep-badge">{percent(rep)} representatividade</span>
            <span>{integer(value)} ocorrências</span>
            {row.tma && <span>TMA {secondsLabel(n(row.tma))}</span>}
          </div>
        </div>;
      })}
    </div>
  </section>;
}

function HourPulse({ rows, title }: { rows: HourRow[]; title: string }) {
  const map = new Map(rows.map(row => [row.hour,row]));
  const start = rows.length ? Math.min(...rows.map(row=>row.hour)) : 0;
  const end = rows.length ? Math.max(...rows.map(row=>row.hour)) : -1;
  const hours = rows.length ? Array.from({length:end-start+1},(_,index)=>start+index) : [];

  return <section className="card ac-panel">
    <div className="ac-panel-head">
      <div>
        <h2>{title}</h2>
        <p>Cada horário é comparado diretamente com a hora anterior. Desvio ≥25% entra em atenção; ≥40% pisca como crítico.</p>
      </div>
      <Activity size={19}/>
    </div>

    <div className="ac-hour-pulse">
      {hours.map((hour,index) => {
        const row = map.get(hour);
        const current = n(row?.volume);
        const previous = index ? n(map.get(hour-1)?.volume) : 0;
        const delta = index ? variation(current,previous) : {pct:0,state:"stable" as const,text:"BASE"};
        return <article className={"ac-hour-card " + delta.state} key={hour}>
          <div className="ac-hour-card-head">
            <strong>{String(hour).padStart(2,"0")}h</strong>
            <span className={"ac-delta " + delta.state}>{delta.text}</span>
          </div>
          <b>{integer(current)}</b>
          <div className="ac-hour-card-foot">
            <span>TMA {secondsLabel(n(row?.tma))}</span>
            <span>{index ? "Anterior " + integer(previous) : "Primeira hora"}</span>
          </div>
        </article>;
      })}
      {!hours.length && <div className="ac-empty">Sem horas carregadas.</div>}
    </div>
  </section>;
}

function HourMatrix({
  title,
  subtitle,
  rows,
  limit = 12,
}: {
  title: string;
  subtitle: string;
  rows: MatrixRow[];
  limit?: number;
}) {
  const categories = Array.from(new Set(rows.map(r => r.category))).slice(0,limit);
  const rawHours = Array.from(new Set(rows.map(r => r.hour))).sort((a,b)=>a-b);
  const hours = rawHours.length
    ? Array.from({length:rawHours[rawHours.length-1]-rawHours[0]+1},(_,index)=>rawHours[0]+index)
    : [];
  const map = new Map(rows.map(r => [r.category + "|" + r.hour, n(r.volume)]));

  return <section className="card ac-panel ac-matrix-panel">
    <div className="ac-panel-head">
      <div><h2>{title}</h2><p>{subtitle}</p></div>
      <Boxes size={19}/>
    </div>

    <div className="ac-matrix-wrap">
      <table className="ac-matrix">
        <thead>
          <tr>
            <th>Categoria</th>
            {hours.map(hour => <th key={hour}>{String(hour).padStart(2,"0")}h</th>)}
          </tr>
        </thead>
        <tbody>
          {categories.map(category => <tr key={category}>
            <th title={category}>{category}</th>
            {hours.map((hour,index) => {
              const value = map.get(category+"|"+hour) || 0;
              const previous = index ? (map.get(category+"|"+(hour-1)) || 0) : 0;
              const delta = index ? variation(value,previous) : {pct:0,state:"stable" as const,text:"BASE"};
              return <td key={hour}>
                <div className={"ac-matrix-cell " + delta.state} title={category + " · " + hour + "h · " + integer(value) + (index ? " · " + delta.text + " vs hora anterior" : "")}>
                  <strong>{compact(value)}</strong>
                  <span>{delta.text}</span>
                </div>
              </td>;
            })}
          </tr>)}
        </tbody>
      </table>
    </div>

    <div className="ac-alert-legend">
      <span><i className="stable"/>Estável &lt;25%</span>
      <span><i className="warning"/>Atenção ≥25%</span>
      <span><i className="critical"/>Crítico ≥40%</span>
      <span><i className="new"/>Novo volume</span>
    </div>
  </section>;
}

function CrossHeatmap({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle: string;
  rows: HeatRow[];
}) {
  const rowLabels = Array.from(new Set(rows.map(r=>r.row_label))).slice(0,12);
  const columnLabels = Array.from(new Set(rows.map(r=>r.column_label))).slice(0,14);
  const map = new Map(rows.map(r=>[r.row_label+"|"+r.column_label,r]));
  const max = Math.max(...rows.map(r=>n(r.volume)),1);

  return <section className="card ac-panel ac-matrix-panel">
    <div className="ac-panel-head">
      <div><h2>{title}</h2><p>{subtitle}</p></div>
      <Gauge size={19}/>
    </div>

    <div className="ac-matrix-wrap">
      <table className="ac-matrix ac-heatmap">
        <thead>
          <tr>
            <th>Tabulação</th>
            {columnLabels.map(label=><th key={label} title={label}>{cleanBucket(label)}</th>)}
          </tr>
        </thead>
        <tbody>
          {rowLabels.map(rowLabel=><tr key={rowLabel}>
            <th title={rowLabel}>{rowLabel}</th>
            {columnLabels.map(colLabel=>{
              const row=map.get(rowLabel+"|"+colLabel);
              const value=n(row?.volume);
              const alpha=value ? Math.max(.08,Math.min(.92,.08+(value/max)*.84)) : .02;
              const tma=row?.seconds && value ? n(row.seconds)/value : 0;
              return <td key={colLabel}>
                <div
                  className="ac-heat-cell"
                  style={{background:"rgba(52,95,153,"+alpha+")",color:alpha>.52?"white":"var(--navy)"}}
                  title={rowLabel+" · "+colLabel+" · "+integer(value)+(value?" · TMA "+secondsLabel(tma):"")}
                >
                  <strong>{value ? compact(value) : "—"}</strong>
                  {value>0 && <span>{secondsLabel(tma)}</span>}
                </div>
              </td>;
            })}
          </tr>)}
        </tbody>
      </table>
    </div>
  </section>;
}

function PbxPairs({ rows }: { rows: PbxPairRow[] }) {
  return <section className="card ac-panel">
    <div className="ac-panel-head">
      <div>
        <h2>Retorno × SignalingExtraInfo</h2>
        <p>Leitura combinada do retorno PBX com o código de sinalização recebido.</p>
      </div>
      <Zap size={19}/>
    </div>

    <div className="ac-pair-grid">
      {rows.slice(0,18).map((row,index)=><article className="ac-pair-card" key={row.return_description+"|"+row.signaling_extra_info}>
        <span className="ac-pair-order">{String(index+1).padStart(2,"0")}</span>
        <div>
          <strong>{row.return_description}</strong>
          <small>SIP / ExtraInfo {row.signaling_extra_info || "0"}</small>
        </div>
        <b>{integer(n(row.volume))}</b>
      </article>)}
    </div>
  </section>;
}

export default async function AlertCenterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string,string|string[]|undefined>>;
}) {
  const sp = await searchParams;
  const requestedView = typeof sp.view === "string" ? sp.view.toLowerCase() : "attempts";
  const view: "attempts" | "pbx" = requestedView === "pbx" ? "pbx" : "attempts";
  const requestedDate = typeof sp.date === "string" ? sp.date : "";
  const requestedCampaign = typeof sp.campaign === "string" ? sp.campaign : "";
  const requestedProductivity = typeof sp.productivity === "string" ? sp.productivity.toUpperCase() : "ALL";

  const latestDateResult = await query<{reference_date:string|null}>(`
    SELECT MAX(reference_date)::text AS reference_date
    FROM osp_monitor_tabulation
    WHERE client_name='FastFlow' AND product_code='ADA'
  `);

  const selectedDate = requestedDate || latestDateResult.rows[0]?.reference_date || "";
  const selectedCampaign = /^\d+$/.test(requestedCampaign) ? Number(requestedCampaign) : null;
  const selectedProductivity = ["PRODUTIVO","IMPRODUTIVO"].includes(requestedProductivity)
    ? requestedProductivity
    : "ALL";

  if (!selectedDate) {
    return <section className="card ac-empty-state">
      <RadioTower size={34}/>
      <h1>OSP Alert Center</h1>
      <p>Nenhum snapshot disponível.</p>
    </section>;
  }

  const campaigns = await query<CampaignRow>(`
    SELECT campaign_id,MAX(campaign_name) campaign_name,SUM(quantity)::text volume
    FROM osp_monitor_tabulation
    WHERE reference_date=$1::date AND client_name='FastFlow' AND product_code='ADA'
    GROUP BY campaign_id
    ORDER BY campaign_id
  `,[selectedDate]);

  const attemptParams: unknown[] = [selectedDate];
  const attemptWhere = [
    "reference_date=$1::date",
    "client_name='FastFlow'",
    "product_code='ADA'",
  ];
  if (selectedCampaign !== null) {
    attemptParams.push(selectedCampaign);
    attemptWhere.push("campaign_id=$"+attemptParams.length);
  }
  if (selectedProductivity !== "ALL") {
    attemptParams.push(selectedProductivity);
    attemptWhere.push("productivity_class=$"+attemptParams.length);
  }
  const attemptFilter = attemptWhere.join(" AND ");

  const attemptBaseParams: unknown[] = [selectedDate];
  const attemptBaseWhere = [
    "reference_date=$1::date",
    "client_name='FastFlow'",
    "product_code='ADA'",
  ];
  if (selectedCampaign !== null) {
    attemptBaseParams.push(selectedCampaign);
    attemptBaseWhere.push("campaign_id=$"+attemptBaseParams.length);
  }
  const attemptBaseFilter = attemptBaseWhere.join(" AND ");

  const pbxParams: unknown[] = [selectedDate];
  const pbxWhere = [
    "reference_date=$1::date",
    "client_name='FastFlow'",
    "product_code='ADA'",
  ];
  if (selectedCampaign !== null) {
    pbxParams.push(selectedCampaign);
    pbxWhere.push("campaign_id=$"+pbxParams.length);
  }
  const pbxFilter = pbxWhere.join(" AND ");

  const etlPromise = query<EtlRow>(`
    SELECT status,started_at::text,finished_at::text,duration_ms,
           inserted_tabulation::text,inserted_pbx_return::text,error_message
    FROM osp_monitor_etl_control
    WHERE source_date=$1::date
    ORDER BY started_at DESC
    LIMIT 1
  `,[selectedDate]);

  const productivityPromise = query<ProductivityRow>(`
    SELECT COALESCE(productivity_class,'SEM_CLASSIFICACAO') productivity_class,
           SUM(quantity)::text volume
    FROM osp_monitor_tabulation
    WHERE ${attemptBaseFilter}
    GROUP BY productivity_class
  `,attemptBaseParams);

  const commonCss = <style>{`
    .ac-hero{position:relative;overflow:hidden;padding:24px;margin-bottom:14px;background:linear-gradient(120deg,#000049 0%,#081b55 58%,#14366f 100%);color:#fff;border:0}
    .ac-hero:before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:34px 34px;mask-image:linear-gradient(90deg,#000,transparent 86%)}
    .ac-hero:after{content:"";position:absolute;width:310px;height:310px;border-radius:50%;border:1px solid rgba(251,92,40,.34);right:-120px;top:-165px;box-shadow:0 0 90px rgba(251,92,40,.16),inset 0 0 60px rgba(52,95,153,.14)}
    .ac-hero-inner{position:relative;z-index:1;display:flex;align-items:flex-end;justify-content:space-between;gap:24px}
    .ac-kicker{display:inline-flex;align-items:center;gap:8px;color:#ffad8f;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.15em}
    .ac-hero h1{margin:7px 0 4px;font-size:30px;letter-spacing:-.03em}
    .ac-hero p{margin:0;color:#c6d1ed;font-size:12px}
    .ac-hero-meta{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
    .ac-pill{display:inline-flex;align-items:center;gap:7px;padding:8px 10px;border:1px solid rgba(255,255,255,.16);border-radius:999px;background:rgba(255,255,255,.07);font-size:10px;font-weight:850}
    .ac-live{width:7px;height:7px;border-radius:50%;background:#4ade80;box-shadow:0 0 0 4px rgba(74,222,128,.12),0 0 18px rgba(74,222,128,.55)}
    .ac-tabs{margin-bottom:14px}
    .ac-filter{display:grid;grid-template-columns:minmax(170px,.65fr) minmax(280px,1.35fr) auto;gap:12px;align-items:end;padding:14px;margin-bottom:14px}
    .ac-filter .field{min-width:0}
    .ac-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-bottom:14px}
    .ac-kpi{position:relative;overflow:hidden;padding:16px;min-height:122px}
    .ac-kpi:before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--blue)}
    .ac-kpi.orange:before{background:var(--orange)}
    .ac-kpi.green:before{background:var(--success)}
    .ac-kpi.navy:before{background:var(--navy)}
    .ac-kpi.warning:before{background:#d99416}
    .ac-kpi-head{display:flex;align-items:center;justify-content:space-between;gap:8px;color:#7b8190;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}
    .ac-kpi-icon{width:32px;height:32px;display:grid;place-items:center;border-radius:10px;background:#f1f4f9;color:var(--navy)}
    .ac-kpi-value{margin-top:11px;font-family:"Avenir Next",Avenir,sans-serif;font-weight:900;font-size:27px;color:var(--navy);line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .ac-kpi small{display:block;margin-top:7px;color:#9297a4;font-size:10px;line-height:1.35}
    .ac-grid-2{display:grid;grid-template-columns:minmax(0,1.12fr) minmax(350px,.88fr);gap:14px;margin-bottom:14px}
    .ac-panel{padding:18px;min-width:0;margin-bottom:14px}
    .ac-grid-2>.ac-panel{margin-bottom:0}
    .ac-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:16px}
    .ac-panel-head h2{margin:0;color:var(--navy);font-size:16px}
    .ac-panel-head p{margin:4px 0 0;color:#858b98;font-size:11px;line-height:1.45}
    .ac-status-dot{width:10px;height:10px;border-radius:50%;margin-top:4px;background:var(--blue);box-shadow:0 0 0 5px rgba(52,95,153,.1)}
    .ac-status-dot.orange{background:var(--orange);box-shadow:0 0 0 5px rgba(251,92,40,.1)}
    .ac-status-dot.navy{background:var(--navy);box-shadow:0 0 0 5px rgba(0,0,73,.08)}
    .ac-ranking{display:flex;flex-direction:column;gap:11px}
    .ac-rank-top{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:8px;align-items:center;font-size:11px}
    .ac-rank-top strong{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#33394a}
    .ac-rank-top b{color:var(--navy);font-variant-numeric:tabular-nums}
    .ac-rank-order{font-size:9px;color:#a0a5b0;font-weight:900}
    .ac-track{height:7px;margin:5px 0 4px 36px;border-radius:999px;background:#eef1f6;overflow:hidden}
    .ac-track i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#345f99,#7ea0cc)}
    .ac-track i.orange{background:linear-gradient(90deg,#fb5c28,#ff9c75)}
    .ac-track i.navy{background:linear-gradient(90deg,#000049,#525c9d)}
    .ac-rank-meta{display:flex;justify-content:space-between;gap:10px;margin-left:36px;color:#969ba6;font-size:9px}
    .ac-svg{display:block;width:100%;height:auto;overflow:visible}
    .ac-grid-line{stroke:#edf0f5;stroke-width:1}
    .ac-axis-text{fill:#9aa0ad;font-size:10px}
    .ac-axis-right{font-size:9px}
    .ac-bar{fill:url(#nothing);fill:#345f99;opacity:.85}
    .ac-line{stroke:#fb5c28;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}
    .ac-line-point{fill:#fff;stroke:#fb5c28;stroke-width:3}
    .ac-x-label{fill:#6f7685;font-size:9px}
    .ac-chart-legend{display:flex;justify-content:center;gap:18px;color:#777e8d;font-size:10px}
    .ac-chart-legend span{display:flex;align-items:center;gap:6px}
    .ac-chart-legend i.bar{width:14px;height:7px;border-radius:3px;background:#345f99}
    .ac-chart-legend i.line{width:16px;height:2px;background:#fb5c28;position:relative}
    .ac-chart-legend i.line:after{content:"";position:absolute;width:5px;height:5px;border-radius:50%;background:#fb5c28;left:6px;top:-1.5px}
    .ac-tech-chart{position:relative;height:330px;padding:18px 8px 0;border:1px solid #edf0f5;border-radius:16px;background:linear-gradient(180deg,#fbfcff 0%,#f6f8fc 100%);overflow:visible}
    .ac-tech-grid{position:absolute;inset:18px 8px 44px 8px;pointer-events:none}
    .ac-tech-grid>span{position:absolute;left:0;right:0;border-top:1px dashed #dfe4ee}
    .ac-tech-grid b{position:absolute;left:0;top:-8px;font-size:8px;color:#a0a6b2;background:#f8faff;padding-right:4px}
    .ac-tech-bars{position:absolute;left:30px;right:12px;top:18px;bottom:42px;display:grid;grid-template-columns:repeat(12,minmax(48px,1fr));gap:8px;align-items:end}
    .ac-tech-column{height:100%;min-width:0;display:grid;grid-template-rows:minmax(0,1fr) 34px;gap:7px}
    .ac-tech-plot{position:relative;height:100%;display:flex;align-items:flex-end;justify-content:center;border-radius:12px;background:linear-gradient(180deg,rgba(52,95,153,.025),rgba(52,95,153,.01))}
    .ac-tech-bar{position:relative;width:min(34px,64%);border-radius:9px 9px 3px 3px;background:linear-gradient(180deg,#5e8fc9 0%,#345f99 58%,#000049 100%);box-shadow:0 10px 24px rgba(52,95,153,.18),0 0 0 1px rgba(52,95,153,.12);transition:.22s ease}
    .ac-tech-bar:before{content:"";position:absolute;inset:1px 3px auto;height:36%;border-radius:7px;background:linear-gradient(180deg,rgba(255,255,255,.32),transparent)}
    .ac-tech-bar span{position:absolute;inset:0;border-radius:inherit;box-shadow:0 0 20px rgba(52,95,153,.18) inset}
    .ac-tech-tma-line{position:absolute;left:50%;width:70%;height:1px;transform:translateX(-50%);background:linear-gradient(90deg,transparent,#fb5c28,transparent);z-index:3;transition:.2s}
    .ac-tech-tma-line i{position:absolute;left:50%;top:50%;width:9px;height:9px;border-radius:50%;transform:translate(-50%,-50%);background:#fb5c28;border:2px solid #fff;box-shadow:0 0 0 4px rgba(251,92,40,.13),0 0 18px rgba(251,92,40,.45)}
    .ac-tech-column:hover .ac-tech-bar{filter:brightness(1.12);transform:translateY(-2px);box-shadow:0 12px 28px rgba(52,95,153,.28),0 0 22px rgba(52,95,153,.18)}
    .ac-tech-column:hover .ac-tech-tma-line{background:linear-gradient(90deg,transparent,#ff7b4d,transparent)}
    .ac-tech-tooltip{position:absolute;left:50%;bottom:calc(100% + 12px);transform:translate(-50%,6px);min-width:190px;padding:11px 12px;border-radius:12px;background:#000049;color:#fff;opacity:0;visibility:hidden;pointer-events:none;z-index:20;box-shadow:0 16px 35px rgba(0,0,73,.28);transition:.18s}
    .ac-tech-tooltip:after{content:"";position:absolute;left:50%;bottom:-6px;width:12px;height:12px;background:#000049;transform:translateX(-50%) rotate(45deg)}
    .ac-tech-tooltip>strong{display:block;margin-bottom:8px;color:#fff;font-size:10px}
    .ac-tech-tooltip div{display:flex;justify-content:space-between;gap:14px;padding:3px 0;font-size:9px;color:#cbd4ed}
    .ac-tech-tooltip div b{color:#fff;font-size:10px}
    .ac-tech-column:hover .ac-tech-tooltip{opacity:1;visibility:visible;transform:translate(-50%,0)}
    .ac-tech-label{display:block;color:#6d7484;font-size:8px;line-height:1.15;text-align:center;white-space:normal;overflow:hidden}
    .ac-rep-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
    .ac-rep-card{padding:11px 12px;border:1px solid #edf0f5;border-radius:12px;background:linear-gradient(180deg,#fff,#fafbfc)}
    .ac-rep-top{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:8px;align-items:center}
    .ac-rep-top>span{color:#a0a6b1;font-size:9px;font-weight:900}
    .ac-rep-top strong{color:#303648;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .ac-rep-top b{color:var(--navy);font-size:12px}
    .ac-rep-track{height:7px;margin:7px 0 5px 36px;border-radius:999px;background:#eef1f6;overflow:hidden}
    .ac-rep-track i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#345f99,#7ca1d0)}
    .ac-rep-track i.orange{background:linear-gradient(90deg,#fb5c28,#ff9a72)}.ac-rep-track i.navy{background:linear-gradient(90deg,#000049,#505996)}
    .ac-rep-foot{display:flex;justify-content:space-between;gap:8px;margin-left:36px;color:#969ba6;font-size:8px}
    .ac-rep-badge{display:inline-flex;align-items:center;padding:3px 6px;border-radius:999px;background:#eef3fa;color:#345f99!important;font-weight:900}
    .ac-tab-filter-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-bottom:16px}
    .ac-tab-filter{position:relative;overflow:hidden;padding:12px;border:1px solid #e7eaf1;border-radius:12px;background:#fafbfc}
    .ac-tab-filter:before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:#345f99}.ac-tab-filter.productive:before{background:#168a5b}.ac-tab-filter.unproductive:before{background:#fb5c28}
    .ac-tab-filter.active{border-color:rgba(251,92,40,.35);box-shadow:0 8px 22px rgba(0,0,73,.06),inset 0 0 0 1px rgba(251,92,40,.08)}
    .ac-tab-filter small{display:block;color:#858b98;font-size:8px;text-transform:uppercase;letter-spacing:.08em;font-weight:900}.ac-tab-filter strong{display:block;margin-top:5px;color:var(--navy);font-size:20px}.ac-tab-filter span{display:block;margin-top:4px;color:#969ba6;font-size:9px}
    .ac-productivity{margin-bottom:14px}
    .ac-productivity-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin:0 2px 9px}
    .ac-productivity-head h2{margin:0;color:var(--navy);font-size:15px}
    .ac-productivity-head p{margin:3px 0 0;color:#8b909c;font-size:10px}
    .ac-productivity-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
    .ac-productivity-card{position:relative;overflow:hidden;padding:14px 15px;border:1px solid #e6eaf1;border-radius:14px;background:#fff;transition:.2s;min-height:96px}
    .ac-productivity-card:before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:#345f99}
    .ac-productivity-card.productive:before{background:#168a5b}
    .ac-productivity-card.unproductive:before{background:#fb5c28}
    .ac-productivity-card:hover{transform:translateY(-1px);box-shadow:0 10px 25px rgba(0,0,73,.07)}
    .ac-productivity-card.active{border-color:rgba(251,92,40,.4);box-shadow:inset 0 0 0 1px rgba(251,92,40,.11),0 10px 28px rgba(0,0,73,.07)}
    .ac-productivity-card small{display:block;color:#858b98;font-size:9px;text-transform:uppercase;letter-spacing:.09em;font-weight:900}
    .ac-productivity-card strong{display:block;margin-top:7px;color:var(--navy);font-size:25px}
    .ac-productivity-card span{display:block;margin-top:5px;color:#959aa6;font-size:10px}
    .ac-hour-pulse{display:grid;grid-template-columns:repeat(auto-fit,minmax(112px,1fr));gap:9px}
    .ac-hour-card{position:relative;overflow:hidden;padding:12px;border:1px solid #e9ecf2;border-radius:12px;background:#fafbfc}
    .ac-hour-card.warning{border-color:#f0c36c;background:#fffaf0}
    .ac-hour-card.critical{border-color:#ef8d8d;background:#fff3f3;animation:acCriticalBlink 1.3s ease-in-out infinite}
    .ac-hour-card.new{border-color:#91b8e8;background:#f3f8ff}
    .ac-hour-card-head{display:flex;align-items:center;justify-content:space-between;gap:7px}
    .ac-hour-card-head strong{color:var(--navy);font-size:12px}
    .ac-hour-card>b{display:block;margin-top:10px;color:var(--navy);font-size:20px}
    .ac-hour-card-foot{display:flex;flex-direction:column;gap:2px;margin-top:7px;color:#9297a3;font-size:9px}
    .ac-delta{padding:3px 5px;border-radius:999px;background:#eef1f6;color:#687080;font-size:8px;font-weight:900}
    .ac-delta.warning{background:#fff0c9;color:#8b6100}
    .ac-delta.critical{background:#ffdcdc;color:#a72d2d}
    .ac-delta.new{background:#e5f0ff;color:#2a5e9c}
    .ac-matrix-panel{overflow:hidden}
    .ac-matrix-wrap{overflow:auto;border:1px solid #edf0f5;border-radius:12px}
    .ac-matrix{border-collapse:separate;border-spacing:0;width:max-content;min-width:100%}
    .ac-matrix th,.ac-matrix td{padding:5px;border-bottom:1px solid #edf0f5;border-right:1px solid #edf0f5;background:#fff;position:static;font-size:10px}
    .ac-matrix thead th{position:sticky;top:0;z-index:3;background:#f7f9fc;color:#666e7f;min-width:76px;text-align:center}
    .ac-matrix thead th:first-child{left:0;z-index:5;min-width:210px;text-align:left}
    .ac-matrix tbody th{position:sticky;left:0;z-index:2;max-width:210px;min-width:210px;background:#fbfcfd;text-align:left;color:#303648;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .ac-matrix-cell{min-width:68px;min-height:48px;padding:7px 5px;border-radius:8px;text-align:center;border:1px solid transparent;transition:.2s}
    .ac-matrix-cell strong{display:block;color:var(--navy);font-size:11px}
    .ac-matrix-cell span{display:block;margin-top:3px;color:#979ca7;font-size:8px;font-weight:850}
    .ac-matrix-cell.warning{background:#fff6df;border-color:#f2d594}
    .ac-matrix-cell.warning span{color:#916900}
    .ac-matrix-cell.critical{background:#ffe7e7;border-color:#efabab;animation:acCriticalBlink 1.25s ease-in-out infinite}
    .ac-matrix-cell.critical span{color:#ad2929}
    .ac-matrix-cell.new{background:#eaf3ff;border-color:#b9d2f0}
    .ac-matrix-cell.new span{color:#2a5e9c}
    .ac-alert-legend{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:10px;color:#858b98;font-size:9px}
    .ac-alert-legend span{display:flex;align-items:center;gap:5px}
    .ac-alert-legend i{width:8px;height:8px;border-radius:3px;background:#eef1f6}
    .ac-alert-legend i.warning{background:#f1c75b}.ac-alert-legend i.critical{background:#dc5a5a}.ac-alert-legend i.new{background:#6e9ed9}
    .ac-heat-cell{min-width:73px;min-height:48px;border-radius:7px;padding:7px 5px;text-align:center;display:flex;flex-direction:column;justify-content:center}
    .ac-heat-cell strong{font-size:10px}.ac-heat-cell span{font-size:8px;margin-top:2px;opacity:.82}
    .ac-pair-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
    .ac-pair-card{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:9px;align-items:center;padding:11px;border:1px solid #edf0f5;border-radius:12px;background:#fafbfc}
    .ac-pair-order{font-size:9px;color:#a0a6b1;font-weight:900}
    .ac-pair-card strong{display:block;color:#303648;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .ac-pair-card small{display:block;margin-top:3px;color:#979ca7;font-size:9px}
    .ac-pair-card b{color:var(--navy);font-size:12px}
    .ac-etl{display:grid;grid-template-columns:1.1fr .9fr;gap:14px;margin-bottom:14px}
    .ac-etl-card{padding:17px}
    .ac-etl-status{display:flex;align-items:center;gap:11px}
    .ac-etl-orb{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;background:#e8f7f0;color:#168a5b}
    .ac-etl-orb.error{background:#fde9e9;color:#c43b3b}
    .ac-etl-copy strong{display:block;color:var(--navy);font-size:14px}
    .ac-etl-copy span{display:block;margin-top:3px;color:#8d929e;font-size:10px}
    .ac-etl-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:12px}
    .ac-etl-metric{padding:9px;border-radius:10px;background:#f5f7fa}
    .ac-etl-metric small{display:block;color:#999eaa;font-size:8px;text-transform:uppercase;font-weight:900}
    .ac-etl-metric strong{display:block;margin-top:4px;color:var(--navy);font-size:11px}
    .ac-campaign-list{display:flex;flex-direction:column;gap:7px}
    .ac-campaign{display:grid;grid-template-columns:44px minmax(0,1fr) auto;align-items:center;gap:9px;padding:9px 10px;border:1px solid #edf0f5;border-radius:11px}
    .ac-campaign-id{height:27px;display:grid;place-items:center;border-radius:8px;background:#eef2f8;color:var(--navy);font-size:10px;font-weight:900}
    .ac-campaign strong{display:block;color:#303648;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ac-campaign small{color:#999eaa;font-size:8px}.ac-campaign>b{color:var(--navy);font-size:10px}
    .ac-empty,.ac-empty-state{text-align:center;color:#8b909c}.ac-empty{padding:18px}.ac-empty-state{padding:48px}.ac-empty-state h1{color:var(--navy)}
    @keyframes acCriticalBlink{0%,100%{box-shadow:0 0 0 rgba(196,59,59,0)}50%{box-shadow:0 0 0 3px rgba(196,59,59,.18),0 0 22px rgba(196,59,59,.13)}}
    @media(max-width:1250px){.ac-kpis{grid-template-columns:repeat(3,1fr)}.ac-grid-2,.ac-etl{grid-template-columns:1fr}.ac-pair-grid{grid-template-columns:repeat(2,1fr)}}
    @media(max-width:800px){.ac-tech-bars{grid-template-columns:repeat(12,minmax(42px,1fr));overflow-x:auto}.ac-rep-grid{grid-template-columns:1fr}.ac-tab-filter-grid{grid-template-columns:1fr}.ac-hero-inner{align-items:flex-start;flex-direction:column}.ac-hero-meta{justify-content:flex-start}.ac-filter{grid-template-columns:1fr}.ac-kpis{grid-template-columns:repeat(2,1fr)}.ac-productivity-grid{grid-template-columns:1fr}.ac-pair-grid{grid-template-columns:1fr}}
    @media(max-width:520px){.ac-kpis{grid-template-columns:1fr}}
  `}</style>;

  const etlResult = await etlPromise;
  const productivityResult = await productivityPromise;
  const etl = etlResult.rows[0];
  const prodMap = new Map(productivityResult.rows.map(row=>[row.productivity_class,n(row.volume)]));
  const productiveVolume = prodMap.get("PRODUTIVO") || 0;
  const unproductiveVolume = prodMap.get("IMPRODUTIVO") || 0;
  const generalVolume = productiveVolume + unproductiveVolume;

  const hero = <>
    {commonCss}
    <section className="card ac-hero">
      <div className="ac-hero-inner">
        <div>
          <span className="ac-kicker"><RadioTower size={13}/> OSP Operational Intelligence</span>
          <h1>Alert Center · FastFlow</h1>
          <p>Monitoramento de Attempts e PBX com snapshot automático a cada 15 minutos.</p>
        </div>
        <div className="ac-hero-meta">
          <span className="ac-pill"><span className="ac-live"/> FastFlow · ADA</span>
          <span className="ac-pill"><Server size={12}/> 10.195.124.1 · PS02</span>
          <span className="ac-pill"><ShieldCheck size={12}/> Engine v11</span>
        </div>
      </div>
    </section>

    <nav className="dashboard-tabs ac-tabs" aria-label="Visões do Alert Center">
      <Link className={"dashboard-tab "+(view==="attempts"?"active":"")} href={queryHref({view:"attempts",date:selectedDate,campaign:selectedCampaign,productivity:selectedProductivity})}>
        <Activity size={16}/> Attempts
      </Link>
      <Link className={"dashboard-tab "+(view==="pbx"?"active":"")} href={queryHref({view:"pbx",date:selectedDate,campaign:selectedCampaign})}>
        <PhoneCall size={16}/> PBX
      </Link>
    </nav>

    <form className="card ac-filter" method="get">
      <input type="hidden" name="view" value={view}/>
      {view==="attempts" && selectedProductivity!=="ALL" && <input type="hidden" name="productivity" value={selectedProductivity}/>}
      <div className="field">
        <label>Data de referência</label>
        <input className="input" type="date" name="date" defaultValue={selectedDate}/>
      </div>
      <div className="field">
        <label>Campanha</label>
        <select className="select" name="campaign" defaultValue={selectedCampaign?.toString() || ""}>
          <option value="">Todas as campanhas</option>
          {campaigns.rows.map(c=><option key={c.campaign_id} value={c.campaign_id}>{c.campaign_id} · {c.campaign_name}</option>)}
        </select>
      </div>
      <button className="btn btn-primary" type="submit"><Gauge size={16}/> Aplicar</button>
    </form>
  </>;

  if (view === "attempts") {
    const [
      summaryResult,
      durationResult,
      tabResult,
      hourResult,
      durationHourResult,
      tabHourResult,
      heatResult,
    ] = await Promise.all([
      query<SummaryRow>(`
        SELECT COUNT(*)::text rows_count,
               COALESCE(SUM(quantity),0)::text volume,
               COALESCE(SUM(seconds),0)::text seconds,
               COUNT(DISTINCT campaign_id)::text campaigns,
               MAX(synced_at)::text last_sync
        FROM osp_monitor_tabulation
        WHERE ${attemptFilter}
      `,attemptParams),

      query<DurationRow>(`
        SELECT seconds_bucket bucket,
               SUM(quantity)::text volume,
               SUM(seconds)::text seconds,
               ROUND(SUM(seconds)::numeric/NULLIF(SUM(quantity),0),2)::text tma
        FROM osp_monitor_tabulation
        WHERE ${attemptFilter}
        GROUP BY seconds_bucket
        ORDER BY seconds_bucket
      `,attemptParams),

      query<RankingRow>(`
        SELECT tabulation label,
               SUM(quantity)::text volume,
               SUM(seconds)::text seconds,
               ROUND(SUM(seconds)::numeric/NULLIF(SUM(quantity),0),2)::text tma
        FROM osp_monitor_tabulation
        WHERE ${attemptFilter}
        GROUP BY tabulation
        ORDER BY SUM(quantity) DESC
        LIMIT 15
      `,attemptParams),

      query<HourRow>(`
        SELECT reference_hour::int AS "hour",
               SUM(quantity)::text volume,
               SUM(seconds)::text seconds,
               ROUND(SUM(seconds)::numeric/NULLIF(SUM(quantity),0),2)::text tma
        FROM osp_monitor_tabulation
        WHERE ${attemptFilter}
        GROUP BY reference_hour
        ORDER BY reference_hour
      `,attemptParams),

      query<MatrixRow>(`
        SELECT seconds_bucket category,reference_hour::int AS "hour",SUM(quantity)::text volume,SUM(seconds)::text seconds
        FROM osp_monitor_tabulation
        WHERE ${attemptFilter}
        GROUP BY seconds_bucket,reference_hour
        ORDER BY seconds_bucket,reference_hour
      `,attemptParams),

      query<MatrixRow>(`
        WITH top_tabs AS (
          SELECT tabulation
          FROM osp_monitor_tabulation
          WHERE ${attemptFilter}
          GROUP BY tabulation
          ORDER BY SUM(quantity) DESC
          LIMIT 12
        )
        SELECT t.tabulation category,t.reference_hour::int AS "hour",SUM(t.quantity)::text volume,SUM(t.seconds)::text seconds
        FROM osp_monitor_tabulation t
        JOIN top_tabs x ON x.tabulation=t.tabulation
        WHERE ${attemptFilter.replaceAll("reference_date","t.reference_date").replaceAll("client_name","t.client_name").replaceAll("product_code","t.product_code").replaceAll("campaign_id","t.campaign_id").replaceAll("productivity_class","t.productivity_class")}
        GROUP BY t.tabulation,t.reference_hour
        ORDER BY SUM(t.quantity) DESC,t.reference_hour
      `,attemptParams),

      query<HeatRow>(`
        WITH top_tabs AS (
          SELECT tabulation
          FROM osp_monitor_tabulation
          WHERE ${attemptFilter}
          GROUP BY tabulation
          ORDER BY SUM(quantity) DESC
          LIMIT 12
        )
        SELECT t.tabulation row_label,t.seconds_bucket column_label,
               SUM(t.quantity)::text volume,SUM(t.seconds)::text seconds
        FROM osp_monitor_tabulation t
        JOIN top_tabs x ON x.tabulation=t.tabulation
        WHERE ${attemptFilter.replaceAll("reference_date","t.reference_date").replaceAll("client_name","t.client_name").replaceAll("product_code","t.product_code").replaceAll("campaign_id","t.campaign_id").replaceAll("productivity_class","t.productivity_class")}
        GROUP BY t.tabulation,t.seconds_bucket
        ORDER BY SUM(t.quantity) DESC,t.seconds_bucket
      `,attemptParams),
    ]);

    const summary=summaryResult.rows[0];
    const total=n(summary?.volume);
    const seconds=n(summary?.seconds);
    const tma=total?seconds/total:0;
    const topDuration=[...durationResult.rows].sort((a,b)=>n(b.volume)-n(a.volume))[0];
    const topTab=tabResult.rows[0];

    let maxDelta={hour:0,pct:0,current:0,previous:0};
    hourResult.rows.forEach((row,index)=>{
      if(!index)return;
      const current=n(row.volume);
      const previous=n(hourResult.rows[index-1].volume);
      if(!previous)return;
      const pct=((current-previous)/previous)*100;
      if(Math.abs(pct)>Math.abs(maxDelta.pct))maxDelta={hour:row.hour,pct,current,previous};
    });

    return <>
      {hero}

      <section className="ac-productivity">
        <div className="ac-productivity-grid">
          <Link className={"ac-productivity-card "+(selectedProductivity==="ALL"?"active":"")} href={queryHref({view:"attempts",date:selectedDate,campaign:selectedCampaign})}>
            <small>Geral</small><strong>{integer(generalVolume)}</strong><span>Todas as chamadas</span>
          </Link>
          <Link className={"ac-productivity-card productive "+(selectedProductivity==="PRODUTIVO"?"active":"")} href={queryHref({view:"attempts",date:selectedDate,campaign:selectedCampaign,productivity:"PRODUTIVO"})}>
            <small>Produtivo</small><strong>{integer(productiveVolume)}</strong><span>AgentId &gt; 0</span>
          </Link>
          <Link className={"ac-productivity-card unproductive "+(selectedProductivity==="IMPRODUTIVO"?"active":"")} href={queryHref({view:"attempts",date:selectedDate,campaign:selectedCampaign,productivity:"IMPRODUTIVO"})}>
            <small>Improdutivo</small><strong>{integer(unproductiveVolume)}</strong><span>AgentId = 0</span>
          </Link>
        </div>
      </section>

      <div className="ac-kpis">
        <article className="card ac-kpi orange"><div className="ac-kpi-head"><span>Volume total</span><span className="ac-kpi-icon"><Activity size={16}/></span></div><div className="ac-kpi-value">{integer(total)}</div><small>{selectedProductivity==="ALL"?"Geral":selectedProductivity.toLowerCase()}</small></article>
        <article className="card ac-kpi"><div className="ac-kpi-head"><span>TMA geral</span><span className="ac-kpi-icon"><Clock3 size={16}/></span></div><div className="ac-kpi-value">{secondsLabel(tma)}</div><small>{integer(seconds)} segundos acumulados</small></article>
        <article className="card ac-kpi navy"><div className="ac-kpi-head"><span>Faixa dominante</span><span className="ac-kpi-icon"><Waves size={16}/></span></div><div className="ac-kpi-value">{topDuration?cleanBucket(topDuration.bucket):"—"}</div><small>{topDuration?integer(n(topDuration.volume))+" chamadas":"Sem dados"}</small></article>
        <article className="card ac-kpi green"><div className="ac-kpi-head"><span>Tabulação dominante</span><span className="ac-kpi-icon"><Layers3 size={16}/></span></div><div className="ac-kpi-value" title={topTab?.label}>{topTab?.label||"—"}</div><small>{topTab?integer(n(topTab.volume))+" chamadas":"Sem dados"}</small></article>
        <article className="card ac-kpi warning"><div className="ac-kpi-head"><span>Maior desvio horário</span><span className="ac-kpi-icon"><Zap size={16}/></span></div><div className="ac-kpi-value">{maxDelta.hour?((maxDelta.pct>0?"+":"")+percent(maxDelta.pct)):"—"}</div><small>{maxDelta.hour?String(maxDelta.hour).padStart(2,"0")+"h vs hora anterior":"Sem comparação"}</small></article>
      </div>

      <HourPulse rows={hourResult.rows} title="Pulso geral · Attempts"/>

      <DurationComboChart rows={durationResult.rows}/>

      <RepresentationView
        title="Representatividade por faixa de segundos"
        subtitle="Participação percentual de cada faixa sobre o volume total do recorte."
        rows={durationResult.rows.map(row=>({label:cleanBucket(row.bucket),volume:row.volume}))}
        totalBase={total}
        tone="blue"
      />

      <TabulationPanel
        rows={tabResult.rows}
        total={total}
        selectedProductivity={selectedProductivity}
        generalVolume={generalVolume}
        productiveVolume={productiveVolume}
        unproductiveVolume={unproductiveVolume}
        selectedDate={selectedDate}
        selectedCampaign={selectedCampaign}
      />

      <CrossHeatmap
        title="Tabulação × faixa de segundos"
        subtitle="Heatmap consolidado. Cada célula mostra volume e TMA da combinação."
        rows={heatResult.rows}
      />

      <HourMatrix
        title="Faixa de segundos × hora"
        subtitle="Matriz hora a hora de todas as faixas de duração, sempre confrontando a hora anterior."
        rows={durationHourResult.rows}
      />

      <HourMatrix
        title="Tabulação × hora"
        subtitle="Top 12 tabulações monitoradas hora a hora. Desvios críticos piscam automaticamente."
        rows={tabHourResult.rows}
      />

      <div className="ac-etl">
        <section className="card ac-etl-card">
          <div className="ac-panel-head"><div><h2>Saúde da sincronização</h2><p>Última execução registrada pelo OSP Monitor Engine.</p></div><Database size={18}/></div>
          <div className="ac-etl-status">
            <span className={"ac-etl-orb "+(etl?.status==="SUCCESS"?"":"error")}>{etl?.status==="SUCCESS"?<RefreshCw size={18}/>:<TimerReset size={18}/>}</span>
            <div className="ac-etl-copy"><strong>{etl?.status==="SUCCESS"?"Sincronização concluída":etl?.status||"Sem execução"}</strong><span>{etl?.finished_at?dateTime(etl.finished_at):"Aguardando"}</span></div>
          </div>
          <div className="ac-etl-metrics">
            <div className="ac-etl-metric"><small>Duração</small><strong>{etl?.duration_ms?(etl.duration_ms/1000).toFixed(1)+"s":"—"}</strong></div>
            <div className="ac-etl-metric"><small>Attempts</small><strong>{integer(n(etl?.inserted_tabulation))}</strong></div>
            <div className="ac-etl-metric"><small>PBX</small><strong>{integer(n(etl?.inserted_pbx_return))}</strong></div>
          </div>
        </section>
        <section className="card ac-etl-card">
          <div className="ac-panel-head"><div><h2>Campanhas no snapshot</h2><p>CampaignIds disponíveis na data selecionada.</p></div><Layers3 size={18}/></div>
          <div className="ac-campaign-list">{campaigns.rows.map(c=><div className="ac-campaign" key={c.campaign_id}><span className="ac-campaign-id">{c.campaign_id}</span><div><strong>{c.campaign_name}</strong><small>FastFlow · ADA</small></div><b>{integer(n(c.volume))}</b></div>)}</div>
        </section>
      </div>
    </>;
  }

  const [
    pbxSummaryResult,
    returnResult,
    signalingResult,
    pbxHourResult,
    returnHourResult,
    signalingHourResult,
    pairResult,
  ] = await Promise.all([
    query<PbxSummaryRow>(`
      SELECT COALESCE(SUM(quantity),0)::text volume,
             COUNT(DISTINCT return_description)::text returns_count,
             COUNT(DISTINCT signaling_extra_info)::text signaling_count,
             MAX(synced_at)::text last_sync
      FROM osp_monitor_pbx_return
      WHERE ${pbxFilter}
    `,pbxParams),

    query<RankingRow>(`
      SELECT return_description label,SUM(quantity)::text volume
      FROM osp_monitor_pbx_return
      WHERE ${pbxFilter}
      GROUP BY return_description
      ORDER BY SUM(quantity) DESC
      LIMIT 15
    `,pbxParams),

    query<RankingRow>(`
      SELECT COALESCE(NULLIF(signaling_extra_info,''),'0') label,SUM(quantity)::text volume
      FROM osp_monitor_pbx_return
      WHERE ${pbxFilter}
      GROUP BY COALESCE(NULLIF(signaling_extra_info,''),'0')
      ORDER BY SUM(quantity) DESC
      LIMIT 15
    `,pbxParams),

    query<HourRow>(`
      SELECT reference_hour::int AS "hour",SUM(quantity)::text volume,'0'::text seconds,'0'::text tma
      FROM osp_monitor_pbx_return
      WHERE ${pbxFilter}
      GROUP BY reference_hour
      ORDER BY reference_hour
    `,pbxParams),

    query<MatrixRow>(`
      WITH top_returns AS (
        SELECT return_description
        FROM osp_monitor_pbx_return
        WHERE ${pbxFilter}
        GROUP BY return_description
        ORDER BY SUM(quantity) DESC
        LIMIT 12
      )
      SELECT p.return_description category,p.reference_hour::int AS "hour",SUM(p.quantity)::text volume
      FROM osp_monitor_pbx_return p
      JOIN top_returns x ON x.return_description=p.return_description
      WHERE ${pbxFilter.replaceAll("reference_date","p.reference_date").replaceAll("client_name","p.client_name").replaceAll("product_code","p.product_code").replaceAll("campaign_id","p.campaign_id")}
      GROUP BY p.return_description,p.reference_hour
      ORDER BY SUM(p.quantity) DESC,p.reference_hour
    `,pbxParams),

    query<MatrixRow>(`
      WITH top_signals AS (
        SELECT COALESCE(NULLIF(signaling_extra_info,''),'0') signaling
        FROM osp_monitor_pbx_return
        WHERE ${pbxFilter}
        GROUP BY COALESCE(NULLIF(signaling_extra_info,''),'0')
        ORDER BY SUM(quantity) DESC
        LIMIT 12
      )
      SELECT COALESCE(NULLIF(p.signaling_extra_info,''),'0') category,p.reference_hour::int AS "hour",SUM(p.quantity)::text volume
      FROM osp_monitor_pbx_return p
      JOIN top_signals x ON x.signaling=COALESCE(NULLIF(p.signaling_extra_info,''),'0')
      WHERE ${pbxFilter.replaceAll("reference_date","p.reference_date").replaceAll("client_name","p.client_name").replaceAll("product_code","p.product_code").replaceAll("campaign_id","p.campaign_id")}
      GROUP BY COALESCE(NULLIF(p.signaling_extra_info,''),'0'),p.reference_hour
      ORDER BY SUM(p.quantity) DESC,p.reference_hour
    `,pbxParams),

    query<PbxPairRow>(`
      SELECT return_description,COALESCE(NULLIF(signaling_extra_info,''),'0') signaling_extra_info,SUM(quantity)::text volume
      FROM osp_monitor_pbx_return
      WHERE ${pbxFilter}
      GROUP BY return_description,COALESCE(NULLIF(signaling_extra_info,''),'0')
      ORDER BY SUM(quantity) DESC
      LIMIT 30
    `,pbxParams),
  ]);

  const pbxSummary=pbxSummaryResult.rows[0];
  const pbxTotal=n(pbxSummary?.volume);
  const topReturn=returnResult.rows[0];
  const topSignal=signalingResult.rows[0];

  let pbxMaxDelta={hour:0,pct:0};
  pbxHourResult.rows.forEach((row,index)=>{
    if(!index)return;
    const previous=n(pbxHourResult.rows[index-1].volume);
    if(!previous)return;
    const pct=((n(row.volume)-previous)/previous)*100;
    if(Math.abs(pct)>Math.abs(pbxMaxDelta.pct))pbxMaxDelta={hour:row.hour,pct};
  });

  return <>
    {hero}

    <div className="ac-kpis">
      <article className="card ac-kpi orange"><div className="ac-kpi-head"><span>Volume PBX</span><span className="ac-kpi-icon"><PhoneCall size={16}/></span></div><div className="ac-kpi-value">{integer(pbxTotal)}</div><small>Retornos consolidados</small></article>
      <article className="card ac-kpi"><div className="ac-kpi-head"><span>Retornos distintos</span><span className="ac-kpi-icon"><Layers3 size={16}/></span></div><div className="ac-kpi-value">{integer(n(pbxSummary?.returns_count))}</div><small>Classificações PBX</small></article>
      <article className="card ac-kpi navy"><div className="ac-kpi-head"><span>Retorno dominante</span><span className="ac-kpi-icon"><BarChart3 size={16}/></span></div><div className="ac-kpi-value" title={topReturn?.label}>{topReturn?.label||"—"}</div><small>{topReturn?integer(n(topReturn.volume))+" eventos":"Sem dados"}</small></article>
      <article className="card ac-kpi green"><div className="ac-kpi-head"><span>Signaling dominante</span><span className="ac-kpi-icon"><Zap size={16}/></span></div><div className="ac-kpi-value">{topSignal?.label||"—"}</div><small>{topSignal?integer(n(topSignal.volume))+" eventos":"Sem dados"}</small></article>
      <article className="card ac-kpi warning"><div className="ac-kpi-head"><span>Maior desvio horário</span><span className="ac-kpi-icon"><Activity size={16}/></span></div><div className="ac-kpi-value">{pbxMaxDelta.hour?((pbxMaxDelta.pct>0?"+":"")+percent(pbxMaxDelta.pct)):"—"}</div><small>{pbxMaxDelta.hour?String(pbxMaxDelta.hour).padStart(2,"0")+"h vs hora anterior":"Sem comparação"}</small></article>
    </div>

    <HourPulse rows={pbxHourResult.rows} title="Pulso geral · PBX"/>

    <div className="ac-grid-2">
      <Ranking title="PBX consolidado · por retorno" subtitle="Volume quantitativo e representatividade de cada retorno sobre o PBX total." rows={returnResult.rows} tone="navy" totalBase={pbxTotal}/>
      <Ranking title="SignalingExtraInfo · consolidado" subtitle="Volume quantitativo e representatividade de cada código sobre o PBX total." rows={signalingResult.rows} tone="orange" totalBase={pbxTotal}/>
    </div>

    <div className="ac-grid-2">
      <RepresentationView
        title="Representatividade · retorno PBX"
        subtitle="Percentual de participação dos principais retornos sobre o volume PBX."
        rows={returnResult.rows}
        totalBase={pbxTotal}
        tone="navy"
      />
      <RepresentationView
        title="Representatividade · SignalingExtraInfo"
        subtitle="Percentual de participação dos principais códigos de sinalização."
        rows={signalingResult.rows}
        totalBase={pbxTotal}
        tone="orange"
      />
    </div>

    <PbxPairs rows={pairResult.rows}/>

    <HourMatrix
      title="Retorno PBX × hora"
      subtitle="Top 12 retornos acompanhados hora a hora com comparação automática contra o horário anterior."
      rows={returnHourResult.rows}
    />

    <HourMatrix
      title="SignalingExtraInfo × hora"
      subtitle="Códigos SIP/ExtraInfo por hora. Distorções importantes entram em alerta visual."
      rows={signalingHourResult.rows}
    />

    <div className="ac-etl">
      <section className="card ac-etl-card">
        <div className="ac-panel-head"><div><h2>Saúde da sincronização</h2><p>Última execução do OSP Monitor Engine.</p></div><Database size={18}/></div>
        <div className="ac-etl-status">
          <span className={"ac-etl-orb "+(etl?.status==="SUCCESS"?"":"error")}>{etl?.status==="SUCCESS"?<RefreshCw size={18}/>:<TimerReset size={18}/>}</span>
          <div className="ac-etl-copy"><strong>{etl?.status==="SUCCESS"?"Sincronização concluída":etl?.status||"Sem execução"}</strong><span>{etl?.finished_at?dateTime(etl.finished_at):"Aguardando"}</span></div>
        </div>
        <div className="ac-etl-metrics">
          <div className="ac-etl-metric"><small>Duração</small><strong>{etl?.duration_ms?(etl.duration_ms/1000).toFixed(1)+"s":"—"}</strong></div>
          <div className="ac-etl-metric"><small>Attempts</small><strong>{integer(n(etl?.inserted_tabulation))}</strong></div>
          <div className="ac-etl-metric"><small>PBX</small><strong>{integer(n(etl?.inserted_pbx_return))}</strong></div>
        </div>
      </section>
      <section className="card ac-etl-card">
        <div className="ac-panel-head"><div><h2>Campanhas no snapshot</h2><p>CampaignIds disponíveis na data selecionada.</p></div><Layers3 size={18}/></div>
        <div className="ac-campaign-list">{campaigns.rows.map(c=><div className="ac-campaign" key={c.campaign_id}><span className="ac-campaign-id">{c.campaign_id}</span><div><strong>{c.campaign_name}</strong><small>FastFlow · ADA</small></div><b>{integer(n(c.volume))}</b></div>)}</div>
      </section>
    </div>
  </>;
}
