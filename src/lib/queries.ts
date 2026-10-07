import { query } from "@/lib/db";

const TODAY = `DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = DATE(CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')`;

export async function getDashboardSummary() {
  const [summary, products, statuses, recent] = await Promise.all([
    query<{
      total_today: string; open: string; in_progress: string; waiting: string; resolved_today: string; affected_clients: string;
    }>(`
      SELECT
        COUNT(*) FILTER (WHERE ${TODAY})::text total_today,
        COUNT(*) FILTER (WHERE s.is_closed = FALSE AND ${TODAY})::text open,
        COUNT(*) FILTER (WHERE i.status_code = 'EM_TRATATIVA' AND ${TODAY})::text in_progress,
        COUNT(*) FILTER (WHERE i.status_code LIKE 'AGUARDANDO_%' AND ${TODAY})::text waiting,
        COUNT(*) FILTER (WHERE i.status_code IN ('RESOLVIDO','ENCERRADO') AND ${TODAY})::text resolved_today,
        COUNT(DISTINCT i.client_id) FILTER (WHERE ${TODAY})::text affected_clients
      FROM incidents i
      JOIN incident_statuses s ON s.code = i.status_code
    `),
    query<{ code: string; total: string }>(`
      SELECT p.code, COUNT(DISTINCT i.id)::text total
      FROM products p
      LEFT JOIN incident_products ip ON ip.product_id = p.id
      LEFT JOIN incidents i ON i.id = ip.incident_id AND DATE(i.created_at AT TIME ZONE 'America/Sao_Paulo') = DATE(CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')
      WHERE p.code IN ('LOCATOR','ADA')
      GROUP BY p.code
    `),
    query<{ code: string; label: string; total: string }>(`
      SELECT s.code, s.label, COUNT(i.id)::text total
      FROM incident_statuses s
      LEFT JOIN incidents i ON i.status_code = s.code AND DATE(i.created_at AT TIME ZONE 'America/Sao_Paulo') = DATE(CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')
      WHERE s.active = TRUE
      GROUP BY s.code, s.label, s.sort_order
      ORDER BY s.sort_order
    `),
    query<{ id: string; action: string; entity: string; entity_id: string | null; created_at: string; user_name: string | null }>(`
      SELECT a.id::text, a.action, a.entity, a.entity_id, a.created_at::text, u.name user_name
      FROM audit_logs a
      LEFT JOIN users u ON u.id = a.user_id
      ORDER BY a.created_at DESC
      LIMIT 8
    `),
  ]);

  const base = summary.rows[0] ?? { total_today: "0", open: "0", in_progress: "0", waiting: "0", resolved_today: "0", affected_clients: "0" };
  const productMap = Object.fromEntries(products.rows.map((r) => [r.code, Number(r.total)]));
  return {
    totalToday: Number(base.total_today),
    open: Number(base.open),
    inProgress: Number(base.in_progress),
    waiting: Number(base.waiting),
    resolvedToday: Number(base.resolved_today),
    affectedClients: Number(base.affected_clients),
    locator: productMap.LOCATOR ?? 0,
    ada: productMap.ADA ?? 0,
    statuses: statuses.rows.map((r) => ({ ...r, total: Number(r.total) })),
    recent: recent.rows,
  };
}

export async function getClients() {
  return (await query<{ id: string; name: string; display_name: string; active: boolean; products: string | null }>(`
    SELECT c.id, c.name, c.display_name, c.active,
      STRING_AGG(p.code, ', ' ORDER BY p.code) products
    FROM clients c
    LEFT JOIN client_products cp ON cp.client_id = c.id
    LEFT JOIN products p ON p.id = cp.product_id
    GROUP BY c.id
    ORDER BY c.display_name
  `)).rows;
}

export async function getProducts() {
  return (await query<{ id: string; code: string; name: string }>("SELECT id, code, name FROM products WHERE active = TRUE ORDER BY name")).rows;
}

export async function getStatuses() {
  return (await query<{ code: string; label: string }>("SELECT code, label FROM incident_statuses WHERE active = TRUE ORDER BY sort_order")).rows;
}

export async function getPriorities() {
  return (await query<{ code: string; label: string }>("SELECT code, label FROM priorities WHERE active = TRUE ORDER BY sort_order")).rows;
}

export async function getAnalysts() {
  return (await query<{ id: string; name: string; email: string | null; username: string; role: string; position: string | null; active: boolean }>(
    "SELECT id, name, email, username, role, position, active FROM users WHERE role IN ('ADMIN','ANALYST') ORDER BY name"
  )).rows;
}

export async function getIncidents(filters: { q?: string; status?: string; client?: string; analyst?: string; product?: string } = {}, limit = 100) {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (value: unknown) => { params.push(value); return `$${params.length}`; };
  if (filters.q) {
    const p = add(`%${filters.q}%`);
    where.push(`(i.title ILIKE ${p} OR i.description ILIKE ${p} OR i.ticket_id ILIKE ${p} OR c.display_name ILIKE ${p})`);
  }
  if (filters.status) where.push(`i.status_code = ${add(filters.status)}`);
  if (filters.client) where.push(`i.client_id = ${add(filters.client)}::uuid`);
  if (filters.analyst) where.push(`i.assigned_user_id = ${add(filters.analyst)}::uuid`);
  if (filters.product) where.push(`EXISTS (SELECT 1 FROM incident_products ip2 JOIN products p2 ON p2.id=ip2.product_id WHERE ip2.incident_id=i.id AND p2.code=${add(filters.product)})`);
  params.push(limit);

  return (await query<{
    id: string; title: string; client_name: string; ticket_id: string | null; priority_code: string; status_code: string; status_label: string;
    analyst_name: string | null; products: string | null; created_at: string; updated_at: string;
  }>(`
    SELECT i.id, i.title, c.display_name client_name, i.ticket_id, i.priority_code, i.status_code,
      s.label status_label, u.name analyst_name, i.created_at::text, i.updated_at::text,
      STRING_AGG(DISTINCT p.code, ', ' ORDER BY p.code) products
    FROM incidents i
    JOIN clients c ON c.id=i.client_id
    JOIN incident_statuses s ON s.code=i.status_code
    LEFT JOIN users u ON u.id=i.assigned_user_id
    LEFT JOIN incident_products ip ON ip.incident_id=i.id
    LEFT JOIN products p ON p.id=ip.product_id
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    GROUP BY i.id, c.display_name, s.label, u.name
    ORDER BY i.created_at DESC
    LIMIT $${params.length}
  `, params)).rows;
}

export async function getIncident(id: string) {
  const incident = (await query<{
    id: string; client_id: string; client_name: string; title: string; description: string; has_ticket: boolean; ticket_id: string | null;
    ticket_url: string | null; ticket_opened_at: string | null; priority_code: string; status_code: string; status_label: string;
    assigned_user_id: string | null; analyst_name: string | null; internal_notes: string | null; created_at: string; updated_at: string; products: string | null;
  }>(`
    SELECT i.id, i.client_id, c.display_name client_name, i.title, i.description, i.has_ticket, i.ticket_id,
      i.ticket_url, i.ticket_opened_at::text, i.priority_code, i.status_code, s.label status_label,
      i.assigned_user_id, u.name analyst_name, i.internal_notes, i.created_at::text, i.updated_at::text,
      STRING_AGG(DISTINCT p.code, ', ' ORDER BY p.code) products
    FROM incidents i
    JOIN clients c ON c.id=i.client_id
    JOIN incident_statuses s ON s.code=i.status_code
    LEFT JOIN users u ON u.id=i.assigned_user_id
    LEFT JOIN incident_products ip ON ip.incident_id=i.id
    LEFT JOIN products p ON p.id=ip.product_id
    WHERE i.id=$1
    GROUP BY i.id, c.display_name, s.label, u.name
  `, [id])).rows[0];
  if (!incident) return null;

  const [updates, responses] = await Promise.all([
    query<{ id: string; update_type: string; old_value: string | null; new_value: string | null; comment: string | null; created_at: string; user_name: string | null }>(`
      SELECT iu.id, iu.update_type, iu.old_value, iu.new_value, iu.comment, iu.created_at::text, u.name user_name
      FROM incident_updates iu LEFT JOIN users u ON u.id=iu.user_id
      WHERE iu.incident_id=$1 ORDER BY iu.created_at DESC
    `, [id]),
    query<{ id: string; ticket_id: string | null; response_text: string; root_cause: string | null; solution: string | null; required_action: string | null; responded_by: string | null; response_date: string; created_at: string }>(`
      SELECT id, ticket_id, response_text, root_cause, solution, required_action, responded_by, response_date::text, created_at::text
      FROM ticket_responses WHERE incident_id=$1 ORDER BY response_date DESC
    `, [id]),
  ]);
  return { incident, updates: updates.rows, responses: responses.rows };
}
