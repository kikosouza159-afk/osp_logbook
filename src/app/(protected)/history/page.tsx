import Link from "next/link";
import { Archive, CheckCircle2, Clock3, Search } from "lucide-react";
import { query } from "@/lib/db";
import { clientOptionLabel, formatDateTime } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { KpiCard } from "@/components/kpi-card";
import { getAreas, getClients, getStatuses } from "@/lib/queries";

type HistoryRow = {
  id:string;
  title:string;
  description:string;
  client_name:string;
  area_code:string|null;
  area_name:string|null;
  products:string|null;
  ticket_id:string|null;
  status_code:string;
  status_label:string;
  created_by_name:string|null;
  created_at:string;
};

export default async function HistoryPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }){
  const sp=await searchParams;
  const get=(key:string)=>typeof sp[key]==="string" ? String(sp[key]) : "";
  const filters={
    q:get("q"),
    area:get("area"),
    status:get("status"),
    client:get("client"),
    dateFrom:get("date_from"),
    dateTo:get("date_to")
  };

  const where:string[]=[];
  const params:unknown[]=[];
  const add=(value:unknown)=>{params.push(value); return `$${params.length}`;};

  if(filters.q){
    const p=add(`%${filters.q}%`);
    where.push(`(i.title ILIKE ${p} OR i.description ILIKE ${p} OR i.ticket_id ILIKE ${p} OR c.display_name ILIKE ${p})`);
  }
  if(filters.area) where.push(`i.area_code=${add(filters.area)}`);
  if(filters.status) where.push(`i.status_code=${add(filters.status)}`);
  if(filters.client) where.push(`i.client_id=${add(filters.client)}::uuid`);
  if(filters.dateFrom) where.push(`i.created_at >= (${add(filters.dateFrom)}::date AT TIME ZONE 'America/Sao_Paulo')`);
  if(filters.dateTo) where.push(`i.created_at < ((${add(filters.dateTo)}::date + INTERVAL '1 day') AT TIME ZONE 'America/Sao_Paulo')`);

  const filterSql=where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [historyRows, summary, auditRows, clients, statuses, areas]=await Promise.all([
    query<HistoryRow>(`
      SELECT
        i.id,
        i.title,
        i.description,
        c.display_name client_name,
        i.area_code,
        a.name area_name,
        i.ticket_id,
        i.status_code,
        s.label status_label,
        creator.name created_by_name,
        i.created_at::text,
        STRING_AGG(DISTINCT p.code, ', ' ORDER BY p.code) products
      FROM incidents i
      JOIN clients c ON c.id=i.client_id
      JOIN incident_statuses s ON s.code=i.status_code
      LEFT JOIN areas a ON a.code=i.area_code
      LEFT JOIN users creator ON creator.id=i.created_by
      LEFT JOIN incident_products ip ON ip.incident_id=i.id
      LEFT JOIN products p ON p.id=ip.product_id
      ${filterSql}
      GROUP BY i.id,c.display_name,a.name,s.label,creator.name
      ORDER BY i.created_at DESC
      LIMIT 500
    `,params),
    query<{total:string;last_30_days:string;open:string;resolved:string}>(`
      SELECT
        COUNT(*)::text total,
        COUNT(*) FILTER (WHERE i.created_at >= NOW() - INTERVAL '30 days')::text last_30_days,
        COUNT(*) FILTER (WHERE s.is_closed=FALSE)::text open,
        COUNT(*) FILTER (WHERE s.is_closed=TRUE)::text resolved
      FROM incidents i
      JOIN incident_statuses s ON s.code=i.status_code
    `),
    query<{id:string;action:string;entity:string;entity_id:string|null;created_at:string;user_name:string|null}>(`
      SELECT a.id::text,a.action,a.entity,a.entity_id,a.created_at::text,u.name user_name
      FROM audit_logs a
      LEFT JOIN users u ON u.id=a.user_id
      ORDER BY a.created_at DESC
      LIMIT 100
    `),
    getClients(),
    getStatuses(),
    getAreas()
  ]);

  const rows=historyRows.rows;
  const totals=summary.rows[0] ?? {total:"0",last_30_days:"0",open:"0",resolved:"0"};

  return <>
    <div className="page-head">
      <div>
        <h1>Histórico</h1>
        <p>Memória permanente das inclusões realizadas no Diário de Bordo.</p>
      </div>
    </div>

    <div className="kpi-grid">
      <KpiCard label="Registros salvos" value={Number(totals.total)} icon={Archive}/>
      <KpiCard label="Últimos 30 dias" value={Number(totals.last_30_days)} icon={Clock3}/>
      <KpiCard label="Em aberto" value={Number(totals.open)} icon={Search}/>
      <KpiCard label="Resolvidos" value={Number(totals.resolved)} icon={CheckCircle2}/>
    </div>

    <form className="card filters" method="get">
      <div className="field filter-search">
        <label>Pesquisar</label>
        <input className="input" name="q" defaultValue={filters.q} placeholder="Título, descrição, cliente ou chamado"/>
      </div>
      <div className="field">
        <label>Área</label>
        <select className="select" name="area" defaultValue={filters.area}>
          <option value="">Todas</option>
          {areas.map(a=><option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Status</label>
        <select className="select" name="status" defaultValue={filters.status}>
          <option value="">Todos</option>
          {statuses.map(s=><option key={s.code} value={s.code}>{s.label}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Cliente</label>
        <select className="select" name="client" defaultValue={filters.client}>
          <option value="">Todos</option>
          {clients.map(c=><option key={c.id} value={c.id}>{clientOptionLabel(c.display_name,c.products)}</option>)}
        </select>
      </div>
      <div className="field">
        <label>De</label>
        <input className="input" type="date" name="date_from" defaultValue={filters.dateFrom}/>
      </div>
      <div className="field">
        <label>Até</label>
        <input className="input" type="date" name="date_to" defaultValue={filters.dateTo}/>
      </div>
      <div style={{display:"flex",alignItems:"end",gap:8}}>
        <button className="btn btn-primary" type="submit"><Search size={16}/> Filtrar</button>
        <Link className="btn btn-secondary" href="/history">Limpar</Link>
      </div>
    </form>

    <section className="card table-card" style={{marginTop:0}}>
      <div className="section-head" style={{padding:"18px 18px 0"}}>
        <div><h2>Inclusões do Diário de Bordo</h2><p>{rows.length} registro(s) encontrado(s). O histórico permanece salvo mesmo após o fechamento da ocorrência.</p></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Data/Hora</th><th>Área</th><th>Cliente</th><th>Produto</th><th>Registro</th><th>Chamado</th><th>Incluído por</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map(r=><tr key={r.id}>
              <td>{formatDateTime(r.created_at)}</td>
              <td>{r.area_code?<span className="badge" title={r.area_name||r.area_code}>{r.area_code}</span>:"—"}</td>
              <td><strong>{r.client_name}</strong></td>
              <td>{r.products||"—"}</td>
              <td style={{minWidth:260,maxWidth:420}}>
                <Link prefetch={false} href={`/incidents/${r.id}`}><strong>{r.title}</strong></Link>
                <div style={{marginTop:4,color:"var(--muted)",fontSize:12,lineHeight:1.4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:390}}>{r.description}</div>
              </td>
              <td>{r.ticket_id||"Sem chamado"}</td>
              <td>{r.created_by_name||"Sistema"}</td>
              <td><StatusBadge code={r.status_code} label={r.status_label}/></td>
            </tr>)}
          </tbody>
        </table>
      </div>
      {!rows.length&&<div className="empty"><strong>Nenhum registro encontrado.</strong>Ajuste os filtros para consultar outro período do Diário de Bordo.</div>}
    </section>

    <details className="card panel" style={{marginTop:18}}>
      <summary style={{cursor:"pointer",fontWeight:800}}>Auditoria técnica do sistema</summary>
      <p style={{margin:"8px 0 16px",color:"var(--muted)"}}>Log de ações administrativas e alterações realizadas no OSP Logbook.</p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Data/Hora</th><th>Usuário</th><th>Ação</th><th>Entidade</th><th>ID</th></tr></thead>
          <tbody>{auditRows.rows.map(r=><tr key={r.id}>
            <td>{formatDateTime(r.created_at)}</td>
            <td>{r.user_name||"Sistema"}</td>
            <td><strong>{r.action.replaceAll("_"," ")}</strong></td>
            <td>{r.entity}</td>
            <td>{r.entity_id||"—"}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </details>
  </>;
}
