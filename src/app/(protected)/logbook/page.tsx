import Link from "next/link";
import { Plus } from "lucide-react";
import { query } from "@/lib/db";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime } from "@/lib/format";

export default async function LogbookPage(){
  const rows=(await query<{id:string;title:string;client_name:string;products:string|null;ticket_id:string|null;status_code:string;status_label:string;created_at:string}>(`
    SELECT i.id,i.title,c.display_name client_name,i.ticket_id,i.status_code,s.label status_label,i.created_at::text,
      STRING_AGG(DISTINCT p.code,', ' ORDER BY p.code) products
    FROM incidents i JOIN clients c ON c.id=i.client_id JOIN incident_statuses s ON s.code=i.status_code
    LEFT JOIN incident_products ip ON ip.incident_id=i.id LEFT JOIN products p ON p.id=ip.product_id
    WHERE DATE(i.created_at AT TIME ZONE 'America/Sao_Paulo')=DATE(CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')
    GROUP BY i.id,c.display_name,s.label ORDER BY i.created_at DESC
  `)).rows;
  return <><div className="page-head"><div><h1>Diário de Bordo</h1><p>Registros incluídos hoje, em ordem cronológica.</p></div><Link className="btn btn-primary" href="/incidents/new"><Plus size={17}/> Novo registro</Link></div><section className="card panel">{rows.length?<div className="timeline">{rows.map(r=><div className="timeline-item" key={r.id}><strong><Link href={`/incidents/${r.id}`}>{r.title}</Link></strong><span>{formatDateTime(r.created_at)} · {r.client_name} · {r.products||"—"} · {r.ticket_id||"sem chamado"}</span><div style={{marginTop:7}}><StatusBadge code={r.status_code} label={r.status_label}/></div></div>)}</div>:<div className="empty"><strong>Tudo tranquilo por aqui.</strong>Nenhuma ocorrência registrada hoje. O silêncio do logbook é um bom tipo de silêncio.</div>}</section></>;
}
