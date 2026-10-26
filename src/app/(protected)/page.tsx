import Link from "next/link";
import {
  BookOpenCheck, Siren, Wrench, Clock3, CheckCircle2, Building2, Radar, Bot, Plus, RefreshCw,
  Target, RadioTower, FlaskConical, Code2, MessagesSquare, Layers3, ClipboardCheck,
  UsersRound, ChartNoAxesColumnIncreasing, CalendarDays, ArrowUpRight
} from "lucide-react";
import { KpiCard } from "@/components/kpi-card";
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

type Analyst = { id:string; name:string };
type Client = { id:string; display_name:string };
type Assignment = { analyst_id:string; client_id:string };
type ProgressRow = { analyst_id:string; client_id:string; completed:number; updated_at:string|null };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string,string|string[]|undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const view = typeof sp.view === "string" ? sp.view : "operation";
  const checklistDate = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todaySaoPaulo();

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
          COUNT(dci.id) FILTER (WHERE dci.completed=TRUE)::int completed,
          MAX(dc.updated_at)::text updated_at
        FROM daily_checklists dc
        LEFT JOIN daily_checklist_items dci ON dci.checklist_id=dc.id
        WHERE dc.checklist_date=$1::date
          ${user.role === "ADMIN" ? "" : "AND dc.analyst_id=$2"}
        GROUP BY dc.analyst_id,dc.client_id
      `, user.role === "ADMIN" ? [checklistDate] : [checklistDate,user.id]),
    ]);

    const analysts = analystsRes.rows;
    const clients = clientsRes.rows;
    const assignments = assignmentsRes.rows;
    const totalItems = CHECKLIST_ITEMS.length;
    const assignmentSet = new Set(assignments.map(a => `${a.analyst_id}:${a.client_id}`));
    const progressMap = new Map(progressRes.rows.map(r => [
      `${r.analyst_id}:${r.client_id}`,
      { completed:Number(r.completed || 0), updated_at:r.updated_at }
    ]));

    const getPairProgress = (analystId:string, clientId:string) => {
      if (!assignmentSet.has(`${analystId}:${clientId}`)) return null;
      const row = progressMap.get(`${analystId}:${clientId}`);
      const completed = row?.completed || 0;
      return {
        completed,
        pct: totalItems ? Math.round((completed / totalItems) * 100) : 0,
        updated_at: row?.updated_at || null,
      };
    };

    const analystSummary = analysts.map(a => {
      const linked = clients.filter(c => assignmentSet.has(`${a.id}:${c.id}`));
      const progresses = linked.map(c => getPairProgress(a.id,c.id)!).filter(Boolean);
      const completedItems = progresses.reduce((sum,p) => sum + p.completed,0);
      const expected = linked.length * totalItems;
      const pct = expected ? Math.round((completedItems / expected) * 100) : 0;
      return {
        ...a,
        linked: linked.length,
        completedClients: progresses.filter(p => p.pct === 100).length,
        pct,
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

      <div className="checklist-dashboard-two">
        <section className="card checklist-ranking-panel">
          <div className="panel-title">
            <div><h2>Progresso por analista</h2><p>Consolidação dos clientes vinculados a cada analista.</p></div>
            <span className="badge">{analysts.length} analista(s)</span>
          </div>
          <div className="checklist-ranking-list">
            {analystSummary.map(a => <div className="checklist-ranking-row" key={a.id}>
              <div className="checklist-ranking-meta">
                <strong>{a.name}</strong>
                <span>{a.completedClients}/{a.linked} cliente(s) em 100%</span>
              </div>
              <div className="checklist-ranking-bar"><span style={{width:`${a.pct}%`}}/></div>
              <b>{a.pct}%</b>
            </div>)}
            {!analystSummary.length && <div className="empty"><strong>Sem analistas vinculados</strong>Cadastre ou vincule analistas para iniciar o acompanhamento.</div>}
          </div>
        </section>

        <section className="card checklist-ranking-panel">
          <div className="panel-title">
            <div><h2>Progresso por cliente</h2><p>Consolidação do checklist entre os analistas vinculados.</p></div>
            <span className="badge">{clients.length} cliente(s)</span>
          </div>
          <div className="checklist-ranking-list">
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
      </div>

      <section className="card checklist-matrix-panel">
        <div className="panel-title checklist-matrix-title">
          <div>
            <h2>Matriz de progresso · Analista × Cliente</h2>
            <p>Visão estilo Gantt para identificar rapidamente checklists pendentes, em andamento e concluídos.</p>
          </div>
          <div className="checklist-matrix-legend">
            <span><i className="status-zero"/>0%</span>
            <span><i className="status-progress"/>Em andamento</span>
            <span><i className="status-done"/>100%</span>
            <span><i className="status-unlinked"/>Não vinculado</span>
          </div>
        </div>

        <div className="checklist-matrix-wrap">
          <table className="checklist-matrix">
            <thead>
              <tr>
                <th>Analista</th>
                {clients.map(c => <th key={c.id} title={c.display_name}>{c.display_name}</th>)}
              </tr>
            </thead>
            <tbody>
              {analysts.map(a => <tr key={a.id}>
                <th>{a.name}</th>
                {clients.map(c => {
                  const progress = getPairProgress(a.id,c.id);
                  if (!progress) return <td key={c.id}><div className="matrix-cell unlinked" title="Cliente não vinculado a este analista">—</div></td>;
                  const state = progress.pct === 100 ? "done" : progress.pct > 0 ? "progress" : "zero";
                  return <td key={c.id}>
                    <Link
                      className={`matrix-cell ${state}`}
                      href={`/checklist?date=${checklistDate}&analyst=${a.id}&client=${c.id}`}
                      title={`${a.name} · ${c.display_name}: ${progress.completed}/${totalItems} validações`}
                    >
                      <span className="matrix-cell-value">{progress.pct}%</span>
                      <span className="matrix-cell-track"><i style={{width:`${progress.pct}%`}}/></span>
                    </Link>
                  </td>;
                })}
              </tr>)}
            </tbody>
          </table>
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
