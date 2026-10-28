import Link from "next/link";
import {
  Activity, BriefcaseBusiness, Building2, CirclePause, ClipboardCheck, ClipboardPaste, Layers3, PencilLine, Plus, Save, Upload, UsersRound, X
} from "lucide-react";
import { bulkUpsertClientsAction, createClientAction, updateClientPortfolioAction } from "@/app/actions";
import { getAnalysts, getClientPortfolios, getCommercials, getProducts } from "@/lib/queries";
import { requireUser } from "@/lib/auth";
import { DeleteClientButton } from "@/components/delete-client-button";
import { ClientPortfolioStatusButton } from "@/components/client-portfolio-status-button";
import { clientPortfolioInactiveReasonLabel } from "@/lib/client-portfolio-status";
import { query } from "@/lib/db";
import { CHECKLIST_ITEMS } from "@/lib/checklist";

function analystLabel(username:string,name:string) {
  const aliases:Record<string,string> = {
    "eduarda.salvador":"Duda",
    "michele.silva":"Michele",
    "pedro.santos":"Pedro",
    "sheila.marques":"Sheila",
    "elvis.santos":"Elvis",
  };
  return aliases[username] ? `${aliases[username]} · ${name}` : name;
}

function analystShort(name:string|null) {
  if (!name) return "Não definido";
  if (name.startsWith("Eduarda ")) return "Duda";
  if (name.startsWith("Michele ")) return "Michele";
  if (name.startsWith("Pedro ")) return "Pedro";
  if (name.startsWith("Sheila ")) return "Sheila";
  if (name.startsWith("Elvis ")) return "Elvis";
  return name;
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string,string|string[]|undefined>>;
}){
  const user = await requireUser();
  const sp = await searchParams;
  const saved = sp.saved === "1";
  const bulkSaved = typeof sp.bulk_saved === "string" ? Number(sp.bulk_saved) : 0;
  const deleted = typeof sp.deleted === "string" ? sp.deleted : "";
  const updated = typeof sp.updated === "string" ? sp.updated : "";
  const statusChanged = typeof sp.status_changed === "string" ? sp.status_changed : "";
  const statusProduct = typeof sp.product === "string" ? sp.product : "";
  const statusActive = sp.active === "1";
  const editId = typeof sp.edit === "string" ? sp.edit : "";

  const [portfolios,products,commercials,analysts]=await Promise.all([
    getClientPortfolios(true),
    getProducts(),
    getCommercials(),
    getAnalysts(),
  ]);

  const activeAnalysts = analysts.filter(a=>a.active && a.role==="ANALYST");
  const editingPortfolio = user.role === "ADMIN" && editId
    ? portfolios.find(p=>p.id===editId)
    : undefined;
  const activePortfolios = portfolios.filter(p=>p.active);
  const inactivePortfolios = portfolios.filter(p=>!p.active);
  const locator = activePortfolios.filter(p=>p.product_code==="LOCATOR").length;
  const ada = activePortfolios.filter(p=>p.product_code==="ADA").length;
  const withoutCommercial = activePortfolios.filter(p=>!p.commercial_name).length;
  const checklistEligible = activePortfolios.filter(p=>p.analyst_id).length;
  const checklistCompleted = (await query<{completed:number}>(`
    SELECT COUNT(dci.id) FILTER (WHERE dci.status='CONCLUIDO')::int AS completed
    FROM client_portfolios cp
    JOIN clients c ON c.id=cp.client_id AND c.active=TRUE
    LEFT JOIN daily_checklists dc
      ON dc.client_id=cp.client_id
     AND dc.product_id=cp.product_id
     AND dc.analyst_id=cp.analyst_id
     AND dc.checklist_date=(NOW() AT TIME ZONE 'America/Sao_Paulo')::date
    LEFT JOIN daily_checklist_items dci ON dci.checklist_id=dc.id
    WHERE cp.active=TRUE
      AND cp.analyst_id IS NOT NULL
  `)).rows[0]?.completed ?? 0;
  const checklistExpected = checklistEligible * CHECKLIST_ITEMS.length;
  const checklistPct = checklistExpected ? Math.round((checklistCompleted/checklistExpected)*100) : 0;

  return <>
    <div className="page-head">
      <div>
        <h1>Clientes</h1>
        <p>Cadastre e mantenha a matriz Cliente × Acompanhamento × Produto × Comercial.</p>
      </div>
    </div>

    {saved && <div className="password-success-banner">
      <span>Cliente/carteira salvo com sucesso.</span>
    </div>}
    {bulkSaved > 0 && <div className="password-success-banner">
      <span><strong>{bulkSaved}</strong> carteira(s) processada(s) com sucesso no cadastro em massa.</span>
    </div>}
    {deleted && <div className="password-success-banner">
      <span>Cliente <strong>{deleted}</strong> excluído da operação. O histórico anterior foi preservado.</span>
    </div>}
    {updated && <div className="password-success-banner">
      <span>Cliente <strong>{updated}</strong> atualizado com sucesso.</span>
    </div>}
    {statusChanged && <div className="password-success-banner">
      <span>
        <strong>{statusChanged} · {statusProduct}</strong> foi {statusActive ? "reativado" : "desativado"}.
        {!statusActive && " A carteira saiu do cálculo do Checklist enquanto estiver inativa."}
      </span>
    </div>}

    <div className="client-kpi-grid">
      <article className="card client-kpi">
        <span className="client-kpi-icon"><Building2 size={18}/></span>
        <div><small>Carteiras</small><strong>{portfolios.length}</strong><span>cliente + produto</span></div>
      </article>
      <article className="card client-kpi">
        <span className="client-kpi-icon"><Layers3 size={18}/></span>
        <div><small>Locator</small><strong>{locator}</strong><span>carteiras ativas</span></div>
      </article>
      <article className="card client-kpi">
        <span className="client-kpi-icon"><UsersRound size={18}/></span>
        <div><small>ADA</small><strong>{ada}</strong><span>carteiras ativas</span></div>
      </article>
      <article className="card client-kpi">
        <span className="client-kpi-icon"><BriefcaseBusiness size={18}/></span>
        <div><small>Sem comercial</small><strong>{withoutCommercial}</strong><span>aguardando definição</span></div>
      </article>
    </div>

    <section className="card client-operational-status">
      <div className="client-operational-status-copy">
        <span className="client-status-eyebrow">Base operacional do Checklist</span>
        <strong>Somente carteiras ativas entram no percentual consolidado.</strong>
        <p>Ao desativar uma carteira, ela permanece na Matriz e no histórico, mas sai do denominador do Checklist até ser reativada.</p>
      </div>
      <div className="client-operational-status-metrics">
        <div className="client-status-metric active">
          <span className="client-status-icon"><Activity size={16}/></span>
          <div><small>Ativas</small><strong>{activePortfolios.length}</strong></div>
        </div>
        <div className="client-status-metric inactive">
          <span className="client-status-icon"><CirclePause size={16}/></span>
          <div><small>Inativas</small><strong>{inactivePortfolios.length}</strong></div>
        </div>
        <div className="client-status-metric checklist">
          <span className="client-status-icon"><ClipboardCheck size={16}/></span>
          <div><small>Checklist hoje</small><strong>{checklistPct}%</strong><span>{checklistEligible} carteira(s) no denominador</span></div>
        </div>
      </div>
    </section>

    <div className="client-admin-grid">
      <section id="client-editor" className={`card form-card client-single-card${editingPortfolio ? " is-editing" : ""}`}>
        <div className="panel-title">
          <div>
            <h2>{editingPortfolio ? "Editar cliente / carteira" : "Novo cliente / carteira"}</h2>
            <p>{editingPortfolio ? "Altere os dados da carteira selecionada e salve." : "Use este formulário para inclusão ou atualização pontual."}</p>
          </div>
          {editingPortfolio ? <PencilLine size={18}/> : <Plus size={18}/>}
        </div>

        <form action={editingPortfolio ? updateClientPortfolioAction : createClientAction}>
          {editingPortfolio && <input type="hidden" name="portfolio_id" value={editingPortfolio.id}/>}
          <div className="field">
            <label>Cliente *</label>
            <input
              className="input"
              name="client_name"
              placeholder="Ex.: NovaQuest"
              defaultValue={editingPortfolio?.client_name || ""}
              required
            />
          </div>

          <div className="form-grid client-form-grid">
            <div className="field">
              <label>Acompanhamento *</label>
              <select className="select" name="analyst_name" defaultValue={editingPortfolio?.analyst_name || ""} required>
                <option value="">Selecione</option>
                {activeAnalysts.map(a=><option key={a.id} value={a.name}>
                  {analystLabel(a.username,a.name)}
                </option>)}
              </select>
            </div>

            <div className="field">
              <label>Produto *</label>
              <select className="select" name="product" defaultValue={editingPortfolio?.product_code || ""} required>
                <option value="">Selecione</option>
                {products.map(p=><option key={p.id} value={p.code}>{p.name}</option>)}
              </select>
            </div>
          </div>

          <div className="field" style={{marginTop:12}}>
            <label>Comercial</label>
            <select className="select" name="commercial" defaultValue={editingPortfolio?.commercial_name || ""}>
              <option value="">Não definido</option>
              {commercials.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>

          <div className="client-editor-actions">
            <button className="btn btn-primary" type="submit">
              {editingPortfolio ? <><Save size={16}/> Salvar alterações</> : <><Plus size={16}/> Salvar cliente</>}
            </button>
            {editingPortfolio && <Link className="btn btn-secondary" href="/clients">
              <X size={16}/> Cancelar
            </Link>}
          </div>
        </form>
      </section>

      <section className="card form-card client-bulk-card">
        <div className="panel-title">
          <div>
            <h2>Cadastro em massa</h2>
            <p>Copie as colunas do Excel e cole diretamente abaixo.</p>
          </div>
          <ClipboardPaste size={18}/>
        </div>

        <div className="client-template">
          <div className="client-template-head">
            <strong>Modelo aceito</strong>
            <span>Excel, TAB, ponto e vírgula ou |</span>
          </div>
          <code>Cliente&nbsp;&nbsp;&nbsp; Acompanhamento&nbsp;&nbsp;&nbsp; Produto&nbsp;&nbsp;&nbsp; Comercial</code>
          <code>NovaQuest&nbsp;&nbsp;&nbsp; Duda&nbsp;&nbsp;&nbsp; Locator&nbsp;&nbsp;&nbsp; Amanda</code>
          <code>PagBank&nbsp;&nbsp;&nbsp; Elvis&nbsp;&nbsp;&nbsp; ADA&nbsp;&nbsp;&nbsp;</code>
        </div>

        <form action={bulkUpsertClientsAction}>
          <div className="field">
            <label>Colar lista *</label>
            <textarea
              className="textarea client-bulk-textarea"
              name="bulk_clients"
              placeholder={"Cliente\tAcompanhamento\tProduto\tComercial\nNovaQuest\tDuda\tLocator\t\nPagBank\tElvis\tADA\t"}
              required
            />
          </div>
          <div className="client-bulk-note">
            O importador valida todas as linhas antes de concluir. Se encontrar um analista, produto ou comercial inválido, nenhuma linha é gravada.
          </div>
          <button className="btn btn-primary" style={{marginTop:14}}>
            <Upload size={16}/> Importar lista
          </button>
        </form>
      </section>
    </div>

    <section className="card table-card client-matrix-card">
      <div className="panel client-matrix-head">
        <div className="panel-title">
          <div>
            <h2>Matriz de clientes</h2>
            <p>Uma linha por combinação de cliente e produto, incluindo carteiras ativas e inativas.</p>
          </div>
          <div className="client-matrix-counts">
            <span className="badge RESOLVIDO">{activePortfolios.length} ativa(s)</span>
            <span className="badge client-status-inactive">{inactivePortfolios.length} inativa(s)</span>
          </div>
        </div>
      </div>

      <div className="table-wrap">
        <table className="client-matrix-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Acompanhamento</th>
              <th>Produto</th>
              <th>Comercial</th>
              <th>Status</th>
              <th>Motivo / Paralisação</th>
              {user.role === "ADMIN" && <th>Ações</th>}
            </tr>
          </thead>
          <tbody>
            {portfolios.map(p=><tr key={p.id}>
              <td><strong>{p.client_name}</strong></td>
              <td>{analystShort(p.analyst_name)}</td>
              <td><span className={`badge client-product ${p.product_code.toLowerCase()}`}>{p.product_name}</span></td>
              <td>{p.commercial_name || <span className="client-empty-value">Não definido</span>}</td>
              <td>{p.active
                ? <span className="badge RESOLVIDO">Ativo</span>
                : <span className="badge client-status-inactive">Inativo</span>}
              </td>
              <td>
                {p.active
                  ? <span className="client-empty-value">Em operação</span>
                  : <div className="client-inactive-reason">
                      <strong>{clientPortfolioInactiveReasonLabel(p.inactive_reason_code) || "Motivo não informado"}</strong>
                      {p.deactivated_at && <small>
                        {new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date(p.deactivated_at))}
                        {p.deactivated_by_name ? ` · ${p.deactivated_by_name}` : ""}
                      </small>}
                    </div>}
              </td>
              {user.role === "ADMIN" && <td className="client-actions-cell">
                <div className="client-row-actions">
                  <Link
                    className="btn client-edit-btn"
                    href={`/clients?edit=${encodeURIComponent(p.id)}#client-editor`}
                    title={`Editar ${p.client_name}`}
                  >
                    <PencilLine size={14}/>
                    Editar
                  </Link>
                  <ClientPortfolioStatusButton
                    portfolioId={p.id}
                    clientName={p.client_name}
                    productCode={p.product_code}
                    active={p.active}
                  />
                  <DeleteClientButton clientId={p.client_id} clientName={p.client_name}/>
                </div>
              </td>}
            </tr>)}
          </tbody>
        </table>
      </div>

      {!portfolios.length && <div className="empty">
        <Building2 size={28}/>
        <strong>Nenhuma carteira cadastrada</strong>
        Use o cadastro individual ou cole uma lista do Excel.
      </div>}
    </section>
  </>;
}
