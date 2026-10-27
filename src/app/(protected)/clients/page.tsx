import { Building2, CheckCircle2, Download, FileUp, Plus, UsersRound } from "lucide-react";
import { bulkUpsertClientsAction, createClientAction } from "@/app/actions";
import { getAnalysts, getClientPortfolioRows, getCommercialContacts, getProducts } from "@/lib/queries";

function analystShortName(name:string) {
  if (name.toLowerCase().startsWith("eduarda ")) return "Duda";
  return name.split(" ")[0] || name;
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams:Promise<Record<string,string|string[]|undefined>>;
}){
  const sp=await searchParams;
  const saved=sp.saved==="1";
  const bulk=sp.bulk==="1";
  const rows=typeof sp.rows==="string" ? Number(sp.rows) : 0;
  const created=typeof sp.created==="string" ? Number(sp.created) : 0;

  const [portfolio,products,allUsers,commercials]=await Promise.all([
    getClientPortfolioRows(),
    getProducts(),
    getAnalysts(),
    getCommercialContacts(),
  ]);
  const analysts=allUsers.filter(user=>user.role==="ANALYST" && user.active);

  return <>
    <div className="page-head">
      <div>
        <h1>Clientes</h1>
        <p>Cadastre e atualize a carteira por Cliente, Acompanhamento, Produto e Comercial.</p>
      </div>
      <a className="btn btn-secondary" href="/modelos/modelo-clientes.csv" download>
        <Download size={16}/> Baixar modelo CSV
      </a>
    </div>

    {saved && <div className="password-success-banner">
      <CheckCircle2 size={17}/><span>Cliente / produto atualizado com sucesso.</span>
    </div>}
    {bulk && <div className="password-success-banner">
      <CheckCircle2 size={17}/>
      <span><strong>{rows}</strong> linha(s) processada(s). {created} novo(s) cliente(s) criado(s); os demais foram atualizados.</span>
    </div>}

    <section className="card client-bulk-card">
      <div className="client-bulk-head">
        <div>
          <span className="client-bulk-kicker">Cadastro em massa</span>
          <h2>Atualizar carteira pelo Excel</h2>
          <p>Cole as linhas diretamente do Excel. O cabeçalho pode ser mantido.</p>
        </div>
        <span className="badge"><FileUp size={13}/> até 300 linhas por carga</span>
      </div>

      <div className="client-bulk-layout">
        <form action={bulkUpsertClientsAction} className="client-bulk-form">
          <div className="field">
            <label>Cliente | Acompanhamento | Produto | Comercial</label>
            <textarea
              className="textarea client-bulk-textarea"
              name="bulk_rows"
              required
              placeholder={"Cliente\tAcompanhamento\tProduto\tComercial\nNovaQuest\tDuda\tLocator\t\nPagBank\tElvis\tAda\tAmanda"}
            />
          </div>
          <div className="client-bulk-actions">
            <span>Também aceita separador por ponto e vírgula (;) ou barra vertical (|).</span>
            <button className="btn btn-primary" type="submit"><FileUp size={16}/> Processar cadastro em massa</button>
          </div>
        </form>

        <aside className="client-model-card">
          <div className="client-model-title">
            <UsersRound size={18}/>
            <div><strong>Modelo esperado</strong><span>Comercial é opcional</span></div>
          </div>
          <div className="table-wrap client-model-table">
            <table>
              <thead><tr><th>Cliente</th><th>Acompanhamento</th><th>Produto</th><th>Comercial</th></tr></thead>
              <tbody>
                <tr><td>NovaQuest</td><td>Duda</td><td>Locator</td><td>—</td></tr>
                <tr><td>PagBank</td><td>Elvis</td><td>Ada</td><td>Amanda</td></tr>
              </tbody>
            </table>
          </div>
          <div className="client-commercial-list">
            <small>Comerciais disponíveis</small>
            <div>{commercials.map(item=><span className="badge" key={item.id}>{item.name}</span>)}</div>
          </div>
        </aside>
      </div>
    </section>

    <div className="grid-2 client-entry-grid">
      <section className="card form-card">
        <h2 className="section-title" style={{marginTop:0}}>Cadastrar / atualizar individualmente</h2>
        <form action={createClientAction}>
          <div className="field">
            <label>Cliente *</label>
            <input className="input" name="client_name" placeholder="Ex.: NovaQuest" required/>
          </div>

          <div className="field" style={{marginTop:12}}>
            <label>Acompanhamento *</label>
            <select className="select" name="analyst" required defaultValue="">
              <option value="" disabled>Selecione o analista</option>
              {analysts.map(a=><option key={a.id} value={analystShortName(a.name)}>
                {analystShortName(a.name)} · {a.name}
              </option>)}
            </select>
          </div>

          <div className="field" style={{marginTop:12}}>
            <label>Produto *</label>
            <select className="select" name="product" required defaultValue="">
              <option value="" disabled>Selecione o produto</option>
              {products.map(p=><option key={p.id} value={p.code}>{p.name}</option>)}
            </select>
          </div>

          <div className="field" style={{marginTop:12}}>
            <label>Comercial</label>
            <select className="select" name="commercial" defaultValue="">
              <option value="">Não definido</option>
              {commercials.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>

          <button className="btn btn-primary" style={{marginTop:18}} type="submit">
            <Plus size={16}/> Salvar cliente
          </button>
        </form>
      </section>

      <section className="card panel client-portfolio-summary">
        <div className="panel-title">
          <div><h2>Resumo da carteira</h2><p>Visão por combinação Cliente × Produto.</p></div>
          <span className="badge">{portfolio.length} vínculo(s)</span>
        </div>
        <div className="client-summary-grid">
          <div><small>Clientes</small><strong>{new Set(portfolio.map(row=>row.client_id)).size}</strong></div>
          <div><small>Locator</small><strong>{portfolio.filter(row=>row.product_code==="LOCATOR").length}</strong></div>
          <div><small>ADA</small><strong>{portfolio.filter(row=>row.product_code==="ADA").length}</strong></div>
          <div><small>Comercial definido</small><strong>{portfolio.filter(row=>row.commercial_name).length}</strong></div>
        </div>
      </section>
    </div>

    <section className="card table-card client-portfolio-table">
      <div className="panel client-portfolio-table-head">
        <div className="panel-title">
          <div>
            <h2>Carteira cadastrada</h2>
            <p>Lista operacional no mesmo formato do modelo de carga.</p>
          </div>
          <span className="badge">{portfolio.length} linha(s)</span>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Acompanhamento</th>
              <th>Produto</th>
              <th>Comercial</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {portfolio.map((row,index)=><tr key={`${row.client_id}-${row.product_code}-${index}`}>
              <td><strong>{row.client_name}</strong></td>
              <td>{row.analyst_name ? analystShortName(row.analyst_name) : <span className="client-missing">Não definido</span>}</td>
              <td><span className="badge">{row.product_name}</span></td>
              <td>{row.commercial_name || <span className="client-missing">Não definido</span>}</td>
              <td>{row.active ? <span className="badge RESOLVIDO">Ativo</span> : <span className="badge">Inativo</span>}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
      {!portfolio.length && <div className="empty">
        <Building2 size={28}/>
        <strong>Nenhuma carteira cadastrada</strong>
        Cadastre individualmente ou use o cadastro em massa.
      </div>}
    </section>
  </>;
}
