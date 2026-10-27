import { Crown, KeyRound, Link2, PencilLine, ShieldCheck, UserPlus, UsersRound } from "lucide-react";
import { adminUpdateUserPasswordAction, adminUpdateUserProfileAction, assignAnalystClientAction, createAnalystAction, uploadAnalystPhotoAction } from "@/app/actions";
import { getAnalysts, getClients } from "@/lib/queries";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { AnalystPhotoUploader } from "@/components/analyst-photo-uploader";

function initials(name:string) {
  return name.split(" ").filter(Boolean).slice(0,2).map(p=>p[0]?.toUpperCase()).join("");
}

export default async function AnalystsPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }){
  await requireUser(["ADMIN"]);
  const sp = await searchParams;
  const passwordUpdated = typeof sp.password_updated === "string" ? sp.password_updated : "";
  const userUpdated = typeof sp.user_updated === "string" ? sp.user_updated : "";
  const initialPassword = process.env.ANALYST_INITIAL_PASSWORD || "Não configurada";

  const [analysts,clients,links]=await Promise.all([
    getAnalysts(),
    getClients(),
    query<{analyst_name:string;client_name:string;is_primary:boolean}>(
      `SELECT u.name analyst_name,c.display_name client_name,ac.is_primary
       FROM analyst_clients ac
       JOIN users u ON u.id=ac.analyst_id
       JOIN clients c ON c.id=ac.client_id
       WHERE c.active=TRUE
       ORDER BY u.name,c.display_name`
    )
  ]);

  return <>
    <div className="page-head">
      <div>
        <h1>Analistas</h1>
        <p>Gerencie usuários operacionais, fotos de perfil e a carteira de clientes.</p>
      </div>
    </div>

    {passwordUpdated && <div className="password-success-banner"><ShieldCheck size={17}/><span>Senha de <strong>@{passwordUpdated}</strong> atualizada com sucesso.</span></div>}
    {userUpdated && <div className="password-success-banner"><ShieldCheck size={17}/><span>Dados de <strong>@{userUpdated}</strong> atualizados com sucesso.</span></div>}

    <section className="analyst-team-section">
      <div className="panel-title analyst-team-title">
        <div>
          <h2>Equipe cadastrada</h2>
          <p>Todos os usuários operacionais aparecem aqui, mesmo sem cliente associado.</p>
        </div>
        <span className="badge"><UsersRound size={13}/> {analysts.length} usuários</span>
      </div>

      <div className="analyst-grid">
        {analysts.map(a=>{
          const photoVersion = a.photo_updated_at ? encodeURIComponent(a.photo_updated_at) : "0";
          return <article className="card analyst-card" key={a.id}>
            <div className="analyst-card-top">
              <div className="analyst-avatar">
                {a.has_photo
                  ? <img src={`/api/users/${a.id}/photo?v=${photoVersion}`} alt={`Foto de ${a.name}`}/>
                  : <span>{initials(a.name)}</span>}
              </div>

              <div className="analyst-role">
                {a.role==="ADMIN"
                  ? <span className="badge analyst-admin"><Crown size={12}/> Administrador</span>
                  : a.role==="VIEWER"
                    ? <span className="badge analyst-viewer">Visualizador</span>
                    : <span className="badge">Analista</span>}
                <span className={`analyst-status ${a.active ? "active" : "inactive"}`}>
                  {a.active ? "Ativo" : "Inativo"}
                </span>
                {a.role==="ANALYST" && a.must_change_password && <span className="badge first-access-pending">1º acesso pendente</span>}
              </div>
            </div>

            <div className="analyst-info">
              <h3>{a.name}</h3>
              <p>{a.position || "Analista"}</p>
              <div className="analyst-contact">
                <span>{a.email || "Sem e-mail"}</span>
                <span>@{a.username}</span>
              </div>
            </div>

            <div className="analyst-stats">
              <div><strong>{a.client_count}</strong><span>Clientes</span></div>
              <div><strong>{a.primary_count}</strong><span>Principal</span></div>
            </div>

            <AnalystPhotoUploader
              analystId={a.id}
              analystName={a.name}
              hasPhoto={a.has_photo}
              action={uploadAnalystPhotoAction}
            />

            <details className="analyst-edit-panel">
              <summary><PencilLine size={15}/> Editar usuário</summary>
              <form action={adminUpdateUserProfileAction} className="analyst-edit-form">
                <input type="hidden" name="user_id" value={a.id}/>
                <div className="analyst-edit-grid">
                  <div className="field">
                    <label>Nome</label>
                    <input className="input" name="name" defaultValue={a.name} minLength={2} required/>
                  </div>
                  <div className="field">
                    <label>Cargo</label>
                    <input className="input" name="position" defaultValue={a.position || ""} placeholder="Cargo / função"/>
                  </div>
                  <div className="field">
                    <label>E-mail</label>
                    <input className="input" type="email" name="email" defaultValue={a.email || ""} required/>
                  </div>
                  <div className="field">
                    <label>Login</label>
                    <input className="input" name="username" defaultValue={a.username} minLength={3} required/>
                  </div>
                  <div className="field">
                    <label>Perfil de acesso</label>
                    <select className="select" name="role" defaultValue={a.role}>
                      <option value="ADMIN">Administrador</option>
                      <option value="ANALYST">Analista</option>
                      <option value="VIEWER">Visualizador</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Status</label>
                    <select className="select" name="active" defaultValue={a.active ? "true" : "false"}>
                      <option value="true">Ativo</option>
                      <option value="false">Inativo</option>
                    </select>
                  </div>
                </div>
                <div className="analyst-edit-note">
                  Alterações de perfil e status entram em vigor no próximo acesso/recarregamento do usuário.
                </div>
                <button className="btn btn-primary analyst-edit-button" type="submit">
                  <ShieldCheck size={15}/> Salvar alterações
                </button>
              </form>
            </details>

            <details className="analyst-password-panel">
              <summary><KeyRound size={15}/> Gerenciar senha</summary>
              <form action={adminUpdateUserPasswordAction} className="analyst-password-form">
                <input type="hidden" name="user_id" value={a.id}/>
                <div className="field">
                  <label>Nova senha</label>
                  <input
                    className="input"
                    type="password"
                    name="new_password"
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="Mínimo 8 caracteres"
                    required
                  />
                </div>
                <div className="field">
                  <label>Confirmar nova senha</label>
                  <input
                    className="input"
                    type="password"
                    name="confirm_password"
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="Repita a nova senha"
                    required
                  />
                </div>
                {a.role==="ANALYST" && <label className="check analyst-force-change">
                  <input type="checkbox" name="force_change"/>
                  Solicitar troca no próximo login
                </label>}
                <button className="btn btn-secondary analyst-password-button" type="submit">
                  <ShieldCheck size={15}/> Atualizar senha
                </button>
              </form>
            </details>
          </article>;
        })}
      </div>
    </section>

    <div className="grid-2">
      <section className="card form-card">
        <h2 className="section-title" style={{marginTop:0}}>Cadastrar analista</h2>
        <form action={createAnalystAction}>
          <div className="form-grid">
            <div className="field"><label>Nome</label><input className="input" name="name" required/></div>
            <div className="field"><label>Cargo</label><input className="input" name="position" placeholder="Analista"/></div>
            <div className="field"><label>E-mail</label><input className="input" name="email" type="email" required/></div>
            <div className="field"><label>Login</label><input className="input" name="username" required/></div>
            <div className="field full">
              <label>Senha inicial padrão</label>
              <div className="default-password-box">
                <div><strong>Senha padrão</strong><code>{initialPassword}</code></div>
                <span>Troca obrigatória no primeiro acesso.</span>
              </div>
            </div>
          </div>
          <button className="btn btn-primary" style={{marginTop:18}}><UserPlus size={16}/> Criar analista</button>
        </form>
      </section>

      <section className="card form-card">
        <h2 className="section-title" style={{marginTop:0}}>Associar analista ao cliente</h2>
        <form action={assignAnalystClientAction}>
          <div className="field">
            <label>Analista</label>
            <select className="select" name="analyst_id" required>
              <option value="">Selecione</option>
              {analysts.filter(a=>a.active && a.role!=="VIEWER").map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="field" style={{marginTop:12}}>
            <label>Cliente</label>
            <select className="select" name="client_id" required>
              <option value="">Selecione</option>
              {clients.filter(c=>c.active).map(c=><option key={c.id} value={c.id}>{c.display_name}</option>)}
            </select>
          </div>
          <label className="check" style={{width:"fit-content",marginTop:12}}>
            <input type="checkbox" name="is_primary"/> Analista principal do cliente
          </label>
          <button className="btn btn-primary" style={{marginTop:18}}><Link2 size={16}/> Associar</button>
        </form>
      </section>
    </div>

    <section className="card table-card">
      <div className="panel" style={{paddingBottom:8}}>
        <div className="panel-title">
          <div>
            <h2>Associações com clientes</h2>
            <p style={{margin:"4px 0 0",fontSize:12,color:"#7A7F8D"}}>Esta tabela mostra somente vínculos de carteira. Os analistas cadastrados ficam nos cards acima.</p>
          </div>
          <span className="badge">{links.rows.length} vínculos</span>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Analista</th><th>Cliente</th><th>Principal</th></tr></thead>
          <tbody>
            {links.rows.map((l,idx)=><tr key={`${l.analyst_name}-${l.client_name}-${idx}`}>
              <td><strong>{l.analyst_name}</strong></td>
              <td>{l.client_name}</td>
              <td>{l.is_primary?<span className="badge RESOLVIDO">Sim</span>:"Não"}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
      {!links.rows.length&&<div className="empty"><strong>Sem associações</strong>Os analistas já aparecem acima. Vincule clientes quando desejar.</div>}
    </section>
  </>;
}
