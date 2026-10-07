import { query } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export default async function HistoryPage(){
  const rows=(await query<{id:string;action:string;entity:string;entity_id:string|null;metadata:Record<string,unknown>;created_at:string;user_name:string|null}>(`SELECT a.id::text,a.action,a.entity,a.entity_id,a.metadata,a.created_at::text,u.name user_name FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 250`)).rows;
  return <><div className="page-head"><div><h1>Histórico</h1><p>Trilha de auditoria das principais operações do OSP Logbook.</p></div></div><section className="card table-card" style={{marginTop:0}}><div className="table-wrap"><table><thead><tr><th>Data/Hora</th><th>Usuário</th><th>Ação</th><th>Entidade</th><th>ID</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{formatDateTime(r.created_at)}</td><td>{r.user_name||"Sistema"}</td><td><strong>{r.action.replaceAll("_"," ")}</strong></td><td>{r.entity}</td><td>{r.entity_id||"—"}</td></tr>)}</tbody></table></div></section></>;
}
