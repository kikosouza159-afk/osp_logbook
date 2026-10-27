import {
  BriefcaseBusiness, Building2, ClipboardPaste, Layers3, Plus, Upload, UsersRound
} from "lucide-react";
import { bulkUpsertClientsAction, createClientAction } from "@/app/actions";
import { getAnalysts, getClientPortfolios, getCommercials, getProducts } from "@/lib/queries";
import { requireUser } from "@/lib/auth";
import { DeleteClientButton } from "@/components/delete-client-button";

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

  const [portfolios,products,commercials,analysts]=await Promise.all([
    getClientPortfolios(),
    getProducts(),
    getCommercials(),
    getAnalysts(),
  ]);

  const activeAnalysts = analysts.filter(a=>a.active && a.role==="ANALYST");
  const locator = portfolios.filter(p=>p.product_code==="LOCATOR" && p.active).length;
  const ada = portfolios.filter(p=>p.product_code==="ADA" && p.active).length;
  const withoutCommercial = portfolios.filter(p=>p.active && !p.commercial_name).length;

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

    <div className="client-admin-grid">
      <section className="card form-card client-single-card">
        <div className="panel-title">
          <div>
            <h2>Novo cliente / carteira</h2>
            <p>Use este formulário para inclusão ou atualização pontual.</p>
          </div>
          <Plus size={18}/>
        </div>

        <form action={createClientAction}>
          <div className="field">
            <label>Cliente *</label>
            <input className="input" name="client_name" placeholder="Ex.: NovaQuest" required/>
          </div>

          <div className="form-grid client-form-grid">
            <div className="field">
              <label>Acompanhamento *</label>
              <select className="select" name="analyst_name" required>
                <option value="">Selecione</option>
                {activeAnalysts.map(a=><option key={a.id} value={a.name}>
                  {analystLabel(a.username,a.name)}
                </option>)}
              </select>
            </div>

            <div className="field">
              <label>Produto *</label>
              <select className="select" name="product" required>
                <option value="">Selecione</option>
                {products.map(p=><option key={p.id} value={p.code}>{p.name}</option>)}
              </select>
            </div>
          </div>

          <div className="field" style={{marginTop:12}}>
            <label>Comercial</label>
            <select className="select" name="commercial">
              <option value="">Não definido</option>
              {commercials.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>

          <button className="btn btn-primary" style={{marginTop:18}}>
            <Plus size={16}/> Salvar cliente
          </button>
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
            <p>Uma linha por combinação de cliente e produto.</p>
          </div>
          <span className="badge">{portfolios.length} carteira(s)</span>
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
              {user.role === "ADMIN" && <th>Ações</th>}
            </tr>
          </thead>
          <tbody>
            {portfolios.map(p=><tr key={p.id}>
              <td><strong>{p.client_name}</strong></td>
              <td>{analystShort(p.analyst_name)}</td>
              <td><span className={`badge client-product ${p.product_code.toLowerCase()}`}>{p.product_name}</span></td>
              <td>{p.commercial_name || <span className="client-empty-value">Não definido</span>}</td>
              <td>{p.active ? <span className="badge RESOLVIDO">Ativo</span> : <span className="badge">Inativo</span>}</td>
              {user.role === "ADMIN" && <td className="client-actions-cell">
                <DeleteClientButton clientId={p.client_id} clientName={p.client_name}/>
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
