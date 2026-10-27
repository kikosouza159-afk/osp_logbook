import Link from "next/link";
import {
  AlertTriangle, CalendarDays, CheckCircle2, ClipboardCheck, Clock3, Save, UserRound
} from "lucide-react";
import { saveChecklistAction } from "@/app/actions";
import { CHECKLIST_ACTIONS, CHECKLIST_ITEMS } from "@/lib/checklist";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { clientOptionLabel, formatDateTime } from "@/lib/format";
import { ChecklistSuccessToast } from "@/components/checklist-success-toast";

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
type Client = { id:string; display_name:string; products:string|null; primary_analyst_id:string|null; primary_analyst_name:string|null };
type ItemStatus = "EM_VALIDACAO"|"COM_ERRO"|"CONCLUIDO";
type ItemRow = {
  item_key:string;
  status:ItemStatus;
  completed:boolean;
  observation:string|null;
  completed_at:string|null;
  updated_at:string;
  updated_by_name:string|null;
};

const statusLabel: Record<ItemStatus,string> = {
  EM_VALIDACAO:"Em validação",
  COM_ERRO:"Com erro",
  CONCLUIDO:"Concluído",
};

export default async function ChecklistPage({
  searchParams,
}: {
  searchParams: Promise<Record<string,string|string[]|undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const get = (key:string) => typeof sp[key] === "string" ? String(sp[key]) : "";

  const date = get("date") || todaySaoPaulo();
  const saved = get("saved") === "1";
  const selectedActionKey = get("action");

  const [analystsRes,clientsRes] = await Promise.all([
    query<Analyst>(
      "SELECT id,name,username FROM users WHERE role='ANALYST' AND active=TRUE ORDER BY name"
    ),
    query<Client>(`
      SELECT
        c.id,
        c.display_name,
        (
          SELECT STRING_AGG(DISTINCT p.code, ', ' ORDER BY p.code)
          FROM client_portfolios cp
          JOIN products p ON p.id=cp.product_id
          WHERE cp.client_id=c.id
            AND cp.active=TRUE
        ) AS products,
        primary_link.analyst_id AS primary_analyst_id,
        primary_user.name AS primary_analyst_name
      FROM clients c
      LEFT JOIN LATERAL (
        SELECT ac.analyst_id
        FROM analyst_clients ac
        WHERE ac.client_id=c.id
          AND ac.is_primary=TRUE
        ORDER BY ac.created_at NULLS LAST,ac.analyst_id
        LIMIT 1
      ) primary_link ON TRUE
      LEFT JOIN users primary_user ON primary_user.id=primary_link.analyst_id
      WHERE c.active=TRUE
      ORDER BY c.display_name
    `)
  ]);

  const analysts = analystsRes.rows;
  const clients = clientsRes.rows;

  const requestedClient = get("client");
  const defaultClient = clients.find(client => client.primary_analyst_id === user.id) ?? clients[0] ?? null;
  const selectedClient = clients.find(client => client.id === requestedClient) ?? defaultClient;

  const requestedAnalyst = get("analyst");
  const primaryAnalyst = selectedClient?.primary_analyst_id
    ? analysts.find(analyst => analyst.id === selectedClient.primary_analyst_id)
    : null;
  const selectedAnalyst =
    analysts.find(analyst => analyst.id === requestedAnalyst)
    ?? primaryAnalyst
    ?? analysts.find(analyst => analyst.id === user.id)
    ?? analysts[0]
    ?? null;

  let itemRows: ItemRow[] = [];
  if (selectedAnalyst && selectedClient) {
    itemRows = (await query<ItemRow>(`
      SELECT
        dci.item_key,
        dci.status,
        dci.completed,
        dci.observation,
        dci.completed_at::text,
        dci.updated_at::text,
        updater.name AS updated_by_name
      FROM daily_checklists dc
      JOIN daily_checklist_items dci ON dci.checklist_id=dc.id
      LEFT JOIN users updater ON updater.id=dci.updated_by
      WHERE dc.checklist_date=$1::date
        AND dc.analyst_id=$2
        AND dc.client_id=$3
    `, [date, selectedAnalyst.id, selectedClient.id])).rows;
  }

  const itemMap = new Map(itemRows.map(r => [r.item_key, r]));
  const lastChange = itemRows.reduce<ItemRow|null>((latest,row) => {
    if (!latest) return row;
    return new Date(row.updated_at).getTime() > new Date(latest.updated_at).getTime() ? row : latest;
  },null);
  const selectedIsPrimary = Boolean(
    selectedAnalyst && selectedClient && selectedClient.primary_analyst_id === selectedAnalyst.id
  );
  const total = CHECKLIST_ITEMS.length;
  const completed = CHECKLIST_ITEMS.filter(i => itemMap.get(i.key)?.status === "CONCLUIDO").length;
  const validation = CHECKLIST_ITEMS.filter(i => itemMap.get(i.key)?.status === "EM_VALIDACAO").length;
  const errors = CHECKLIST_ITEMS.filter(i => itemMap.get(i.key)?.status === "COM_ERRO").length;
  const untouched = Math.max(total - itemRows.length, 0);
  const pending = total - completed;
  const progress = total ? Math.round((completed / total) * 100) : 0;

  const selectedAction = CHECKLIST_ACTIONS.find(action => action.key === selectedActionKey) ?? null;
  const visibleItems = selectedAction
    ? CHECKLIST_ITEMS.filter(item => item.actionKey === selectedAction.key)
    : CHECKLIST_ITEMS;

  const baseHref = (actionKey?:string) => {
    if (!selectedAnalyst || !selectedClient) return "/checklist";
    const actionPart = actionKey ? `&action=${encodeURIComponent(actionKey)}` : "";
    return `/checklist?date=${encodeURIComponent(date)}&analyst=${encodeURIComponent(selectedAnalyst.id)}&client=${encodeURIComponent(selectedClient.id)}${actionPart}`;
  };

  return <>
    <div className="page-head">
      <div>
        <h1>Checklist</h1>
        <p>Acesso compartilhado ao checklist, mantendo o analista principal como referência da carteira.</p>
      </div>
    </div>

    {saved && <ChecklistSuccessToast/>}

    <form className="card checklist-filters" method="get">
      <div className="field">
        <label>Data</label>
        <input className="input" type="date" name="date" defaultValue={date}/>
      </div>

      <div className="field">
        <label>Responsável</label>
        <select className="select" name="analyst" defaultValue={selectedAnalyst?.id || ""}>
          {analysts.map(a => <option key={a.id} value={a.id}>
            {a.name}{selectedClient?.primary_analyst_id === a.id ? " • Principal" : ""}
          </option>)}
        </select>
      </div>

      <div className="field">
        <label>Cliente</label>
        <select className="select" name="client" defaultValue={selectedClient?.id || ""}>
          {clients.map(c => <option key={c.id} value={c.id}>{clientOptionLabel(c.display_name,c.products)}{c.primary_analyst_name ? ` • Principal: ${c.primary_analyst_name}` : ""}</option>)}
        </select>
      </div>

      {selectedAction && <input type="hidden" name="action" value={selectedAction.key}/>}
      <button className="btn btn-secondary" type="submit">
        <ClipboardCheck size={16}/> Carregar checklist
      </button>
    </form>

    {!selectedAnalyst ? <section className="card empty">
      <strong>Nenhum analista disponível.</strong>
      Cadastre ou ative um analista para começar.
    </section> : !selectedClient ? <section className="card empty">
      <strong>Nenhum cliente vinculado.</strong>
      Nenhum cliente ativo está disponível para o checklist.
    </section> : <>
      <div className="checklist-summary-grid">
        <div className="card checklist-summary-card">
          <div className="checklist-summary-icon"><UserRound size={18}/></div>
          <div>
            <span>Responsável pelo checklist</span>
            <strong>{selectedAnalyst.name}</strong>
            {selectedIsPrimary && <small className="checklist-primary-label">Analista principal</small>}
          </div>
        </div>
        <div className="card checklist-summary-card">
          <div className="checklist-summary-icon"><CalendarDays size={18}/></div>
          <div><span>Data</span><strong>{date.split("-").reverse().join("/")}</strong></div>
        </div>
        <div className="card checklist-summary-card checklist-status-summary">
          <div className="checklist-summary-icon"><Clock3 size={18}/></div>
          <div>
            <span>Status do dia</span>
            <strong>{validation} validação · {errors} erro(s)</strong>
            {untouched > 0 && <small>{untouched} ainda não iniciado(s)</small>}
          </div>
        </div>
        <div className="card checklist-summary-card progress">
          <div className="checklist-progress-head"><span>Concluído</span><strong>{progress}%</strong></div>
          <div className="checklist-progress-bar"><span style={{width:`${progress}%`}}/></div>
          <small>{completed}/{total} concluídos · {pending} pendente(s)</small>
        </div>
      </div>

      <div className="checklist-last-change">
        <div className="checklist-last-change-icon"><UserRound size={16}/></div>
        <div>
          <span>Última alteração deste checklist</span>
          {lastChange
            ? <strong>{lastChange.updated_by_name || "Usuário não identificado"} · {formatDateTime(lastChange.updated_at)}</strong>
            : <strong>Ainda não houve alteração nesta data.</strong>}
        </div>
        {selectedClient.primary_analyst_name && <small>
          Principal da carteira: <b>{selectedClient.primary_analyst_name}</b>
        </small>}
      </div>

      <section className="checklist-action-filter-section">
        <div className="checklist-action-filter-head">
          <div>
            <h2>Filtrar por ação</h2>
            <p>Selecione uma ação para visualizar todas as validações daquele grupo ou use Todos para atualizar o checklist completo.</p>
          </div>
          <span className="badge">{visibleItems.length} validação(ões) visível(is)</span>
        </div>

        <div className="checklist-action-cards">
          <Link className={`checklist-action-card all ${!selectedAction ? "active" : ""}`} href={baseHref()}>
            <span className="checklist-action-card-index">ALL</span>
            <strong>Todos</strong>
            <small>{total} validações</small>
            <div className="checklist-action-card-all-stats">
              <i className="validation"/>{validation}
              <i className="error"/>{errors}
              <i className="done"/>{completed}
            </div>
          </Link>

          {CHECKLIST_ACTIONS.map((action,index) => {
            const groupItems = CHECKLIST_ITEMS.filter(item => item.actionKey === action.key);
            const groupRows = groupItems.map(item => itemMap.get(item.key)).filter(Boolean) as ItemRow[];
            const groupCompleted = groupItems.filter(item => itemMap.get(item.key)?.status === "CONCLUIDO").length;
            const groupErrors = groupItems.filter(item => itemMap.get(item.key)?.status === "COM_ERRO").length;
            const groupValidation = groupItems.filter(item => itemMap.get(item.key)?.status === "EM_VALIDACAO").length;
            const groupStarted = groupRows.length;
            const state = groupErrors > 0
              ? "COM_ERRO"
              : groupCompleted === groupItems.length && groupItems.length > 0
                ? "CONCLUIDO"
                : groupStarted > 0
                  ? "EM_VALIDACAO"
                  : "NAO_INICIADO";
            const stateLabel = state === "COM_ERRO"
              ? `${groupErrors} com erro`
              : state === "CONCLUIDO"
                ? "100% concluído"
                : state === "EM_VALIDACAO"
                  ? `${groupCompleted}/${groupItems.length} concluídas`
                  : "Não iniciado";

            return <Link
              key={action.key}
              className={`checklist-action-card state-${state.toLowerCase()} ${selectedAction?.key === action.key ? "active" : ""}`}
              href={baseHref(action.key)}
            >
              <span className="checklist-action-card-index">{String(index+1).padStart(2,"0")}</span>
              <strong>{action.label}</strong>
              <small>{groupItems.length} validação(ões)</small>
              <span className="checklist-action-card-status">{stateLabel}</span>
              {groupValidation > 0 && state !== "COM_ERRO" && <span className="checklist-action-card-mini">{groupValidation} em validação</span>}
            </Link>;
          })}
        </div>
      </section>

      <form action={saveChecklistAction} className="card checklist-card">
        <input type="hidden" name="checklist_date" value={date}/>
        <input type="hidden" name="analyst_id" value={selectedAnalyst.id}/>
        <input type="hidden" name="client_id" value={selectedClient.id}/>
        {selectedAction && <input type="hidden" name="return_action" value={selectedAction.key}/>}

        <div className="checklist-card-head">
          <div>
            <span className="checklist-client-kicker">Cliente · {selectedClient.display_name}</span>
            <h2>{selectedAction ? selectedAction.label : "Todas as validações"}</h2>
            <p>Altere o status durante o dia. Itens com erro podem voltar para validação e depois serem concluídos.</p>
          </div>
          <button className="btn btn-primary" type="submit">
            <Save size={16}/> Salvar validações
          </button>
        </div>

        <div className="table-wrap">
          <table className="checklist-table checklist-table-status">
            <thead>
              <tr>
                <th>Ação</th>
                <th>Validação</th>
                <th>Status</th>
                <th>Observação</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => {
                const value = itemMap.get(item.key);
                const currentStatus: ItemStatus = value?.status ?? "EM_VALIDACAO";
                return <tr
                  key={item.key}
                  className={
                    currentStatus === "CONCLUIDO"
                      ? "checklist-row-done"
                      : currentStatus === "COM_ERRO"
                        ? "checklist-row-error"
                        : "checklist-row-validation"
                  }
                >
                  <td>
                    <input type="hidden" name={`present_${item.key}`} value="1"/>
                    <strong>{item.action}</strong>
                  </td>
                  <td>{item.validation}</td>
                  <td>
                    <div className="checklist-status-flags">
                      <label className="checklist-status-flag validation">
                        <input
                          type="radio"
                          name={`status_${item.key}`}
                          value="EM_VALIDACAO"
                          defaultChecked={currentStatus === "EM_VALIDACAO"}
                        />
                        <span><Clock3 size={13}/> Em validação</span>
                      </label>
                      <label className="checklist-status-flag error">
                        <input
                          type="radio"
                          name={`status_${item.key}`}
                          value="COM_ERRO"
                          defaultChecked={currentStatus === "COM_ERRO"}
                        />
                        <span><AlertTriangle size={13}/> Com erro</span>
                      </label>
                      <label className="checklist-status-flag done">
                        <input
                          type="radio"
                          name={`status_${item.key}`}
                          value="CONCLUIDO"
                          defaultChecked={currentStatus === "CONCLUIDO"}
                        />
                        <span><CheckCircle2 size={13}/> Concluído</span>
                      </label>
                    </div>
                  </td>
                  <td>
                    <input
                      className="input checklist-note"
                      name={`note_${item.key}`}
                      defaultValue={value?.observation || ""}
                      placeholder={currentStatus === "COM_ERRO" ? "Descreva o erro encontrado" : "Observação opcional"}
                    />
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>

        <div className="checklist-footer">
          <span>{completed} de {total} concluídos · {validation} em validação · {errors} com erro</span>
          <button className="btn btn-primary" type="submit">
            <Save size={16}/> Salvar validações
          </button>
        </div>
      </form>
    </>}
  </>;
}
