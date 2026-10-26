import { CalendarDays, CheckCircle2, ClipboardCheck, Save, UserRound } from "lucide-react";
import { saveChecklistAction } from "@/app/actions";
import { CHECKLIST_ITEMS } from "@/lib/checklist";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";

function todaySaoPaulo() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

type Analyst = { id:string; name:string; username:string };
type Client = { id:string; display_name:string };
type ItemRow = { item_key:string; completed:boolean; observation:string|null; completed_at:string|null; updated_at:string };

export default async function ChecklistPage({
  searchParams,
}: {
  searchParams: Promise<Record<string,string|string[]|undefined>>;
}) {
  const user = await requireUser(["ADMIN","ANALYST"]);
  const sp = await searchParams;
  const get = (key:string) => typeof sp[key] === "string" ? String(sp[key]) : "";

  const date = get("date") || todaySaoPaulo();
  const saved = get("saved") === "1";

  const analysts: Analyst[] = user.role === "ADMIN"
    ? (await query<Analyst>(
        "SELECT id,name,username FROM users WHERE role='ANALYST' AND active=TRUE ORDER BY name"
      )).rows
    : [{ id:user.id, name:user.name, username:user.username }];

  const requestedAnalyst = get("analyst");
  const selectedAnalyst = analysts.find(a => a.id === requestedAnalyst) ?? analysts[0] ?? null;

  const clients: Client[] = selectedAnalyst
    ? (await query<Client>(`
        SELECT c.id,c.display_name
        FROM analyst_clients ac
        JOIN clients c ON c.id=ac.client_id
        WHERE ac.analyst_id=$1 AND c.active=TRUE
        ORDER BY ac.is_primary DESC,c.display_name
      `, [selectedAnalyst.id])).rows
    : [];

  const requestedClient = get("client");
  const selectedClient = clients.find(c => c.id === requestedClient) ?? clients[0] ?? null;

  let itemRows: ItemRow[] = [];
  if (selectedAnalyst && selectedClient) {
    itemRows = (await query<ItemRow>(`
      SELECT dci.item_key,dci.completed,dci.observation,dci.completed_at::text,dci.updated_at::text
      FROM daily_checklists dc
      JOIN daily_checklist_items dci ON dci.checklist_id=dc.id
      WHERE dc.checklist_date=$1::date
        AND dc.analyst_id=$2
        AND dc.client_id=$3
    `, [date, selectedAnalyst.id, selectedClient.id])).rows;
  }

  const itemMap = new Map(itemRows.map(r => [r.item_key, r]));
  const completed = CHECKLIST_ITEMS.filter(i => itemMap.get(i.key)?.completed).length;
  const total = CHECKLIST_ITEMS.length;
  const pending = total - completed;
  const progress = total ? Math.round((completed / total) * 100) : 0;

  return <>
    <div className="page-head">
      <div>
        <h1>Checklist</h1>
        <p>Rotina diária por analista e cliente, com histórico salvo por data.</p>
      </div>
    </div>

    {saved && <div className="password-success-banner">
      <CheckCircle2 size={17}/>
      <span>Checklist salvo com sucesso.</span>
    </div>}

    <form className="card checklist-filters" method="get">
      <div className="field">
        <label>Data</label>
        <input className="input" type="date" name="date" defaultValue={date}/>
      </div>

      {user.role === "ADMIN" && <div className="field">
        <label>Analista</label>
        <select className="select" name="analyst" defaultValue={selectedAnalyst?.id || ""}>
          {analysts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>}

      <div className="field">
        <label>Cliente</label>
        <select className="select" name="client" defaultValue={selectedClient?.id || ""}>
          {clients.map(c => <option key={c.id} value={c.id}>{c.display_name}</option>)}
        </select>
      </div>

      <button className="btn btn-secondary" type="submit">
        <ClipboardCheck size={16}/> Carregar checklist
      </button>
    </form>

    {!selectedAnalyst ? <section className="card empty">
      <strong>Nenhum analista disponível.</strong>
      Cadastre ou ative um analista para começar.
    </section> : !selectedClient ? <section className="card empty">
      <strong>Nenhum cliente vinculado.</strong>
      Vincule um cliente ao analista na aba Analistas para liberar o checklist.
    </section> : <>
      <div className="checklist-summary-grid">
        <div className="card checklist-summary-card">
          <div className="checklist-summary-icon"><UserRound size={18}/></div>
          <div><span>Analista</span><strong>{selectedAnalyst.name}</strong></div>
        </div>
        <div className="card checklist-summary-card">
          <div className="checklist-summary-icon"><CalendarDays size={18}/></div>
          <div><span>Data</span><strong>{date.split("-").reverse().join("/")}</strong></div>
        </div>
        <div className="card checklist-summary-card">
          <div className="checklist-summary-icon"><CheckCircle2 size={18}/></div>
          <div><span>Concluídos</span><strong>{completed} / {total}</strong></div>
        </div>
        <div className="card checklist-summary-card progress">
          <div className="checklist-progress-head"><span>Progresso</span><strong>{progress}%</strong></div>
          <div className="checklist-progress-bar"><span style={{width:`${progress}%`}}/></div>
          <small>{pending} pendente(s)</small>
        </div>
      </div>

      <form action={saveChecklistAction} className="card checklist-card">
        <input type="hidden" name="checklist_date" value={date}/>
        <input type="hidden" name="analyst_id" value={selectedAnalyst.id}/>
        <input type="hidden" name="client_id" value={selectedClient.id}/>

        <div className="checklist-card-head">
          <div>
            <span className="checklist-client-kicker">Cliente</span>
            <h2>{selectedClient.display_name}</h2>
            <p>Marque cada validação concluída e registre observações quando necessário.</p>
          </div>
          <button className="btn btn-primary" type="submit">
            <Save size={16}/> Salvar checklist
          </button>
        </div>

        <div className="table-wrap">
          <table className="checklist-table">
            <thead>
              <tr>
                <th>Concluído</th>
                <th>Ação</th>
                <th>Validação</th>
                <th>Detalhe</th>
                <th>Observação</th>
              </tr>
            </thead>
            <tbody>
              {CHECKLIST_ITEMS.map((item,index) => {
                const value = itemMap.get(item.key);
                return <tr key={item.key} className={value?.completed ? "checklist-row-done" : ""}>
                  <td>
                    <label className="checklist-toggle">
                      <input
                        type="checkbox"
                        name={`done_${item.key}`}
                        defaultChecked={Boolean(value?.completed)}
                      />
                      <span/>
                    </label>
                  </td>
                  <td>
                    <span className="checklist-index">{String(index+1).padStart(2,"0")}</span>
                    <strong>{item.action}</strong>
                  </td>
                  <td>{item.validation || "—"}</td>
                  <td>{item.detail || "—"}</td>
                  <td>
                    <input
                      className="input checklist-note"
                      name={`note_${item.key}`}
                      defaultValue={value?.observation || ""}
                      placeholder="Observação opcional"
                    />
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>

        <div className="checklist-footer">
          <span>{completed} de {total} itens concluídos</span>
          <button className="btn btn-primary" type="submit">
            <Save size={16}/> Salvar checklist
          </button>
        </div>
      </form>
    </>}
  </>;
}
