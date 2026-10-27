import Link from "next/link";
import {
  BookOpenCheck, Siren, Wrench, Clock3, CheckCircle2, Building2, Radar, Bot, Plus, RefreshCw,
  Target, RadioTower, FlaskConical, Code2, MessagesSquare, Layers3, ClipboardCheck,
  UsersRound, ChartNoAxesColumnIncreasing, CalendarDays, CalendarRange, ArrowUpRight
} from "lucide-react";
import { KpiCard } from "@/components/kpi-card";
import { HeaderUserAvatar } from "@/components/header-user-avatar";
import { getDashboardSummary, getIncidents } from "@/lib/queries";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime, formatTime } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { CHECKLIST_ITEMS } from "@/lib/checklist";

const areaIcons = {
  OSP: Target,
  OTS: RadioTower,
  OLAB: FlaskConical,
  ODE: Code2,
  OIE: MessagesSquare,
} as const;

function todaySaoPaulo() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function shiftDate(date:string, delta:number) {
  const [year,month,day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year,month-1,day));
  value.setUTCDate(value.getUTCDate()+delta);
  return value.toISOString().slice(0,10);
}

function historyDayLabel(date:string) {
  const [year,month,day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year,month-1,day));
  const weekday = new Intl.DateTimeFormat("pt-BR", {
    weekday:"short",
    timeZone:"UTC",
  }).format(value).replace(".","");
  return {
    weekday:weekday.charAt(0).toUpperCase()+weekday.slice(1),
    day:`${String(day).padStart(2,"0")}/${String(month).padStart(2,"0")}`,
  };
}

type Analyst = { id:string; name:string };
type Client = { id:string; display_name:string };
type Assignment = { analyst_id:string; client_id:string };
type ProgressRow = { analyst_id:string; client_id:string; completed:number; errors:number; validating:number; updated_at:string|null };
type HistoryProgressRow = {
  checklist_date:string;
  analyst_id:string;
  client_id:string;
  completed:number;
  errors:number;
  validating:number;
  recorded:number;
  updated_at:string|null;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string,string|string[]|undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const view = typeof sp.view === "string" ? sp.view : "operation";
  const checklistDate = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todaySaoPaulo();
  const historyPeriodRaw = typeof sp.period === "string" ? Number(sp.period) : 7;
  const historyPeriod = [7,15,30].includes(historyPeriodRaw) ? historyPeriodRaw : 7;
  const historyAnalystFilter = typeof sp.hist_analyst === "string" ? sp.hist_analyst : "";
  const historyClientFilter = typeof sp.hist_client === "string" ? sp.hist_client : "";

  const greeting = new Intl.DateTimeFormat("pt-BR", {
    timeZone:"America/Sao_Paulo",
    hour:"numeric",
    hour12:false,
  }).format(new Date());
  const hello = Number(greeting) < 12 ? "Bom dia" : Number(greeting) < 18 ? "Boa tarde" : "Boa noite";

  if (view === "checklist") {
    const analystWhere = user.role === "ADMIN" ? "" : "AND u.id=$1";
    const analystParams = user.role === "ADMIN" ? [] : [user.id];

    const [analystsRes, clientsRes, assignmentsRes, progressRes] = await Promise.all([
      query<Analyst>(`
        SELECT u.id,u.name
        FROM users u
        WHERE u.active=TRUE AND u.role='ANALYST' ${analystWhere}
        ORDER BY u.name
      `, analystParams),
      query<Client>(`
        SELECT id,display_name
        FROM clients
        WHERE active=TRUE
        ORDER BY display_name
      `),
      query<Assignment>(`
        SELECT ac.analyst_id,ac.client_id
        FROM analyst_clients ac
        JOIN users u ON u.id=ac.analyst_id
        JOIN clients c ON c.id=ac.client_id
        WHERE u.active=TRUE AND c.active=TRUE
          AND u.role='ANALYST'
          ${user.role === "ADMIN" ? "" : "AND ac.analyst_id=$1"}
      `, analystParams),
      query<ProgressRow>(`
        SELECT
          dc.analyst_id,
          dc.client_id,
          COUNT(dci.id) FILTER (WHERE dci.status='CONCLUIDO')::int completed,
          COUNT(dci.id) FILTER (WHERE dci.status='COM_ERRO')::int errors,
          COUNT(dci.id) FILTER (WHERE dci.status='EM_VALIDACAO')::int validating,
          MAX(dc.updated_at)::text updated_at
        FROM daily_checklists dc
        LEFT JOIN daily_checklist_items dci ON dci.checklist_id=dc.id
        WHERE dc.checklist_date=$1::date
          ${user.role === "ADMIN" ? "" : "AND dc.analyst_id=$2"}
        GROUP BY dc.analyst_id,dc.client_id
      `, user.role === "ADMIN" ? [checklistDate] : [checklistDate,user.id]),
    ]);

    const historyStart = shiftDate(checklistDate,-(historyPeriod-1));
    const historyRes = await query<HistoryProgressRow>(`
      SELECT
        dc.checklist_date::text,
        dc.analyst_id,
        dc.client_id,
        COUNT(dci.id) FILTER (WHERE dci.status='CONCLUIDO')::int completed,
        COUNT(dci.id) FILTER (WHERE dci.status='COM_ERRO')::int errors,
        COUNT(dci.id) FILTER (WHERE dci.status='EM_VALIDACAO')::int validating,
        COUNT(dci.id)::int recorded,
        MAX(dc.updated_at)::text updated_at
      FROM daily_checklists dc
      LEFT JOIN daily_checklist_items dci ON dci.checklist_id=dc.id
      WHERE dc.checklist_date BETWEEN $1::date AND $2::date
        ${user.role === "ADMIN" ? "" : "AND dc.analyst_id=$3"}
      GROUP BY dc.checklist_date,dc.analyst_id,dc.client_id
      ORDER BY dc.checklist_date,dc.analyst_id,dc.client_id
    `, user.role === "ADMIN"
      ? [historyStart,checklistDate]
      : [historyStart,checklistDate,user.id]
    );

    const analysts = analystsRes.rows;
    const clients = clientsRes.rows;
    const assignments = assignmentsRes.rows;
    const totalItems = CHECKLIST_ITEMS.length;
    const assignmentSet = new Set(assignments.map(a => `${a.analyst_id}:${a.client_id}`));
    const progressMap = new Map(progressRes.rows.map(r => [
      `${r.analyst_id}:${r.client_id}`,
      {
        completed:Number(r.completed || 0),
        errors:Number(r.errors || 0),
        validating:Number(r.validating || 0),
        updated_at:r.updated_at
      }
    ]));

    const getPairProgress = (analystId:string, clientId:string) => {
      if (!assignmentSet.has(`${analystId}:${clientId}`)) return null;
      const row = progressMap.get(`${analystId}:${clientId}`);
      const completed = row?.completed || 0;
      const errors = row?.errors || 0;
      const validating = row?.validating || 0;
      return {
        completed,
        errors,
        validating,
        pct: totalItems ? Math.round((completed / totalItems) * 100) : 0,
        errorPct: totalItems ? Math.round((errors / totalItems) * 100) : 0,
        updated_at: row?.updated_at || null,
      };
    };

    const analystSummary = analysts.map(a => {
      const linkedClients = clients
        .filter(c => assignmentSet.has(`${a.id}:${c.id}`))
        .map(c => ({
          ...c,
          progress: getPairProgress(a.id,c.id)!,
        }));
      const completedItems = linkedClients.reduce((sum,c) => sum + c.progress.completed,0);
      const errorItems = linkedClients.reduce((sum,c) => sum + c.progress.errors,0);
      const validatingItems = linkedClients.reduce((sum,c) => sum + c.progress.validating,0);
      const expected = linkedClients.length * totalItems;
      const pct = expected ? Math.round((completedItems / expected) * 100) : 0;
      const errorPct = expected ? Math.round((errorItems / expected) * 100) : 0;
      return {
        ...a,
        linked: linkedClients.length,
        completedClients: linkedClients.filter(c => c.progress.pct === 100).length,
        pct,
        errorPct,
        completedItems,
        errorItems,
        validatingItems,
        clients: linkedClients,
      };
    });

    const clientSummary = clients.map(c => {
      const linked = analysts.filter(a => assignmentSet.has(`${a.id}:${c.id}`));
      const progresses = linked.map(a => getPairProgress(a.id,c.id)!).filter(Boolean);
      const completedItems = progresses.reduce((sum,p) => sum + p.completed,0);
      const expected = linked.length * totalItems;
      const pct = expected ? Math.round((completedItems / expected) * 100) : 0;
      return {
        ...c,
        linked: linked.length,
        completedAnalysts: progresses.filter(p => p.pct === 100).length,
        pct,
      };
    });

    const assignedPairs = assignments.map(a => getPairProgress(a.analyst_id,a.client_id)!).filter(Boolean);
    const overallCompletedItems = assignedPairs.reduce((sum,p) => sum + p.completed,0);
    const overallExpectedItems = assignments.length * totalItems;
    const overallPct = overallExpectedItems ? Math.round((overallCompletedItems / overallExpectedItems) * 100) : 0;
    const started = assignedPairs.filter(p => p.pct > 0).length;
    const finished = assignedPairs.filter(p => p.pct === 100).length;
    const notStarted = Math.max(assignments.length - started,0);
    const historyDays = Array.from({length:historyPeriod},(_,index)=>shiftDate(historyStart,index));
    const validHistoryAnalyst = analysts.some(a=>a.id===historyAnalystFilter) ? historyAnalystFilter : "";
    const historyClientOptions = validHistoryAnalyst
      ? clients.filter(client=>assignmentSet.has(`${validHistoryAnalyst}:${client.id}`))
      : clients.filter(client=>assignments.some(pair=>pair.client_id===client.id));
    const validHistoryClient = historyClientOptions.some(client=>client.id===historyClientFilter) ? historyClientFilter : "";

    const historyPairs = assignments
      .filter(pair=>!validHistoryAnalyst || pair.analyst_id===validHistoryAnalyst)
      .filter(pair=>!validHistoryClient || pair.client_id===validHistoryClient)
      .map(pair=>({
        ...pair,
        analyst:analysts.find(a=>a.id===pair.analyst_id)!,
        client:clients.find(client=>client.id===pair.client_id)!,
      }))
      .filter(pair=>pair.analyst && pair.client)
      .sort((a,b)=>a.analyst.name.localeCompare(b.analyst.name,"pt-BR") || a.client.display_name.localeCompare(b.client.display_name,"pt-BR"));

    const historyRows = historyRes.rows
      .filter(row=>!validHistoryAnalyst || row.analyst_id===validHistoryAnalyst)
      .filter(row=>!validHistoryClient || row.client_id===validHistoryClient);

    const historyMap = new Map(historyRows.map(row=>[
      `${row.checklist_date}:${row.analyst_id}:${row.client_id}`,
      {
        completed:Number(row.completed || 0),
        errors:Number(row.errors || 0),
        validating:Number(row.validating || 0),
        recorded:Number(row.recorded || 0),
        updated_at:row.updated_at,
      }
    ]));

    const historyCell = (date:string,analystId:string,clientId:string) => {
      const value = historyMap.get(`${date}:${analystId}:${clientId}`);
      const completed = value?.completed || 0;
      const errors = value?.errors || 0;
      const validating = value?.validating || 0;
      const recorded = value?.recorded || 0;
      const pct = totalItems ? Math.round((completed/totalItems)*100) : 0;
      const errorPct = totalItems ? Math.round((errors/totalItems)*100) : 0;
      const state = recorded === 0
        ? "empty"
        : errors > 0
          ? "error"
          : pct === 100
            ? "done"
            : "validating";
      return {completed,errors,validating,recorded,pct,errorPct,state};
    };

    const historyExpectedPerDay = historyPairs.length * totalItems;
    const historyDaily = historyDays.map(date=>{
      const cells = historyPairs.map(pair=>historyCell(date,pair.analyst_id,pair.client_id));
      const completed = cells.reduce((sum,item)=>sum+item.completed,0);
      const errors = cells.reduce((sum,item)=>sum+item.errors,0);
      const startedPairs = cells.filter(item=>item.recorded>0).length;
      return {
        date,
        pct:historyExpectedPerDay ? Math.round((completed/historyExpectedPerDay)*100) : 0,
        errors,
        startedPairs,
      };
    });

    const historyDaysFilled = new Set(historyRows.map(row=>row.checklist_date)).size;
    const historyCompletedTotal = historyRows.reduce((sum,row)=>sum+Number(row.completed || 0),0);
    const historyErrorTotal = historyRows.reduce((sum,row)=>sum+Number(row.errors || 0),0);
    const historyAveragePct = historyRows.length
      ? Math.round((historyCompletedTotal/(historyRows.length*totalItems))*100)
      : 0;
    const historyClientsMonitored = new Set(historyRows.map(row=>row.client_id)).size;

    return <>
      <div className="page-head">
        <div>
          <h1>{hello}, {user.name.split(" ")[0]}.</h1>
          <p>Acompanhamento visual do checklist operacional por analista e cliente.</p>
        </div>
        <div style={{display:"flex",gap:10}}>
          <Link className="btn btn-secondary" href={`/?view=checklist&date=${checklistDate}`}><RefreshCw size={16}/> Atualizar</Link>
          <Link className="btn btn-primary" href="/checklist"><ClipboardCheck size={17}/> Abrir checklist</Link>
        </div>
      </div>

      <nav className="dashboard-tabs" aria-label="Visões da página inicial">
        <Link className="dashboard-tab" href="/"><Layers3 size={16}/> Operação</Link>
        <Link className="dashboard-tab active" href={`/?view=checklist&date=${checklistDate}`}><ClipboardCheck size={16}/> Checklist</Link>
      </nav>

      <section className="checklist-hero card">
        <div className="checklist-hero-main">
          <span className="checklist-hero-kicker">Progresso geral do dia</span>
          <div className="checklist-hero-value">{overallPct}%</div>
          <p>{overallCompletedItems} de {overallExpectedItems || 0} validações concluídas em {assignments.length} carteira(s) vinculada(s).</p>
          <div className="checklist-hero-track"><span style={{width:`${overallPct}%`}}/></div>
        </div>
        <form method="get" className="checklist-dashboard-date">
          <input type="hidden" name="view" value="checklist"/>
          <label><CalendarDays size={15}/> Data de referência</label>
          <div>
            <input className="input" type="date" name="date" defaultValue={checklistDate}/>
            <button className="btn btn-secondary" type="submit">Aplicar</button>
          </div>
        </form>
      </section>

      <div className="checklist-dashboard-kpis">
        <article className="card checklist-dashboard-kpi">
          <span className="checklist-dashboard-kpi-icon"><UsersRound size={18}/></span>
          <div><small>Analistas</small><strong>{analysts.length}</strong><span>ativos no acompanhamento</span></div>
        </article>
        <article className="card checklist-dashboard-kpi">
          <span className="checklist-dashboard-kpi-icon"><Building2 size={18}/></span>
          <div><small>Clientes</small><strong>{clients.length}</strong><span>ativos no painel</span></div>
        </article>
        <article className="card checklist-dashboard-kpi">
          <span className="checklist-dashboard-kpi-icon"><Clock3 size={18}/></span>
          <div><small>Não iniciados</small><strong>{notStarted}</strong><span>carteiras em 0%</span></div>
        </article>
        <article className="card checklist-dashboard-kpi">
          <span className="checklist-dashboard-kpi-icon"><CheckCircle2 size={18}/></span>
          <div><small>Concluídos</small><strong>{finished}</strong><span>carteiras em 100%</span></div>
        </article>
      </div>

      <section className="card checklist-ranking-panel checklist-ranking-wide">
        <div className="panel-title">
          <div><h2>Progresso por cliente</h2><p>Consolidação do checklist entre os analistas vinculados.</p></div>
          <span className="badge">{clients.length} cliente(s)</span>
        </div>
        <div className="checklist-ranking-list checklist-client-ranking-list">
          {clientSummary.map(c => <div className="checklist-ranking-row" key={c.id}>
            <div className="checklist-ranking-meta">
              <strong>{c.display_name}</strong>
              <span>{c.linked ? `${c.completedAnalysts}/${c.linked} analista(s) em 100%` : "Sem analista vinculado"}</span>
            </div>
            <div className="checklist-ranking-bar"><span style={{width:`${c.pct}%`}}/></div>
            <b>{c.pct}%</b>
          </div>)}
        </div>
      </section>

      <section className="analyst-progress-section">
        <div className="analyst-progress-section-head">
          <div>
            <span className="checklist-hero-kicker">Analista × Cliente</span>
            <h2>Acompanhamento do time</h2>
            <p>Cada card consolida o checklist do analista e detalha o progresso dos clientes vinculados.</p>
          </div>
          <div className="analyst-progress-legend">
            <span><i className="done"/>Concluído</span>
            <span><i className="error"/>Com erro</span>
            <span><i className="validating"/>Em validação</span>
          </div>
        </div>

        <div className="analyst-progress-grid">
          {analystSummary.map(a => <article className="card analyst-progress-card" key={a.id}>
            <div className="analyst-progress-header">
              <HeaderUserAvatar userId={a.id} name={a.name} variant="analyst-card"/>
              <div className="analyst-progress-identity">
                <span>Analista</span>
                <h3>{a.name}</h3>
                <small>{a.linked} cliente(s) vinculado(s)</small>
              </div>
              <div className="analyst-progress-total">
                <strong>{a.pct}%</strong>
                <span>concluído</span>
              </div>
            </div>

            <div className="analyst-progress-metrics">
              <div className="analyst-progress-metric done">
                <span>Concluído</span>
                <strong>{a.pct}%</strong>
                <small>{a.completedItems} validações</small>
              </div>
              <div className="analyst-progress-metric error">
                <span>Com erro</span>
                <strong>{a.errorPct}%</strong>
                <small>{a.errorItems} validações</small>
              </div>
              <div className="analyst-progress-metric validating">
                <span>Em validação</span>
                <strong>{a.validatingItems}</strong>
                <small>itens em andamento</small>
              </div>
            </div>

            <div className="analyst-progress-stack" aria-label={`Progresso geral de ${a.name}`}>
              <span className="done" style={{width:`${a.pct}%`}}/>
              <span className="error" style={{width:`${a.errorPct}%`}}/>
            </div>

            <div className="analyst-client-list-head">
              <div>
                <strong>Clientes associados</strong>
                <span>{a.completedClients}/{a.linked} concluídos em 100%</span>
              </div>
            </div>

            <div className="analyst-client-list">
              {a.clients.map(client => {
                const p = client.progress;
                const state = p.pct === 100 ? "done" : p.errors > 0 ? "error" : p.completed > 0 || p.validating > 0 ? "progress" : "zero";
                return <Link
                  key={client.id}
                  className={`analyst-client-row ${state}`}
                  href={`/checklist?date=${checklistDate}&analyst=${a.id}&client=${client.id}`}
                  title={`Abrir checklist de ${client.display_name}`}
                >
                  <div className="analyst-client-main">
                    <div className="analyst-client-name">
                      <strong>{client.display_name}</strong>
                      <span>{p.completed}/{totalItems} validações concluídas</span>
                    </div>
                    <b>{p.pct}%</b>
                  </div>
                  <div className="analyst-client-track">
                    <span className="done" style={{width:`${p.pct}%`}}/>
                  </div>
                  <div className="analyst-client-footer">
                    <span className="client-status">
                      {p.pct === 100 ? "Concluído" : p.errors > 0 ? `${p.errors} com erro` : p.validating > 0 ? `${p.validating} em validação` : "Não iniciado"}
                    </span>
                    {p.errors > 0 && <span className="client-error-pill">{p.errorPct}% erro</span>}
                    <span className="client-open">Abrir checklist <ArrowUpRight size={13}/></span>
                  </div>
                </Link>;
              })}
              {!a.clients.length && <div className="analyst-client-empty">Nenhum cliente vinculado a este analista.</div>}
            </div>
          </article>)}

          {!analystSummary.length && <div className="card empty">
            <strong>Sem analistas vinculados</strong>
            Cadastre ou vincule analistas para iniciar o acompanhamento.
          </div>}
        </div>
      </section>

      <section className="card checklist-attention-panel">
        <div className="panel-title">
          <div><h2>Carteiras que exigem atenção</h2><p>Combinações vinculadas que ainda não chegaram a 100% na data selecionada.</p></div>
          <ChartNoAxesColumnIncreasing size={20}/>
        </div>
        <div className="checklist-attention-grid">
          {assignments
            .map(pair => {
              const analyst = analysts.find(a => a.id === pair.analyst_id);
              const client = clients.find(c => c.id === pair.client_id);
              const progress = getPairProgress(pair.analyst_id,pair.client_id);
              return analyst && client && progress && progress.pct < 100 ? {analyst,client,progress} : null;
            })
            .filter(Boolean)
            .sort((a,b) => a!.progress.pct - b!.progress.pct)
            .map(item => <Link
              key={`${item!.analyst.id}:${item!.client.id}`}
              className="checklist-attention-card"
              href={`/checklist?date=${checklistDate}&analyst=${item!.analyst.id}&client=${item!.client.id}`}
            >
              <div><strong>{item!.client.display_name}</strong><span>{item!.analyst.name}</span></div>
              <div className="checklist-attention-progress"><i style={{width:`${item!.progress.pct}%`}}/></div>
              <b>{item!.progress.pct}%</b>
              <ArrowUpRight size={15}/>
            </Link>)}
          {!assignments.some(pair => {
            const p = getPairProgress(pair.analyst_id,pair.client_id);
            return p && p.pct < 100;
          }) && <div className="empty"><strong>Nenhuma pendência</strong>Todos os checklists vinculados estão concluídos para esta data.</div>}
        </div>
      </section>

      <section className="card checklist-history-panel">
        <div className="checklist-history-head">
          <div>
            <span className="checklist-hero-kicker">Histórico operacional</span>
            <h2>Evolução diária dos checklists</h2>
            <p>Timeline estilo Gantt para acompanhar, dia a dia, a execução de cada checklist por analista e cliente.</p>
          </div>

          <form className="checklist-history-filters" method="get">
            <input type="hidden" name="view" value="checklist"/>
            <input type="hidden" name="date" value={checklistDate}/>
            <div className="checklist-history-periods">
              {[7,15,30].map(period=><button
                key={period}
                type="submit"
                name="period"
                value={period}
                className={`history-period-button ${historyPeriod===period ? "active" : ""}`}
              >{period} dias</button>)}
            </div>
            {user.role === "ADMIN" && <label>
              <span>Analista</span>
              <select className="select" name="hist_analyst" defaultValue={validHistoryAnalyst}>
                <option value="">Todos</option>
                {analysts.map(analyst=><option key={analyst.id} value={analyst.id}>{analyst.name}</option>)}
              </select>
            </label>}
            <label>
              <span>Cliente</span>
              <select className="select" name="hist_client" defaultValue={validHistoryClient}>
                <option value="">Todos</option>
                {historyClientOptions.map(client=><option key={client.id} value={client.id}>{client.display_name}</option>)}
              </select>
            </label>
            <button className="btn btn-secondary" type="submit"><CalendarRange size={15}/> Aplicar</button>
          </form>
        </div>

        <div className="checklist-history-kpis">
          <div className="history-kpi">
            <span>Dias preenchidos</span>
            <strong>{historyDaysFilled}</strong>
            <small>de {historyPeriod} dias no período</small>
          </div>
          <div className="history-kpi">
            <span>Média concluída</span>
            <strong>{historyAveragePct}%</strong>
            <small>dos checklists registrados</small>
          </div>
          <div className="history-kpi error">
            <span>Itens com erro</span>
            <strong>{historyErrorTotal}</strong>
            <small>ocorrências no período</small>
          </div>
          <div className="history-kpi">
            <span>Clientes monitorados</span>
            <strong>{historyClientsMonitored}</strong>
            <small>com registro no período</small>
          </div>
        </div>

        <div className="history-daily-pulse">
          <div className="history-daily-pulse-title">
            <strong>Pulso diário</strong>
            <span>Percentual consolidado considerando todas as carteiras exibidas.</span>
          </div>
          <div className="history-daily-pulse-track">
            {historyDaily.map(day=>{
              const label=historyDayLabel(day.date);
              const state=day.errors>0 ? "error" : day.pct===100 ? "done" : day.startedPairs>0 ? "progress" : "empty";
              return <div className={`history-day-pulse ${state}`} key={day.date} title={`${day.date}: ${day.pct}% concluído · ${day.errors} erro(s)`}>
                <span>{label.weekday}</span>
                <strong>{label.day}</strong>
                <div className="history-day-pulse-bar"><i style={{height:`${Math.max(day.pct,day.startedPairs ? 8 : 2)}%`}}/></div>
                <b>{day.pct}%</b>
                {day.errors>0 && <small>{day.errors} erro(s)</small>}
              </div>;
            })}
          </div>
        </div>

        <div className="checklist-gantt-legend">
          <span><i className="done"/>Concluído</span>
          <span><i className="validating"/>Em validação</span>
          <span><i className="error"/>Com erro</span>
          <span><i className="empty"/>Sem preenchimento</span>
          <small>Clique em qualquer dia para abrir o checklist correspondente.</small>
        </div>

        <div className="checklist-gantt-wrap">
          <div className="checklist-gantt-grid" style={{gridTemplateColumns:`260px repeat(${historyDays.length},78px)`}}>
            <div className="gantt-corner">
              <strong>Analista / Cliente</strong>
              <span>{historyStart.split("-").reverse().join("/")} → {checklistDate.split("-").reverse().join("/")}</span>
            </div>
            {historyDays.map(date=>{
              const label=historyDayLabel(date);
              return <div className={`gantt-day-head ${date===checklistDate ? "today" : ""}`} key={date}>
                <span>{label.weekday}</span>
                <strong>{label.day}</strong>
              </div>;
            })}

            {historyPairs.map(pair=><div className="gantt-row-fragment" key={`${pair.analyst_id}:${pair.client_id}`} style={{display:"contents"}}>
              <div className="gantt-row-label">
                <HeaderUserAvatar userId={pair.analyst.id} name={pair.analyst.name} variant="analyst-card"/>
                <div>
                  <strong>{pair.client.display_name}</strong>
                  <span>{pair.analyst.name}</span>
                </div>
              </div>
              {historyDays.map(date=>{
                const cell=historyCell(date,pair.analyst_id,pair.client_id);
                const label=historyDayLabel(date);
                return <Link
                  key={date}
                  className={`gantt-cell ${cell.state}`}
                  href={`/checklist?date=${date}&analyst=${pair.analyst_id}&client=${pair.client_id}`}
                  title={`${pair.analyst.name} · ${pair.client.display_name} · ${label.day}\nConcluído: ${cell.pct}% (${cell.completed}/${totalItems})\nEm validação: ${cell.validating}\nCom erro: ${cell.errors}`}
                >
                  <span className="gantt-cell-percent">{cell.pct}%</span>
                  <span className="gantt-cell-bar"><i style={{width:`${cell.pct}%`}}/></span>
                  {cell.errors>0 && <span className="gantt-cell-error">{cell.errors}</span>}
                </Link>;
              })}
            </div>)}
          </div>

          {!historyPairs.length && <div className="history-empty-state">
            <CalendarRange size={28}/>
            <strong>Nenhuma combinação encontrada</strong>
            <span>Ajuste os filtros de analista/cliente ou vincule clientes aos analistas.</span>
          </div>}
        </div>
      </section>
    </>;
  }

  const [data, incidents] = await Promise.all([getDashboardSummary(), getIncidents({}, 8)]);
  const max = Math.max(...data.statuses.map(s=>s.total),1);

  return <>
    <div className="page-head"><div><h1>{hello}, {user.name.split(" ")[0]}.</h1><p>Aqui está o cenário operacional de hoje.</p></div><div style={{display:"flex",gap:10}}><Link className="btn btn-secondary" href="/"><RefreshCw size={16}/> Atualizar</Link><Link className="btn btn-primary" href="/incidents/new"><Plus size={17}/> Novo registro</Link></div></div>

    <nav className="dashboard-tabs" aria-label="Visões da página inicial">
      <Link className="dashboard-tab active" href="/"><Layers3 size={16}/> Operação</Link>
      <Link className="dashboard-tab" href="/?view=checklist"><ClipboardCheck size={16}/> Checklist</Link>
    </nav>

    <div className="grid-kpi">
      <KpiCard label="Pontos hoje" value={data.totalToday} icon={BookOpenCheck}/><KpiCard label="Incidentes abertos" value={data.open} icon={Siren}/><KpiCard label="Em tratativa" value={data.inProgress} icon={Wrench}/><KpiCard label="Aguardando retorno" value={data.waiting} icon={Clock3}/>
      <KpiCard label="Resolvidos hoje" value={data.resolvedToday} icon={CheckCircle2}/><KpiCard label="Clientes impactados" value={data.affectedClients} icon={Building2}/><KpiCard label="Locator" value={data.locator} icon={Radar}/><KpiCard label="ADA" value={data.ada} icon={Bot}/>
    </div>

    <section className="area-overview">
      <div className="panel-title area-title"><div><h2>Chamados por área</h2><p>Distribuição dos registros adicionados hoje.</p></div><span className="badge">{data.totalToday} registros</span></div>
      <div className="area-grid">
        {data.areas.map(a=>{
          const Icon = areaIcons[a.code as keyof typeof areaIcons] ?? Layers3;
          const pct = a.share.toFixed(1).replace(".",",");
          return <article className={`card area-card area-${a.code.toLowerCase()}`} key={a.code}>
            <div className="area-card-head"><span className="area-card-icon"><Icon size={21}/></span><span className="area-code">{a.code === "OIE" ? "OIE" : a.code}</span></div>
            <strong className="area-card-value">{a.total}</strong>
            <span className="area-card-name">{a.name}</span>
            <div className="area-share"><span>{pct}% do dia</span><div className="area-progress"><i style={{width:`${Math.min(a.share,100)}%`}}/></div></div>
          </article>;
        })}
      </div>
    </section>

    <div className="grid-2">
      <section className="card panel"><div className="panel-title"><h2>Status de hoje</h2><span className="badge">Atualizado agora</span></div><div className="status-list">{data.statuses.map(s=><div className="status-row" key={s.code}><StatusBadge code={s.code} label={s.label}/><div className="bar"><span style={{width:`${Math.max((s.total/max)*100,s.total?5:0)}%`}}/></div><strong>{s.total}</strong></div>)}</div></section>
      <section className="card panel"><div className="panel-title"><h2>Últimas movimentações</h2><Link href="/history" style={{fontSize:12,color:"var(--blue)"}}>Ver histórico</Link></div>{data.recent.length ? <div className="timeline">{data.recent.map(r=><div className="timeline-item" key={r.id}><strong>{r.action.replaceAll("_"," ")}</strong><span>{formatTime(r.created_at)} · {r.user_name || "Sistema"}</span></div>)}</div> : <div className="empty"><strong>Sem movimentações</strong>O diário começa a ganhar vida com o primeiro registro.</div>}</section>
    </div>

    <section className="card table-card"><div className="panel" style={{paddingBottom:8}}><div className="panel-title"><h2>Registros recentes</h2><Link className="btn btn-secondary" href="/incidents">Ver todos</Link></div></div><div className="table-wrap"><table><thead><tr><th>Data/Hora</th><th>Área</th><th>Cliente</th><th>Produto</th><th>Incidente</th><th>Chamado</th><th>Analista</th><th>Prioridade</th><th>Status</th></tr></thead><tbody>{incidents.map(i=><tr key={i.id}><td>{formatDateTime(i.created_at)}</td><td>{i.area_code ? <span className="badge">{i.area_code}</span> : "—"}</td><td><strong>{i.client_name}</strong></td><td>{i.products || "—"}</td><td><Link prefetch={false} href={`/incidents/${i.id}`}>{i.title}</Link></td><td>{i.ticket_id || "—"}</td><td>{i.analyst_name || "Não atribuído"}</td><td><StatusBadge code={i.priority_code}/></td><td><StatusBadge code={i.status_code} label={i.status_label}/></td></tr>)}</tbody></table></div></section>
  </>;
}
