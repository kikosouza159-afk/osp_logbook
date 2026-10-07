import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Save, MessageSquarePlus } from "lucide-react";
import { addTicketResponseAction, updateIncidentAction } from "@/app/actions";
import { getAnalysts, getIncident, getPriorities, getStatuses } from "@/lib/queries";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime } from "@/lib/format";

function localInput(value:string|null){ if(!value) return ""; const d=new Date(value); const p=(n:number)=>String(n).padStart(2,"0"); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; }

export default async function IncidentDetailPage({ params }: { params: Promise<{id:string}> }) {
  const {id}=await params;
  const [data,statuses,priorities,analysts]=await Promise.all([getIncident(id),getStatuses(),getPriorities(),getAnalysts()]);
  if(!data) notFound();
  const i=data.incident;
  return <>
    <div className="page-head"><div><Link href="/incidents" style={{fontSize:13,color:"var(--blue)"}}><ArrowLeft size={14} style={{verticalAlign:"middle"}}/> Incidentes</Link><h1 style={{marginTop:8}}>{i.title}</h1><p>{i.client_name} · {i.products||"Sem produto"}</p></div><div style={{display:"flex",gap:8}}><StatusBadge code={i.priority_code}/><StatusBadge code={i.status_code} label={i.status_label}/></div></div>
    <div className="detail-grid">
      <section className="card detail-block"><h2 className="section-title" style={{marginTop:0}}>Dados do incidente</h2><form action={updateIncidentAction}><input type="hidden" name="id" value={i.id}/><div className="form-grid">
        <div className="field full"><label>Título</label><input className="input" name="title" defaultValue={i.title} required/></div>
        <div className="field full"><label>Descrição</label><textarea className="textarea" name="description" defaultValue={i.description} required/></div>
        <div className="field"><label>Prioridade</label><select className="select" name="priority" defaultValue={i.priority_code}>{priorities.map(p=><option key={p.code} value={p.code}>{p.label}</option>)}</select></div>
        <div className="field"><label>Status</label><select className="select" name="status" defaultValue={i.status_code}>{statuses.map(s=><option key={s.code} value={s.code}>{s.label}</option>)}</select></div>
        <div className="field"><label>Analista</label><select className="select" name="assigned_user_id" defaultValue={i.assigned_user_id||""}><option value="">Não atribuído</option>{analysts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
        <div className="field full"><label className="check" style={{width:"fit-content"}}><input type="checkbox" name="has_ticket" defaultChecked={i.has_ticket}/> Possui chamado aberto</label></div>
        <div className="field"><label>ID do chamado</label><input className="input" name="ticket_id" defaultValue={i.ticket_id||""}/></div>
        <div className="field"><label>Link do chamado</label><input className="input" name="ticket_url" type="url" defaultValue={i.ticket_url||""}/></div>
        <div className="field"><label>Abertura do chamado</label><input className="input" name="ticket_opened_at" type="datetime-local" defaultValue={localInput(i.ticket_opened_at)}/></div>
        <div className="field full"><label>Observações internas</label><textarea className="textarea" name="internal_notes" defaultValue={i.internal_notes||""} style={{minHeight:80}}/></div>
      </div><div style={{display:"flex",justifyContent:"flex-end",marginTop:16}}><button className="btn btn-primary"><Save size={16}/> Salvar alterações</button></div></form></section>
      <aside><section className="card detail-block"><h2 className="section-title" style={{marginTop:0}}>Resumo</h2><div className="meta-list"><div className="meta"><small>Cliente</small><strong>{i.client_name}</strong></div><div className="meta"><small>Produto</small><strong>{i.products||"—"}</strong></div><div className="meta"><small>Criado em</small><strong>{formatDateTime(i.created_at)}</strong></div><div className="meta"><small>Atualizado</small><strong>{formatDateTime(i.updated_at)}</strong></div><div className="meta"><small>Chamado</small><strong>{i.ticket_id||"—"}</strong></div><div className="meta"><small>Analista</small><strong>{i.analyst_name||"Não atribuído"}</strong></div></div>{i.ticket_url&&<a className="btn btn-secondary" style={{marginTop:14,width:"100%"}} href={i.ticket_url} target="_blank" rel="noreferrer"><ExternalLink size={16}/> Abrir chamado</a>}</section></aside>
    </div>
    <div className="grid-2">
      <section className="card panel"><div className="panel-title"><h2>Timeline</h2></div>{data.updates.length?<div className="timeline">{data.updates.map(u=><div className="timeline-item" key={u.id}><strong>{u.update_type.replaceAll("_"," ")}</strong><span>{formatDateTime(u.created_at)} · {u.user_name||"Sistema"}{u.old_value||u.new_value?` · ${u.old_value||"—"} → ${u.new_value||"—"}`:""}</span>{u.comment&&<div style={{fontSize:13,marginTop:5}}>{u.comment}</div>}</div>)}</div>:<div className="empty">Sem movimentações adicionais.</div>}</section>
      <section className="card panel"><div className="panel-title"><h2>Resposta do chamado</h2><MessageSquarePlus size={18}/></div><form action={addTicketResponseAction}><input type="hidden" name="incident_id" value={i.id}/><input type="hidden" name="ticket_id" value={i.ticket_id||""}/><div className="field"><label>Resposta recebida *</label><textarea className="textarea" name="response_text" required/></div><div className="field" style={{marginTop:10}}><label>Causa identificada</label><textarea className="textarea" name="root_cause" style={{minHeight:70}}/></div><div className="field" style={{marginTop:10}}><label>Solução informada</label><textarea className="textarea" name="solution" style={{minHeight:70}}/></div><div className="field" style={{marginTop:10}}><label>Ação necessária</label><textarea className="textarea" name="required_action" style={{minHeight:70}}/></div><div className="form-grid" style={{marginTop:10}}><div className="field"><label>Responsável pelo retorno</label><input className="input" name="responded_by"/></div><div className="field"><label>Status após retorno</label><select className="select" name="status_after" defaultValue={i.status_code}><option value="">Manter status</option>{statuses.map(s=><option key={s.code} value={s.code}>{s.label}</option>)}</select></div></div><button className="btn btn-primary" style={{marginTop:14}}>Registrar resposta</button></form></section>
    </div>
    <section className="card panel" style={{marginTop:18}}><div className="panel-title"><h2>Respostas registradas</h2><span className="badge">{data.responses.length}</span></div>{data.responses.length?<div className="timeline">{data.responses.map(r=><div className="timeline-item" key={r.id}><strong>{r.responded_by||"Retorno do chamado"} · {formatDateTime(r.response_date)}</strong><div style={{marginTop:6}}>{r.response_text}</div>{r.root_cause&&<div style={{marginTop:6,fontSize:13}}><b>Causa:</b> {r.root_cause}</div>}{r.solution&&<div style={{fontSize:13}}><b>Solução:</b> {r.solution}</div>}</div>)}</div>:<div className="empty"><strong>Nenhuma resposta ainda.</strong>Registre o retorno quando a sustentação responder.</div>}</section>
  </>;
}
