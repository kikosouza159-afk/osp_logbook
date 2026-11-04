import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { createIncidentAction } from "@/app/actions";
import { IncidentClassificationSelector } from "@/components/incident-classification-selector";
import { getAnalysts, getAreas, getClientPortfolios, getPriorities, getProblemTypes, getStatuses } from "@/lib/queries";

export default async function NewIncidentPage() {
  const [portfolios,priorities,statuses,analysts,areas,problemTypes]=await Promise.all([
    getClientPortfolios(),getPriorities(),getStatuses(),getAnalysts(),getAreas(),getProblemTypes()
  ]);

  return <>
    <div className="page-head">
      <div>
        <h1>Novo registro</h1>
        <p>Classifique o incidente por área e tipo de problema para acelerar análise, filtros e acompanhamento.</p>
      </div>
      <Link className="btn btn-secondary" href="/incidents"><ArrowLeft size={16}/> Voltar</Link>
    </div>

    <form action={createIncidentAction} className="card form-card">
      <div className="form-grid">
        <div className="field">
          <label>Cliente / Produto *</label>
          <select className="select" name="portfolio_id" required>
            <option value="">Selecione</option>
            {portfolios.map(portfolio=>
              <option value={portfolio.id} key={portfolio.id}>
                {portfolio.client_name} · {portfolio.product_code}{portfolio.analyst_name ? ` • Principal: ${portfolio.analyst_name}` : ""}
              </option>
            )}
          </select>
        </div>

        <div className="field">
          <label>Analista responsável</label>
          <select className="select" name="assigned_user_id">
            <option value="">Não atribuído</option>
            {analysts.filter(a=>a.active).map(a=><option value={a.id} key={a.id}>{a.name}</option>)}
          </select>
        </div>

        <div className="field full">
          <IncidentClassificationSelector areas={areas} problemTypes={problemTypes}/>
        </div>

        <div className="field full">
          <label>Título do incidente *</label>
          <input className="input" name="title" required placeholder="Ex.: Falha na consulta de débito"/>
        </div>

        <div className="field full">
          <label>Descrição do problema *</label>
          <textarea className="textarea" name="description" required placeholder="Descreva o comportamento observado, impacto e contexto..."/>
        </div>

        <div className="field full incident-free-field">
          <label>Campo livre / Observações complementares</label>
          <textarea
            className="textarea"
            name="internal_notes"
            placeholder="Use este espaço livre para contexto adicional, evidências, comportamento observado, ações já realizadas ou qualquer informação complementar..."
            style={{minHeight:96}}
          />
          <small>Opcional · conteúdo livre, sem classificação obrigatória.</small>
        </div>

        <div className="field">
          <label>Prioridade *</label>
          <select className="select" name="priority" defaultValue="MEDIA">
            {priorities.map(p=><option value={p.code} key={p.code}>{p.label}</option>)}
          </select>
        </div>

        <div className="field">
          <label>Status *</label>
          <select className="select" name="status" defaultValue="NOVO">
            {statuses.map(s=><option value={s.code} key={s.code}>{s.label}</option>)}
          </select>
        </div>

        <div className="field full">
          <label className="check" style={{width:"fit-content"}}>
            <input type="checkbox" name="has_ticket"/> Houve abertura de chamado?
          </label>
        </div>

        <div className="field">
          <label>ID do chamado</label>
          <input className="input" name="ticket_id" placeholder="INC00012345"/>
        </div>

        <div className="field">
          <label>Link do chamado</label>
          <input className="input" name="ticket_url" type="url" placeholder="https://..."/>
        </div>

        <div className="field">
          <label>Data/hora da abertura</label>
          <input className="input" name="ticket_opened_at" type="datetime-local"/>
        </div>
      </div>

      <div style={{display:"flex",justifyContent:"flex-end",marginTop:20}}>
        <button className="btn btn-primary" type="submit"><Save size={17}/> Salvar registro</button>
      </div>
    </form>
  </>;
}
