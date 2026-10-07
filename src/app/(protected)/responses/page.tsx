import Link from "next/link";
import { MessageSquareText } from "lucide-react";
import { query } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export default async function ResponsesPage(){
  const responses=(await query<{id:string;incident_id:string;client_name:string;title:string;ticket_id:string|null;response_text:string;responded_by:string|null;response_date:string}>(`
    SELECT r.id,r.incident_id,c.display_name client_name,i.title,COALESCE(r.ticket_id,i.ticket_id) ticket_id,r.response_text,r.responded_by,r.response_date::text
    FROM ticket_responses r JOIN incidents i ON i.id=r.incident_id JOIN clients c ON c.id=i.client_id
    ORDER BY r.response_date DESC LIMIT 100
  `)).rows;
  return <><div className="page-head"><div><h1>Respostas dos chamados</h1><p>Histórico de retornos recebidos para cada incidente.</p></div></div>
  <section className="card table-card" style={{marginTop:0}}><div className="table-wrap"><table><thead><tr><th>Data</th><th>Cliente</th><th>Incidente</th><th>Chamado</th><th>Responsável</th><th>Resposta</th></tr></thead><tbody>{responses.map(r=><tr key={r.id}><td>{formatDateTime(r.response_date)}</td><td><strong>{r.client_name}</strong></td><td><Link href={`/incidents/${r.incident_id}`}>{r.title}</Link></td><td>{r.ticket_id||"—"}</td><td>{r.responded_by||"—"}</td><td>{r.response_text.length>120?`${r.response_text.slice(0,120)}…`:r.response_text}</td></tr>)}</tbody></table></div>{!responses.length&&<div className="empty"><MessageSquareText size={30}/><strong>Nenhuma resposta registrada</strong>As respostas aparecerão aqui sem sobrescrever o histórico anterior.</div>}</section></>;
}
