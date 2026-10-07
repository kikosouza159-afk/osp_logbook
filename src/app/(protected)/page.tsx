import Link from "next/link";
import { BookOpenCheck, Siren, Wrench, Clock3, CheckCircle2, Building2, Radar, Bot, Plus, RefreshCw } from "lucide-react";
import { KpiCard } from "@/components/kpi-card";
import { getDashboardSummary, getIncidents } from "@/lib/queries";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime, formatTime } from "@/lib/format";
import { requireUser } from "@/lib/auth";

export default async function DashboardPage() {
  const user = await requireUser();
  const [data, incidents] = await Promise.all([getDashboardSummary(), getIncidents({}, 8)]);
  const max = Math.max(...data.statuses.map(s=>s.total),1);
  const greeting = new Intl.DateTimeFormat("pt-BR", {timeZone:"America/Sao_Paulo", hour:"numeric", hour12:false}).format(new Date());
  const hello = Number(greeting) < 12 ? "Bom dia" : Number(greeting) < 18 ? "Boa tarde" : "Boa noite";
  return <>
    <div className="page-head"><div><h1>{hello}, {user.name.split(" ")[0]}.</h1><p>Aqui está o cenário operacional de hoje.</p></div><div style={{display:"flex",gap:10}}><Link className="btn btn-secondary" href="/"><RefreshCw size={16}/> Atualizar</Link><Link className="btn btn-primary" href="/incidents/new"><Plus size={17}/> Novo registro</Link></div></div>
    <div className="grid-kpi">
      <KpiCard label="Pontos hoje" value={data.totalToday} icon={BookOpenCheck}/><KpiCard label="Incidentes abertos" value={data.open} icon={Siren}/><KpiCard label="Em tratativa" value={data.inProgress} icon={Wrench}/><KpiCard label="Aguardando retorno" value={data.waiting} icon={Clock3}/>
      <KpiCard label="Resolvidos hoje" value={data.resolvedToday} icon={CheckCircle2}/><KpiCard label="Clientes impactados" value={data.affectedClients} icon={Building2}/><KpiCard label="Locator" value={data.locator} icon={Radar}/><KpiCard label="ADA" value={data.ada} icon={Bot}/>
    </div>
    <div className="grid-2">
      <section className="card panel"><div className="panel-title"><h2>Status de hoje</h2><span className="badge">Atualizado agora</span></div><div className="status-list">{data.statuses.map(s=><div className="status-row" key={s.code}><StatusBadge code={s.code} label={s.label}/><div className="bar"><span style={{width:`${Math.max((s.total/max)*100,s.total?5:0)}%`}}/></div><strong>{s.total}</strong></div>)}</div></section>
      <section className="card panel"><div className="panel-title"><h2>Últimas movimentações</h2><Link href="/history" style={{fontSize:12,color:"var(--blue)"}}>Ver histórico</Link></div>{data.recent.length ? <div className="timeline">{data.recent.map(r=><div className="timeline-item" key={r.id}><strong>{r.action.replaceAll("_"," ")}</strong><span>{formatTime(r.created_at)} · {r.user_name || "Sistema"}</span></div>)}</div> : <div className="empty"><strong>Sem movimentações</strong>O diário começa a ganhar vida com o primeiro registro.</div>}</section>
    </div>
    <section className="card table-card"><div className="panel" style={{paddingBottom:8}}><div className="panel-title"><h2>Registros recentes</h2><Link className="btn btn-secondary" href="/incidents">Ver todos</Link></div></div><div className="table-wrap"><table><thead><tr><th>Data/Hora</th><th>Cliente</th><th>Produto</th><th>Incidente</th><th>Chamado</th><th>Analista</th><th>Prioridade</th><th>Status</th></tr></thead><tbody>{incidents.map(i=><tr key={i.id}><td>{formatDateTime(i.created_at)}</td><td><strong>{i.client_name}</strong></td><td>{i.products || "—"}</td><td><Link href={`/incidents/${i.id}`}>{i.title}</Link></td><td>{i.ticket_id || "—"}</td><td>{i.analyst_name || "Não atribuído"}</td><td><StatusBadge code={i.priority_code}/></td><td><StatusBadge code={i.status_code} label={i.status_label}/></td></tr>)}</tbody></table></div></section>
  </>;
}
