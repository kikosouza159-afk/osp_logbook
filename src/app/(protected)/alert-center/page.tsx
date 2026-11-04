import Link from "next/link";
import {
  Activity,
  Clock3,
  Database,
  Gauge,
  Layers3,
  PhoneCall,
  RadioTower,
  RefreshCw,
  Server,
  TimerReset,
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
};

type HourRow = {
  hour: number;
  volume: string;
};

type ProductivityRow = {
  productivity_class: string;
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

const number = (value: string | number | null | undefined) => Number(value || 0);

function compact(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    notation: value >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function integer(value: number) {
  return new Intl.NumberFormat("pt-BR").format(Math.round(value));
}

function percent(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value) + "%";
}

function dateTime(value: string | null) {
  if (!value) return "Sem sincronização";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function durationLabel(seconds: number) {
  if (!seconds) return "0s";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}m ${rest}s`;
}

function Ranking({
  title,
  subtitle,
  rows,
  variant = "blue",
}: {
  title: string;
  subtitle: string;
  rows: RankingRow[];
  variant?: "blue" | "orange" | "navy";
}) {
  const max = Math.max(...rows.map((row) => number(row.volume)), 1);
  const total = rows.reduce((sum, row) => sum + number(row.volume), 0);

  return <section className="card monitor-panel">
    <div className="monitor-panel-head">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      <span className={`monitor-dot ${variant}`}/>
    </div>

    <div className="monitor-ranking">
      {rows.map((row, index) => {
        const value = number(row.volume);
        return <div className="monitor-rank-row" key={row.label}>
          <div className="monitor-rank-label">
            <span className="monitor-rank-index">{String(index + 1).padStart(2, "0")}</span>
            <strong title={row.label}>{row.label}</strong>
            <span>{integer(value)}</span>
          </div>
          <div className="monitor-rank-track">
            <span
              className={variant}
              style={{ width: `${Math.max(value > 0 ? 2 : 0, (value / max) * 100)}%` }}
            />
          </div>
          <small>{total ? percent((value / total) * 100) : "0,0%"} do recorte</small>
        </div>;
      })}
      {!rows.length && <div className="monitor-empty">Sem dados para o recorte selecionado.</div>}
    </div>
  </section>;
}

function HourlyChart({ rows }: { rows: HourRow[] }) {
  const map = new Map(rows.map((row) => [row.hour, number(row.volume)]));
  const start = rows.length ? Math.min(...rows.map((row) => row.hour)) : 8;
  const end = rows.length ? Math.max(...rows.map((row) => row.hour)) : 18;
  const hours = Array.from({ length: Math.max(end - start + 1, 1) }, (_, index) => start + index);
  const max = Math.max(...hours.map((hour) => map.get(hour) || 0), 1);

  return <section className="card monitor-panel monitor-hour-panel">
    <div className="monitor-panel-head">
      <div>
        <h2>Esforço hora a hora</h2>
        <p>Volume consolidado de tabulações por faixa horária.</p>
      </div>
      <Activity size={18}/>
    </div>

    <div className="monitor-hour-chart" aria-label="Volume por hora">
      {hours.map((hour) => {
        const value = map.get(hour) || 0;
        return <div className="monitor-hour" key={hour}>
          <div className="monitor-hour-value">{value ? compact(value) : "0"}</div>
          <div className="monitor-hour-bar-wrap">
            <span style={{ height: `${Math.max(value > 0 ? 4 : 0, (value / max) * 100)}%` }}/>
          </div>
          <strong>{String(hour).padStart(2, "0")}h</strong>
        </div>;
      })}
    </div>
  </section>;
}

export default async function AlertCenterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const requestedDate = typeof sp.date === "string" ? sp.date : "";
  const requestedCampaign = typeof sp.campaign === "string" ? sp.campaign : "";
  const requestedProductivity = typeof sp.productivity === "string" ? sp.productivity.toUpperCase() : "ALL";

  const latestDateResult = await query<{ reference_date: string | null }>(`
    SELECT MAX(reference_date)::text AS reference_date
    FROM osp_monitor_tabulation
    WHERE client_name='FastFlow'
      AND product_code='ADA'
  `);

  const selectedDate = requestedDate || latestDateResult.rows[0]?.reference_date || "";
  const selectedCampaign = /^\d+$/.test(requestedCampaign) ? Number(requestedCampaign) : null;

  const productivityCapability = await query<{ available: boolean }>(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema='public'
        AND table_name='osp_monitor_tabulation'
        AND column_name='productivity_class'
    ) AS available
  `);
  const hasProductivity = Boolean(productivityCapability.rows[0]?.available);
  const selectedProductivity =
    hasProductivity && ["PRODUTIVO","IMPRODUTIVO"].includes(requestedProductivity)
      ? requestedProductivity
      : "ALL";

  if (!selectedDate) {
    return <>
      <div className="page-head">
        <div>
          <h1>OSP Alert Center</h1>
          <p>Monitoramento operacional de tabulação e telefonia.</p>
        </div>
      </div>
      <section className="card monitor-empty-state">
        <RadioTower size={32}/>
        <h2>Nenhum snapshot disponível</h2>
        <p>Assim que o ETL concluir a primeira carga, os indicadores aparecem aqui.</p>
      </section>
    </>;
  }

  const campaigns = await query<CampaignRow>(`
    SELECT
      campaign_id,
      MAX(campaign_name) AS campaign_name,
      SUM(quantity)::text AS volume
    FROM osp_monitor_tabulation
    WHERE reference_date=$1::date
      AND client_name='FastFlow'
      AND product_code='ADA'
    GROUP BY campaign_id
    ORDER BY campaign_id
  `, [selectedDate]);

  const baseParams: unknown[] = [selectedDate];
  let campaignSql = "";
  if (selectedCampaign !== null) {
    baseParams.push(selectedCampaign);
    campaignSql = ` AND campaign_id=${baseParams.length}`;
  }

  const attemptParams = [...baseParams];
  let productivitySql = "";
  if (selectedProductivity !== "ALL") {
    attemptParams.push(selectedProductivity);
    productivitySql = ` AND productivity_class=${attemptParams.length}`;
  }

  const productivityCounts = hasProductivity
    ? await query<ProductivityRow>(`
        SELECT
          productivity_class,
          SUM(quantity)::text AS volume
        FROM osp_monitor_tabulation
        WHERE reference_date=$1::date
          AND client_name='FastFlow'
          AND product_code='ADA'
          ${campaignSql}
        GROUP BY productivity_class
      `, baseParams)
    : { rows: [] as ProductivityRow[] };

  const [
    summaryResult,
    tabulationResult,
    durationResult,
    pbxResult,
    hourlyResult,
    etlResult,
  ] = await Promise.all([
    query<SummaryRow>(`
      SELECT
        COUNT(*)::text AS rows_count,
        COALESCE(SUM(quantity),0)::text AS volume,
        COALESCE(SUM(seconds),0)::text AS seconds,
        COUNT(DISTINCT campaign_id)::text AS campaigns,
        MAX(synced_at)::text AS last_sync
      FROM osp_monitor_tabulation
      WHERE reference_date=$1::date
        AND client_name='FastFlow'
        AND product_code='ADA'
        ${campaignSql}
        ${productivitySql}
    `, attemptParams),

    query<RankingRow>(`
      SELECT
        tabulation AS label,
        SUM(quantity)::text AS volume
      FROM osp_monitor_tabulation
      WHERE reference_date=$1::date
        AND client_name='FastFlow'
        AND product_code='ADA'
        ${campaignSql}
        ${productivitySql}
      GROUP BY tabulation
      ORDER BY SUM(quantity) DESC
      LIMIT 10
    `, attemptParams),

    query<RankingRow>(`
      SELECT
        seconds_bucket AS label,
        SUM(quantity)::text AS volume
      FROM osp_monitor_tabulation
      WHERE reference_date=$1::date
        AND client_name='FastFlow'
        AND product_code='ADA'
        ${campaignSql}
        ${productivitySql}
      GROUP BY seconds_bucket
      ORDER BY seconds_bucket
    `, attemptParams),

    query<RankingRow>(`
      SELECT
        return_description AS label,
        SUM(quantity)::text AS volume
      FROM osp_monitor_pbx_return
      WHERE reference_date=$1::date
        AND client_name='FastFlow'
        AND product_code='ADA'
        ${campaignSql}
      GROUP BY return_description
      ORDER BY SUM(quantity) DESC
      LIMIT 10
    `, baseParams),

    query<HourRow>(`
      SELECT
        reference_hour::int AS hour,
        SUM(quantity)::text AS volume
      FROM osp_monitor_tabulation
      WHERE reference_date=$1::date
        AND client_name='FastFlow'
        AND product_code='ADA'
        ${campaignSql}
        ${productivitySql}
      GROUP BY reference_hour
      ORDER BY reference_hour
    `, attemptParams),

    query<EtlRow>(`
      SELECT
        status,
        started_at::text,
        finished_at::text,
        duration_ms,
        inserted_tabulation::text,
        inserted_pbx_return::text,
        error_message
      FROM osp_monitor_etl_control
      WHERE source_date=$1::date
      ORDER BY started_at DESC
      LIMIT 1
    `, [selectedDate]),
  ]);

  const summary = summaryResult.rows[0];
  const etl = etlResult.rows[0];
  const totalVolume = number(summary?.volume);
  const totalSeconds = number(summary?.seconds);
  const avgSeconds = totalVolume ? totalSeconds / totalVolume : 0;
  const pbxTotal = pbxResult.rows.reduce((sum, row) => sum + number(row.volume), 0);
  const pbxMap = new Map(pbxResult.rows.map((row) => [row.label.toLowerCase(), number(row.volume)]));
  const carrier = pbxMap.get("carrier message") || 0;
  const noAnswer = pbxMap.get("no answer") || 0;
  const normalReceived = pbxMap.get("normal received") || 0;
  const selectedCampaignName = selectedCampaign === null
    ? "Todas as campanhas"
    : campaigns.rows.find((campaign) => campaign.campaign_id === selectedCampaign)?.campaign_name || `Campanha ${selectedCampaign}`;

  const productivityMap = new Map(
    productivityCounts.rows.map((row) => [row.productivity_class, number(row.volume)])
  );
  const productiveVolume = productivityMap.get("PRODUTIVO") || 0;
  const unproductiveVolume = productivityMap.get("IMPRODUTIVO") || 0;
  const generalVolume = productiveVolume + unproductiveVolume || totalVolume;

  const productivityHref = (value: "ALL" | "PRODUTIVO" | "IMPRODUTIVO") => {
    const params = new URLSearchParams();
    params.set("date", selectedDate);
    if (selectedCampaign !== null) params.set("campaign", selectedCampaign.toString());
    if (value !== "ALL") params.set("productivity", value);
    return `/alert-center?${params.toString()}`;
  };

  return <>
    <style>{`
      .monitor-hero{position:relative;overflow:hidden;padding:22px 24px;margin-bottom:16px;background:linear-gradient(115deg,#000049 0%,#0b235c 62%,#132e68 100%);color:#fff;border:0}
      .monitor-hero:before{content:"";position:absolute;inset:0;background:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:32px 32px;mask-image:linear-gradient(90deg,black,transparent 82%)}
      .monitor-hero:after{content:"";position:absolute;width:260px;height:260px;border:1px solid rgba(251,92,40,.3);border-radius:50%;right:-80px;top:-120px;box-shadow:0 0 70px rgba(251,92,40,.12)}
      .monitor-hero-inner{position:relative;z-index:1;display:flex;justify-content:space-between;gap:24px;align-items:flex-end}
      .monitor-eyebrow{display:inline-flex;align-items:center;gap:8px;color:#ffb095;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.12em}
      .monitor-hero h1{font-size:29px;margin:8px 0 5px;letter-spacing:-.025em}
      .monitor-hero p{margin:0;color:#c6d0eb;font-size:13px}
      .monitor-hero-meta{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end}
      .monitor-pill{display:inline-flex;align-items:center;gap:7px;padding:8px 10px;border:1px solid rgba(255,255,255,.16);border-radius:999px;background:rgba(255,255,255,.07);font-size:11px;font-weight:800;white-space:nowrap}
      .monitor-live{width:7px;height:7px;border-radius:50%;background:#41d392;box-shadow:0 0 0 4px rgba(65,211,146,.12)}
      .monitor-filter{display:grid;grid-template-columns:minmax(170px,.65fr) minmax(260px,1.35fr) auto;gap:12px;padding:14px;margin-bottom:16px;align-items:end}
      .monitor-filter .field{min-width:0}
      .monitor-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:16px}
      .monitor-kpi{padding:17px;position:relative;overflow:hidden;min-height:130px}
      .monitor-kpi:before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--blue)}
      .monitor-kpi.orange:before{background:var(--orange)}
      .monitor-kpi.success:before{background:var(--success)}
      .monitor-kpi.navy:before{background:var(--navy)}
      .monitor-kpi-top{display:flex;align-items:center;justify-content:space-between;gap:10px;color:#747b8b;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.07em}
      .monitor-kpi-icon{width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:#f3f5fa;color:var(--navy)}
      .monitor-kpi-value{margin-top:12px;color:var(--navy);font-family:"Avenir Next",Avenir,sans-serif;font-size:30px;font-weight:850;line-height:1}
      .monitor-kpi small{display:block;margin-top:8px;color:#848999;font-size:11px}
      .monitor-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(360px,.85fr);gap:16px;margin-bottom:16px}
      .monitor-panel{padding:18px;min-width:0}
      .monitor-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:17px}
      .monitor-panel-head h2{margin:0;color:var(--navy);font-size:17px}
      .monitor-panel-head p{margin:4px 0 0;color:#858a97;font-size:12px;line-height:1.45}
      .monitor-dot{width:10px;height:10px;border-radius:50%;margin-top:5px;background:var(--blue);box-shadow:0 0 0 5px rgba(52,95,153,.10)}
      .monitor-dot.orange{background:var(--orange);box-shadow:0 0 0 5px rgba(251,92,40,.10)}
      .monitor-dot.navy{background:var(--navy);box-shadow:0 0 0 5px rgba(0,0,73,.08)}
      .monitor-ranking{display:flex;flex-direction:column;gap:12px}
      .monitor-rank-label{display:grid;grid-template-columns:28px minmax(0,1fr) auto;align-items:center;gap:8px;font-size:12px}
      .monitor-rank-label strong{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#303648}
      .monitor-rank-label>span:last-child{font-variant-numeric:tabular-nums;color:var(--navy);font-weight:800}
      .monitor-rank-index{font-size:10px;color:#a0a5b0;font-weight:800}
      .monitor-rank-track{height:7px;background:#f0f2f6;border-radius:999px;overflow:hidden;margin:5px 0 3px 36px}
      .monitor-rank-track span{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#345F99,#6e91c0)}
      .monitor-rank-track span.orange{background:linear-gradient(90deg,#fb5c28,#ff9d78)}
      .monitor-rank-track span.navy{background:linear-gradient(90deg,#000049,#39417e)}
      .monitor-rank-row small{display:block;margin-left:36px;color:#9a9faa;font-size:10px}
      .monitor-hour-chart{height:235px;display:grid;grid-auto-flow:column;grid-auto-columns:minmax(42px,1fr);gap:7px;align-items:end;padding:12px 4px 0;overflow-x:auto}
      .monitor-hour{display:grid;grid-template-rows:24px 1fr 22px;gap:6px;height:100%;text-align:center;min-width:42px}
      .monitor-hour-value{font-size:9px;color:#858b98;font-weight:800}
      .monitor-hour-bar-wrap{height:100%;display:flex;align-items:flex-end;justify-content:center;border-bottom:1px solid #e9ecf2;background:linear-gradient(180deg,rgba(52,95,153,.025),transparent)}
      .monitor-hour-bar-wrap span{width:min(26px,68%);min-height:0;border-radius:7px 7px 2px 2px;background:linear-gradient(180deg,#fb5c28,#345f99);box-shadow:0 8px 20px rgba(52,95,153,.12)}
      .monitor-hour strong{font-size:10px;color:#666d7d}
      .monitor-pbx-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px}
      .monitor-pbx-mini{padding:13px;border:1px solid #edf0f5;border-radius:13px;background:#fafbfc}
      .monitor-pbx-mini small{display:block;color:#858b98;font-size:10px;text-transform:uppercase;letter-spacing:.05em;font-weight:800}
      .monitor-pbx-mini strong{display:block;margin-top:5px;font-size:19px;color:var(--navy)}
      .monitor-pbx-mini span{font-size:10px;color:#9297a2}
      .monitor-etl{display:grid;grid-template-columns:1.15fr .85fr;gap:16px;margin-bottom:16px}
      .monitor-etl-card{padding:18px}
      .monitor-etl-status{display:flex;align-items:center;gap:12px}
      .monitor-etl-orb{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:#e8f7f0;color:#168a5b}
      .monitor-etl-orb.error{background:#fde9e9;color:#c43b3b}
      .monitor-etl-copy strong{display:block;color:var(--navy);font-size:15px}
      .monitor-etl-copy span{display:block;color:#858b98;font-size:11px;margin-top:3px}
      .monitor-etl-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}
      .monitor-etl-metric{padding:10px;border-radius:11px;background:#f6f8fb}
      .monitor-etl-metric small{display:block;color:#9297a2;font-size:9px;text-transform:uppercase;font-weight:800}
      .monitor-etl-metric strong{display:block;color:var(--navy);margin-top:4px;font-size:12px}
      .monitor-campaign-list{display:flex;flex-direction:column;gap:9px}
      .monitor-campaign-item{display:grid;grid-template-columns:48px minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px 11px;border:1px solid #edf0f5;border-radius:12px}
      .monitor-campaign-id{height:30px;border-radius:9px;display:grid;place-items:center;background:#eef2f8;color:var(--navy);font-size:11px;font-weight:850}
      .monitor-campaign-item strong{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px;color:#303648}
      .monitor-campaign-item small{color:#9398a4;font-size:10px}
      .monitor-campaign-volume{font-weight:850;color:var(--navy);font-size:12px}
      .monitor-empty,.monitor-empty-state{text-align:center;color:#8b909c}
      .monitor-empty{padding:18px 8px;font-size:12px}
      .monitor-empty-state{padding:48px 20px}
      .monitor-empty-state h2{color:var(--navy);margin:12px 0 5px}
      .monitor-empty-state p{margin:0}
      .monitor-productivity-wrap{margin-bottom:16px}
      .monitor-productivity-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin:0 2px 10px}
      .monitor-productivity-head h2{margin:0;color:var(--navy);font-size:16px}
      .monitor-productivity-head p{margin:4px 0 0;color:#858a97;font-size:11px}
      .monitor-productivity-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
      .monitor-productivity-card{position:relative;overflow:hidden;padding:15px 16px;border:1px solid #e7eaf1;border-radius:15px;background:#fff;transition:.2s ease;min-height:105px}
      .monitor-productivity-card:hover{transform:translateY(-1px);border-color:#cfd5e3}
      .monitor-productivity-card.active{border-color:rgba(251,92,40,.45);box-shadow:0 10px 28px rgba(0,0,73,.07),inset 0 0 0 1px rgba(251,92,40,.12)}
      .monitor-productivity-card:before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:#345f99}
      .monitor-productivity-card.productive:before{background:#168a5b}
      .monitor-productivity-card.unproductive:before{background:#fb5c28}
      .monitor-productivity-card.disabled{opacity:.48;pointer-events:none;filter:grayscale(.2)}
      .monitor-productivity-card small{display:block;font-size:10px;font-weight:850;letter-spacing:.08em;text-transform:uppercase;color:#858b98}
      .monitor-productivity-card strong{display:block;margin-top:8px;font-family:"Avenir Next",Avenir,sans-serif;font-size:27px;color:var(--navy)}
      .monitor-productivity-card span{display:block;margin-top:6px;font-size:10px;color:#9297a2}
      .monitor-productivity-note{margin-top:9px;padding:10px 12px;border:1px dashed #f0c7b8;border-radius:11px;background:#fff8f5;color:#8d5a47;font-size:11px}
      @media(max-width:1100px){.monitor-kpis{grid-template-columns:repeat(2,1fr)}.monitor-grid,.monitor-etl{grid-template-columns:1fr}.monitor-filter{grid-template-columns:1fr 1fr auto}}
      @media(max-width:720px){.monitor-productivity-cards{grid-template-columns:1fr}.monitor-hero-inner{align-items:flex-start;flex-direction:column}.monitor-hero-meta{justify-content:flex-start}.monitor-kpis{grid-template-columns:1fr}.monitor-filter{grid-template-columns:1fr}.monitor-pbx-cards,.monitor-etl-metrics{grid-template-columns:1fr}.monitor-panel{padding:15px}}
    `}</style>

    <section className="card monitor-hero">
      <div className="monitor-hero-inner">
        <div>
          <span className="monitor-eyebrow"><RadioTower size={14}/> OSP Operational Intelligence</span>
          <h1>Alert Center · FastFlow</h1>
          <p>Snapshot de tabulação e telefonia com atualização programada a cada 15 minutos.</p>
        </div>
        <div className="monitor-hero-meta">
          <span className="monitor-pill"><span className="monitor-live"/> FastFlow · ADA</span>
          <span className="monitor-pill"><Server size={13}/> 10.195.124.1 · PS02</span>
          <span className="monitor-pill"><RefreshCw size={13}/> {dateTime(summary?.last_sync || null)}</span>
        </div>
      </div>
    </section>

    <form className="card monitor-filter" method="get">
      <div className="field">
        <label>Data de referência</label>
        <input className="input" type="date" name="date" defaultValue={selectedDate}/>
      </div>
      <div className="field">
        <label>Campanha</label>
        <select className="select" name="campaign" defaultValue={selectedCampaign?.toString() || ""}>
          <option value="">Todas as campanhas</option>
          {campaigns.rows.map((campaign) =>
            <option key={campaign.campaign_id} value={campaign.campaign_id}>
              {campaign.campaign_id} · {campaign.campaign_name}
            </option>
          )}
        </select>
      </div>
      <button className="btn btn-primary" type="submit"><Gauge size={16}/> Aplicar</button>
    </form>

    <section className="monitor-productivity-wrap">
      <div className="monitor-productivity-head">
        <div>
          <h2>Filtro de produtividade · Attempts</h2>
          <p>Classificação baseada exclusivamente no AgentId da chamada.</p>
        </div>
      </div>

      <div className="monitor-productivity-cards">
        <Link
          href={productivityHref("ALL")}
          className={`monitor-productivity-card ${selectedProductivity === "ALL" ? "active" : ""}`}
        >
          <small>Geral</small>
          <strong>{integer(generalVolume)}</strong>
          <span>Todas as chamadas do recorte</span>
        </Link>

        <Link
          href={hasProductivity ? productivityHref("PRODUTIVO") : "#"}
          aria-disabled={!hasProductivity}
          className={`monitor-productivity-card productive ${selectedProductivity === "PRODUTIVO" ? "active" : ""} ${!hasProductivity ? "disabled" : ""}`}
        >
          <small>Produtivo</small>
          <strong>{hasProductivity ? integer(productiveVolume) : "—"}</strong>
          <span>AgentId &gt; 0</span>
        </Link>

        <Link
          href={hasProductivity ? productivityHref("IMPRODUTIVO") : "#"}
          aria-disabled={!hasProductivity}
          className={`monitor-productivity-card unproductive ${selectedProductivity === "IMPRODUTIVO" ? "active" : ""} ${!hasProductivity ? "disabled" : ""}`}
        >
          <small>Improdutivo</small>
          <strong>{hasProductivity ? integer(unproductiveVolume) : "—"}</strong>
          <span>AgentId = 0</span>
        </Link>
      </div>

      {!hasProductivity && <div className="monitor-productivity-note">
        O painel já está preparado para este filtro. Falta apenas o ETL receber a dimensão de AgentId da origem para separar Produtivo e Improdutivo sem inferência.
      </div>}
    </section>

    <div className="monitor-kpis">
      <article className="card monitor-kpi orange">
        <div className="monitor-kpi-top"><span>Volume monitorado</span><span className="monitor-kpi-icon"><Activity size={17}/></span></div>
        <div className="monitor-kpi-value">{integer(totalVolume)}</div>
        <small>{selectedCampaignName} · {number(summary?.rows_count)} linhas consolidadas</small>
      </article>

      <article className="card monitor-kpi">
        <div className="monitor-kpi-top"><span>Tempo médio</span><span className="monitor-kpi-icon"><Clock3 size={17}/></span></div>
        <div className="monitor-kpi-value">{durationLabel(avgSeconds)}</div>
        <small>{integer(totalSeconds)} segundos acumulados no recorte</small>
      </article>

      <article className="card monitor-kpi navy">
        <div className="monitor-kpi-top"><span>Retornos PBX</span><span className="monitor-kpi-icon"><PhoneCall size={17}/></span></div>
        <div className="monitor-kpi-value">{integer(pbxTotal)}</div>
        <small>{pbxResult.rows.length} classificações de telefonia</small>
      </article>

      <article className="card monitor-kpi success">
        <div className="monitor-kpi-top"><span>Campanhas</span><span className="monitor-kpi-icon"><Layers3 size={17}/></span></div>
        <div className="monitor-kpi-value">{number(summary?.campaigns)}</div>
        <small>CampaignIds ativos no recorte selecionado</small>
      </article>
    </div>

    <div className="monitor-grid">
      <HourlyChart rows={hourlyResult.rows}/>
      <section className="card monitor-panel">
        <div className="monitor-panel-head">
          <div>
            <h2>Telefonia · composição PBX</h2>
            <p>Principais retornos do roteamento no mesmo snapshot.</p>
          </div>
          <PhoneCall size={18}/>
        </div>

        <div className="monitor-pbx-cards">
          <div className="monitor-pbx-mini">
            <small>Carrier message</small>
            <strong>{integer(carrier)}</strong>
            <span>{pbxTotal ? percent((carrier / pbxTotal) * 100) : "0,0%"}</span>
          </div>
          <div className="monitor-pbx-mini">
            <small>No answer</small>
            <strong>{integer(noAnswer)}</strong>
            <span>{pbxTotal ? percent((noAnswer / pbxTotal) * 100) : "0,0%"}</span>
          </div>
          <div className="monitor-pbx-mini">
            <small>Normal received</small>
            <strong>{integer(normalReceived)}</strong>
            <span>{pbxTotal ? percent((normalReceived / pbxTotal) * 100) : "0,0%"}</span>
          </div>
        </div>

        <div className="monitor-ranking">
          {pbxResult.rows.slice(0, 7).map((row, index) => {
            const value = number(row.volume);
            const max = Math.max(...pbxResult.rows.map((item) => number(item.volume)), 1);
            return <div className="monitor-rank-row" key={row.label}>
              <div className="monitor-rank-label">
                <span className="monitor-rank-index">{String(index + 1).padStart(2, "0")}</span>
                <strong>{row.label}</strong>
                <span>{integer(value)}</span>
              </div>
              <div className="monitor-rank-track"><span className="navy" style={{width:`${Math.max(2,(value/max)*100)}%`}}/></div>
            </div>;
          })}
        </div>
      </section>
    </div>

    <div className="monitor-grid">
      <Ranking
        title="Tabulações dominantes"
        subtitle="Ranking por volume no snapshot selecionado."
        rows={tabulationResult.rows}
        variant="orange"
      />
      <Ranking
        title="Faixas de duração"
        subtitle="Distribuição das tentativas pelo tempo observado."
        rows={durationResult.rows}
        variant="blue"
      />
    </div>

    <div className="monitor-etl">
      <section className="card monitor-etl-card">
        <div className="monitor-panel-head">
          <div>
            <h2>Saúde da sincronização</h2>
            <p>Última execução registrada pelo OSP Monitor Engine.</p>
          </div>
          <Database size={18}/>
        </div>

        <div className="monitor-etl-status">
          <span className={`monitor-etl-orb ${etl?.status === "SUCCESS" ? "" : "error"}`}>
            {etl?.status === "SUCCESS" ? <RefreshCw size={19}/> : <TimerReset size={19}/>}
          </span>
          <div className="monitor-etl-copy">
            <strong>{etl?.status === "SUCCESS" ? "Sincronização concluída" : etl?.status || "Sem execução"}</strong>
            <span>{etl?.finished_at ? `Finalizada em ${dateTime(etl.finished_at)}` : "Aguardando execução"}</span>
          </div>
        </div>

        <div className="monitor-etl-metrics">
          <div className="monitor-etl-metric"><small>Duração</small><strong>{etl?.duration_ms ? `${(etl.duration_ms/1000).toFixed(1)}s` : "—"}</strong></div>
          <div className="monitor-etl-metric"><small>Tabulação</small><strong>{integer(number(etl?.inserted_tabulation))}</strong></div>
          <div className="monitor-etl-metric"><small>PBX</small><strong>{integer(number(etl?.inserted_pbx_return))}</strong></div>
        </div>
      </section>

      <section className="card monitor-etl-card">
        <div className="monitor-panel-head">
          <div>
            <h2>Campanhas no snapshot</h2>
            <p>Distribuição do volume entre os CampaignIds carregados.</p>
          </div>
          <Layers3 size={18}/>
        </div>

        <div className="monitor-campaign-list">
          {campaigns.rows.map((campaign) =>
            <div className="monitor-campaign-item" key={campaign.campaign_id}>
              <span className="monitor-campaign-id">{campaign.campaign_id}</span>
              <div>
                <strong>{campaign.campaign_name}</strong>
                <small>FastFlow · ADA</small>
              </div>
              <span className="monitor-campaign-volume">{integer(number(campaign.volume))}</span>
            </div>
          )}
        </div>
      </section>
    </div>
  </>;
}
