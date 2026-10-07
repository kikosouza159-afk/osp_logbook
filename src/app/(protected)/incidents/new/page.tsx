import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { createIncidentAction } from "@/app/actions";
import { getAnalysts, getClients, getPriorities, getProducts, getStatuses } from "@/lib/queries";

export default async function NewIncidentPage() {
  const [clients,products,priorities,statuses,analysts]=await Promise.all([getClients(),getProducts(),getPriorities(),getStatuses(),getAnalysts()]);
  return <>
    <div className="page-head"><div><h1>Novo registro</h1><p>Inclua um novo ponto no diário de bordo operacional.</p></div><Link className="btn btn-secondary" href="/incidents"><ArrowLeft size={16}/> Voltar</Link></div>
    <form action={createIncidentAction} className="card form-card"><div className="form-grid">
      <div className="field"><label>Cliente *</label><select className="select" name="client_id" required><option value="">Selecione</option>{clients.filter(c=>c.active).map(c=><option value={c.id} key={c.id}>{c.display_name}</option>)}</select></div>
      <div className="field"><label>Analista responsável</label><select className="select" name="assigned_user_id"><option value="">Não atribuído</option>{analysts.filter(a=>a.active).map(a=><option value={a.id} key={a.id}>{a.name}</option>)}</select></div>
      <div className="field full"><label>Produto *</label><div className="checks">{products.map(p=><label className="check" key={p.id}><input type="checkbox" name="products" value={p.code}/>{p.name}</label>)}</div></div>
      <div className="field full"><label>Título do incidente *</label><input className="input" name="title" required placeholder="Ex.: Falha na consulta de débito"/></div>
      <div className="field full"><label>Descrição do problema *</label><textarea className="textarea" name="description" required placeholder="Descreva o comportamento observado, impacto e contexto..."/></div>
      <div className="field"><label>Prioridade *</label><select className="select" name="priority" defaultValue="MEDIA">{priorities.map(p=><option value={p.code} key={p.code}>{p.label}</option>)}</select></div>
      <div className="field"><label>Status *</label><select className="select" name="status" defaultValue="NOVO">{statuses.map(s=><option value={s.code} key={s.code}>{s.label}</option>)}</select></div>
      <div className="field full"><label className="check" style={{width:"fit-content"}}><input type="checkbox" name="has_ticket"/> Houve abertura de chamado?</label></div>
      <div className="field"><label>ID do chamado</label><input className="input" name="ticket_id" placeholder="INC00012345"/></div>
      <div className="field"><label>Link do chamado</label><input className="input" name="ticket_url" type="url" placeholder="https://..."/></div>
      <div className="field"><label>Data/hora da abertura</label><input className="input" name="ticket_opened_at" type="datetime-local"/></div>
      <div className="field full"><label>Observações internas</label><textarea className="textarea" name="internal_notes" style={{minHeight:80}}/></div>
    </div><div style={{display:"flex",justifyContent:"flex-end",marginTop:20}}><button className="btn btn-primary" type="submit"><Save size={17}/> Salvar registro</button></div></form>
  </>;
}
