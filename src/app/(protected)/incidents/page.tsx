import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { getAnalysts, getClients, getIncidents, getProducts, getStatuses } from "@/lib/queries";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime } from "@/lib/format";

export default async function IncidentsPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const sp = await searchParams;
  const get = (k:string) => typeof sp[k] === "string" ? String(sp[k]) : "";
  const filters = { q:get("q"), status:get("status"), client:get("client"), analyst:get("analyst"), product:get("product") };
  const [incidents, clients, analysts, products, statuses] = await Promise.all([getIncidents(filters,100),getClients(),getAnalysts(),getProducts(),getStatuses()]);
  return <>
    <div className="page-head"><div><h1>Incidentes</h1><p>Pesquisa, filtros e acompanhamento das ocorrências registradas.</p></div><Link className="btn btn-primary" href="/incidents/new"><Plus size={17}/> Novo incidente</Link></div>
    <form className="card filters" method="get">
      <div className="field filter-search"><label>Pesquisar</label><input className="input" name="q" defaultValue={filters.q} placeholder="Cliente, chamado, título ou descrição"/></div>
      <div className="field"><label>Status</label><select className="select" name="status" defaultValue={filters.status}><option value="">Todos</option>{statuses.map(s=><option key={s.code} value={s.code}>{s.label}</option>)}</select></div>
      <div className="field"><label>Cliente</label><select className="select" name="client" defaultValue={filters.client}><option value="">Todos</option>{clients.map(c=><option key={c.id} value={c.id}>{c.display_name}</option>)}</select></div>
      <div className="field"><label>Produto</label><select className="select" name="product" defaultValue={filters.product}><option value="">Todos</option>{products.map(p=><option key={p.id} value={p.code}>{p.name}</option>)}</select></div>
      <div className="field"><label>Analista</label><select className="select" name="analyst" defaultValue={filters.analyst}><option value="">Todos</option>{analysts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
      <div style={{display:"flex",alignItems:"end",gap:8}}><button className="btn btn-primary" type="submit"><Search size={16}/> Filtrar</button><Link className="btn btn-secondary" href="/incidents">Limpar</Link></div>
    </form>
    <section className="card table-card" style={{marginTop:0}}><div className="table-wrap"><table><thead><tr><th>Data/Hora</th><th>Cliente</th><th>Produto</th><th>Título</th><th>Chamado</th><th>Analista</th><th>Prioridade</th><th>Status</th></tr></thead><tbody>{incidents.map(i=><tr key={i.id}><td>{formatDateTime(i.created_at)}</td><td><strong>{i.client_name}</strong></td><td>{i.products||"—"}</td><td><Link href={`/incidents/${i.id}`}>{i.title}</Link></td><td>{i.ticket_id||"—"}</td><td>{i.analyst_name||"Não atribuído"}</td><td><StatusBadge code={i.priority_code}/></td><td><StatusBadge code={i.status_code} label={i.status_label}/></td></tr>)}</tbody></table></div>{!incidents.length&&<div className="empty"><strong>Tudo tranquilo por aqui.</strong>Nenhuma ocorrência encontrada para os filtros selecionados.</div>}</section>
  </>;
}
