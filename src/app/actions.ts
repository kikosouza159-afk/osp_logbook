"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSession, destroySession, requireUser } from "@/lib/auth";
import { getPool, query } from "@/lib/db";
import { audit } from "@/lib/audit";

const loginSchema = z.object({ username: z.string().min(1), password: z.string().min(1) });

function text(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullable(value: string) { return value || null; }

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({ username: text(formData, "username"), password: text(formData, "password") });
  if (!parsed.success) redirect("/login?error=1");

  const result = await query<{ id: string; name: string; username: string; password_hash: string; role: "ADMIN"|"ANALYST"|"VIEWER"; active: boolean }>(
    "SELECT id, name, username, password_hash, role, active FROM users WHERE username=$1",
    [parsed.data.username]
  );
  const user = result.rows[0];
  if (!user || !user.active || !(await bcrypt.compare(parsed.data.password, user.password_hash))) {
    redirect("/login?error=1");
  }
  await createSession({ id: user.id, name: user.name, username: user.username, role: user.role });
  await query("UPDATE users SET last_login_at=NOW() WHERE id=$1", [user.id]);
  await audit(user.id, "LOGIN", "session", user.id);
  redirect("/");
}

export async function logoutAction() {
  const user = await requireUser();
  await audit(user.id, "LOGOUT", "session", user.id);
  await destroySession();
  redirect("/login");
}

export async function createClientAction(formData: FormData) {
  const user = await requireUser(["ADMIN", "ANALYST"]);
  const schema = z.object({ name: z.string().min(2), displayName: z.string().min(2), products: z.array(z.string()).min(1) });
  const parsed = schema.safeParse({ name: text(formData, "name"), displayName: text(formData, "display_name"), products: formData.getAll("products").map(String) });
  if (!parsed.success) throw new Error("Preencha o cliente e selecione ao menos um produto.");

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query<{ id: string }>(
      "INSERT INTO clients(name, display_name) VALUES($1,$2) RETURNING id",
      [parsed.data.name, parsed.data.displayName]
    );
    const id = inserted.rows[0].id;
    await client.query(
      `INSERT INTO client_products(client_id, product_id)
       SELECT $1::uuid, id FROM products WHERE code = ANY($2::text[]) ON CONFLICT DO NOTHING`,
      [id, parsed.data.products]
    );
    await client.query("INSERT INTO audit_logs(user_id,action,entity,entity_id,metadata) VALUES($1,'CREATE_CLIENT','client',$2,$3::jsonb)", [user.id, id, JSON.stringify({ displayName: parsed.data.displayName, products: parsed.data.products })]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally { client.release(); }
  revalidatePath("/clients");
}

export async function createAnalystAction(formData: FormData) {
  const actor = await requireUser(["ADMIN"]);
  const schema = z.object({ name: z.string().min(2), email: z.string().email(), username: z.string().min(3), password: z.string().min(6), position: z.string().optional() });
  const parsed = schema.safeParse({ name: text(formData, "name"), email: text(formData, "email"), username: text(formData, "username"), password: text(formData, "password"), position: text(formData, "position") });
  if (!parsed.success) throw new Error("Dados do analista inválidos.");
  const hash = await bcrypt.hash(parsed.data.password, 12);
  const result = await query<{ id: string }>(
    `INSERT INTO users(name,email,username,password_hash,role,position,must_change_password)
     VALUES($1,$2,$3,$4,'ANALYST',$5,TRUE) RETURNING id`,
    [parsed.data.name, parsed.data.email, parsed.data.username, hash, nullable(parsed.data.position ?? "")]
  );
  await audit(actor.id, "CREATE_ANALYST", "user", result.rows[0].id, { username: parsed.data.username });
  revalidatePath("/analysts");
}

export async function assignAnalystClientAction(formData: FormData) {
  const actor = await requireUser(["ADMIN"]);
  const analystId = text(formData, "analyst_id");
  const clientId = text(formData, "client_id");
  const isPrimary = formData.get("is_primary") === "on";
  if (!analystId || !clientId) throw new Error("Selecione analista e cliente.");
  if (isPrimary) await query("UPDATE analyst_clients SET is_primary=FALSE WHERE client_id=$1", [clientId]);
  await query(
    `INSERT INTO analyst_clients(analyst_id,client_id,is_primary) VALUES($1,$2,$3)
     ON CONFLICT(analyst_id,client_id) DO UPDATE SET is_primary=EXCLUDED.is_primary`,
    [analystId, clientId, isPrimary]
  );
  await audit(actor.id, "ASSIGN_ANALYST", "client", clientId, { analystId, isPrimary });
  revalidatePath("/analysts");
}

export async function createIncidentAction(formData: FormData) {
  const user = await requireUser(["ADMIN", "ANALYST"]);
  const data = {
    clientId: text(formData, "client_id"), title: text(formData, "title"), description: text(formData, "description"),
    products: formData.getAll("products").map(String), priority: text(formData, "priority"), status: text(formData, "status"),
    analyst: text(formData, "assigned_user_id"), hasTicket: formData.get("has_ticket") === "on", ticketId: text(formData, "ticket_id"),
    ticketUrl: text(formData, "ticket_url"), ticketOpenedAt: text(formData, "ticket_opened_at"), notes: text(formData, "internal_notes")
  };
  const parsed = z.object({ clientId:z.string().uuid(), title:z.string().min(3), description:z.string().min(3), products:z.array(z.string()).min(1), priority:z.string().min(1), status:z.string().min(1) }).safeParse(data);
  if (!parsed.success) throw new Error("Preencha os campos obrigatórios do incidente.");
  if (data.hasTicket && !data.ticketId) throw new Error("Informe o ID do chamado.");

  const client = await getPool().connect();
  let incidentId = "";
  try {
    await client.query("BEGIN");
    const inserted = await client.query<{ id: string }>(`
      INSERT INTO incidents(client_id,title,description,has_ticket,ticket_id,ticket_url,ticket_opened_at,priority_code,status_code,assigned_user_id,internal_notes,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id
    `, [data.clientId,data.title,data.description,data.hasTicket,nullable(data.ticketId),nullable(data.ticketUrl),nullable(data.ticketOpenedAt),data.priority,data.status,nullable(data.analyst),nullable(data.notes),user.id]);
    incidentId = inserted.rows[0].id;
    await client.query(`INSERT INTO incident_products(incident_id,product_id) SELECT $1::uuid,id FROM products WHERE code=ANY($2::text[])`, [incidentId,data.products]);
    await client.query(`INSERT INTO incident_updates(incident_id,user_id,update_type,new_value,comment) VALUES($1,$2,'INCIDENT_CREATED',$3,$4)`, [incidentId,user.id,data.status,"Registro criado no diário de bordo"]);
    await client.query(`INSERT INTO audit_logs(user_id,action,entity,entity_id,metadata) VALUES($1,'CREATE_INCIDENT','incident',$2,$3::jsonb)`, [user.id,incidentId,JSON.stringify({ clientId:data.clientId,products:data.products,status:data.status })]);
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
  revalidatePath("/"); revalidatePath("/incidents"); revalidatePath("/logbook");
  redirect(`/incidents/${incidentId}`);
}

export async function updateIncidentAction(formData: FormData) {
  const user = await requireUser(["ADMIN", "ANALYST"]);
  const id = text(formData, "id");
  const current = (await query<{ status_code:string; assigned_user_id:string|null; priority_code:string }>("SELECT status_code,assigned_user_id,priority_code FROM incidents WHERE id=$1", [id])).rows[0];
  if (!current) throw new Error("Incidente não encontrado.");
  const status = text(formData,"status"), analyst = nullable(text(formData,"assigned_user_id")), priority = text(formData,"priority");
  await query(`UPDATE incidents SET title=$2,description=$3,priority_code=$4,status_code=$5,assigned_user_id=$6,internal_notes=$7,
      has_ticket=$8,ticket_id=$9,ticket_url=$10,ticket_opened_at=$11,updated_at=NOW(),resolved_at=CASE WHEN $5 IN ('RESOLVIDO','ENCERRADO') THEN COALESCE(resolved_at,NOW()) ELSE NULL END
      WHERE id=$1`, [id,text(formData,"title"),text(formData,"description"),priority,status,analyst,nullable(text(formData,"internal_notes")),formData.get("has_ticket")==="on",nullable(text(formData,"ticket_id")),nullable(text(formData,"ticket_url")),nullable(text(formData,"ticket_opened_at"))]);
  if (current.status_code !== status) await query("INSERT INTO incident_updates(incident_id,user_id,update_type,old_value,new_value) VALUES($1,$2,'STATUS_CHANGE',$3,$4)",[id,user.id,current.status_code,status]);
  if (current.assigned_user_id !== analyst) await query("INSERT INTO incident_updates(incident_id,user_id,update_type,old_value,new_value) VALUES($1,$2,'ASSIGN_ANALYST',$3,$4)",[id,user.id,current.assigned_user_id,analyst]);
  await audit(user.id,"UPDATE_INCIDENT","incident",id,{status,priority,analyst});
  revalidatePath(`/incidents/${id}`); revalidatePath("/incidents"); revalidatePath("/");
}

export async function addTicketResponseAction(formData: FormData) {
  const user = await requireUser(["ADMIN", "ANALYST"]);
  const incidentId=text(formData,"incident_id"), statusAfter=text(formData,"status_after"), response=text(formData,"response_text");
  if (!incidentId || !response) throw new Error("Incidente e resposta são obrigatórios.");
  const result = await query<{ id:string }>(`
    INSERT INTO ticket_responses(incident_id,ticket_id,response_text,root_cause,solution,required_action,responded_by,response_date,status_after,internal_note,created_by)
    VALUES($1,$2,$3,$4,$5,$6,$7,COALESCE($8::timestamptz,NOW()),$9,$10,$11) RETURNING id
  `,[incidentId,nullable(text(formData,"ticket_id")),response,nullable(text(formData,"root_cause")),nullable(text(formData,"solution")),nullable(text(formData,"required_action")),nullable(text(formData,"responded_by")),nullable(text(formData,"response_date")),nullable(statusAfter),nullable(text(formData,"internal_note")),user.id]);
  await query("INSERT INTO incident_updates(incident_id,user_id,update_type,new_value,comment) VALUES($1,$2,'TICKET_RESPONSE',$3,$4)",[incidentId,user.id,result.rows[0].id,"Resposta do chamado registrada"]);
  if (statusAfter) await query("UPDATE incidents SET status_code=$2, updated_at=NOW(), resolved_at=CASE WHEN $2 IN ('RESOLVIDO','ENCERRADO') THEN COALESCE(resolved_at,NOW()) ELSE NULL END WHERE id=$1",[incidentId,statusAfter]);
  await audit(user.id,"CREATE_RESPONSE","ticket_response",result.rows[0].id,{incidentId,statusAfter});
  revalidatePath(`/incidents/${incidentId}`); revalidatePath("/responses"); revalidatePath("/");
  redirect(`/incidents/${incidentId}`);
}
