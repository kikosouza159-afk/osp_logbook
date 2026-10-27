"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSession, destroySession, getSessionUser, requireUser } from "@/lib/auth";
import { getPool, query } from "@/lib/db";
import { audit } from "@/lib/audit";
import { CHECKLIST_ITEMS } from "@/lib/checklist";

const loginSchema = z.object({ username: z.string().min(1), password: z.string().min(1) });

function analystInitialPassword() {
  const value = process.env.ANALYST_INITIAL_PASSWORD;
  if (!value) throw new Error("ANALYST_INITIAL_PASSWORD não configurada.");
  return value;
}

function text(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullable(value: string) { return value || null; }

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({ username: text(formData, "username"), password: text(formData, "password") });
  if (!parsed.success) redirect("/login?error=1");

  const result = await query<{ id: string; name: string; username: string; password_hash: string; role: "ADMIN"|"ANALYST"|"VIEWER"; active: boolean; must_change_password: boolean; tutorial_completed: boolean }>(
    "SELECT id, name, username, password_hash, role, active, must_change_password, tutorial_completed FROM users WHERE username=$1",
    [parsed.data.username]
  );
  const user = result.rows[0];
  if (!user || !user.active || !(await bcrypt.compare(parsed.data.password, user.password_hash))) {
    redirect("/login?error=1");
  }
  await createSession({ id: user.id, name: user.name, username: user.username, role: user.role, must_change_password: user.must_change_password, tutorial_completed: user.tutorial_completed });
  await query("UPDATE users SET last_login_at=NOW() WHERE id=$1", [user.id]);
  await audit(user.id, "LOGIN", "session", user.id);
  if (user.role === "ANALYST" && user.must_change_password) redirect("/change-password");
  if (user.role === "ANALYST" && !user.tutorial_completed) redirect("/guide");
  redirect("/");
}

export async function logoutAction() {
  const user = await getSessionUser();
  if (user) await audit(user.id, "LOGOUT", "session", user.id);
  await destroySession();
  redirect("/login");
}

function normalizePortfolioValue(value:string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/\u00a0/g," ")
    .replace(/\s+/g," ")
    .trim()
    .toLowerCase();
}

async function resolvePortfolioAnalyst(client: import("pg").PoolClient, value:string) {
  const normalized = normalizePortfolioValue(value);
  if (!normalized) return null;

  const aliasToUsername: Record<string,string> = {
    "duda":"eduarda.salvador",
    "eduarda":"eduarda.salvador",
    "michele":"michele.silva",
    "pedro":"pedro.santos",
    "sheila":"sheila.marques",
    "elvis":"elvis.santos",
  };

  const aliasUsername = aliasToUsername[normalized];
  if (aliasUsername) {
    const byAlias = await client.query<{id:string}>(
      "SELECT id FROM users WHERE username=$1 AND active=TRUE LIMIT 1",
      [aliasUsername]
    );
    if (byAlias.rows[0]) return byAlias.rows[0].id;
  }

  const result = await client.query<{id:string}>(
    `SELECT id
     FROM users
     WHERE active=TRUE
       AND role IN ('ADMIN','ANALYST')
       AND (
         LOWER(name)=LOWER($1)
         OR LOWER(username)=LOWER($1)
         OR LOWER(SPLIT_PART(name,' ',1))=LOWER($1)
       )
     ORDER BY CASE WHEN LOWER(name)=LOWER($1) THEN 0 ELSE 1 END
     LIMIT 1`,
    [value.trim()]
  );
  return result.rows[0]?.id ?? null;
}

async function upsertClientPortfolio(
  client: import("pg").PoolClient,
  data:{clientName:string; analystName:string; productCode:string; commercialName?:string}
) {
  const clientName = data.clientName.replace(/\u00a0/g," ").replace(/\s+/g," ").trim();
  const productCode = normalizePortfolioValue(data.productCode) === "ada" ? "ADA"
    : normalizePortfolioValue(data.productCode) === "locator" ? "LOCATOR"
    : "";

  if (!clientName) throw new Error("Cliente não informado.");
  if (!productCode) throw new Error(`Produto inválido para ${clientName}. Use Locator ou ADA.`);

  const analystId = await resolvePortfolioAnalyst(client,data.analystName);
  if (data.analystName && !analystId) {
    throw new Error(`Acompanhamento "${data.analystName}" não encontrado para ${clientName}.`);
  }

  const product = (await client.query<{id:string}>(
    "SELECT id FROM products WHERE code=$1 AND active=TRUE LIMIT 1",
    [productCode]
  )).rows[0];
  if (!product) throw new Error(`Produto ${productCode} não está ativo no cadastro.`);

  let commercialId:string|null = null;
  if (data.commercialName) {
    const commercial = (await client.query<{id:string}>(
      "SELECT id FROM commercials WHERE LOWER(name)=LOWER($1) AND active=TRUE LIMIT 1",
      [data.commercialName.trim()]
    )).rows[0];
    if (!commercial) throw new Error(`Comercial "${data.commercialName}" não encontrado para ${clientName}.`);
    commercialId = commercial.id;
  }

  let target = (await client.query<{id:string}>(
    "SELECT id FROM clients WHERE LOWER(display_name)=LOWER($1) LIMIT 1",
    [clientName]
  )).rows[0];

  if (!target) {
    target = (await client.query<{id:string}>(
      "INSERT INTO clients(name,display_name,active) VALUES($1,$1,TRUE) RETURNING id",
      [clientName]
    )).rows[0];
  } else {
    await client.query(
      "UPDATE clients SET display_name=$2,name=$2,active=TRUE,updated_at=NOW() WHERE id=$1",
      [target.id,clientName]
    );
  }

  await client.query(
    `INSERT INTO client_products(client_id,product_id)
     VALUES($1,$2)
     ON CONFLICT(client_id,product_id) DO NOTHING`,
    [target.id,product.id]
  );

  await client.query(
    `INSERT INTO client_portfolios(client_id,product_id,analyst_id,commercial_id,active)
     VALUES($1,$2,$3,$4,TRUE)
     ON CONFLICT(client_id,product_id)
     DO UPDATE SET
       analyst_id=EXCLUDED.analyst_id,
       commercial_id=EXCLUDED.commercial_id,
       active=TRUE,
       updated_at=NOW()`,
    [target.id,product.id,analystId,commercialId]
  );

  if (analystId) {
    const hasPrimary = (await client.query<{exists:boolean}>(
      "SELECT EXISTS(SELECT 1 FROM analyst_clients WHERE client_id=$1 AND is_primary=TRUE) AS exists",
      [target.id]
    )).rows[0]?.exists ?? false;

    await client.query(
      `INSERT INTO analyst_clients(analyst_id,client_id,is_primary)
       VALUES($1,$2,$3)
       ON CONFLICT(analyst_id,client_id) DO NOTHING`,
      [analystId,target.id,!hasPrimary]
    );
  }

  return {clientId:target.id,productCode,analystId,commercialId};
}

export async function createClientAction(formData: FormData) {
  const user = await requireUser(["ADMIN","ANALYST"]);
  const data = {
    clientName:text(formData,"client_name") || text(formData,"display_name") || text(formData,"name"),
    analystName:text(formData,"analyst_name"),
    productCode:text(formData,"product"),
    commercialName:text(formData,"commercial"),
  };

  const parsed = z.object({
    clientName:z.string().min(2),
    analystName:z.string().min(1),
    productCode:z.string().min(1),
    commercialName:z.string().optional(),
  }).safeParse(data);
  if (!parsed.success) throw new Error("Preencha Cliente, Acompanhamento e Produto.");

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const saved = await upsertClientPortfolio(client,parsed.data);
    await client.query(
      "INSERT INTO audit_logs(user_id,action,entity,entity_id,metadata) VALUES($1,'UPSERT_CLIENT_PORTFOLIO','client',$2,$3::jsonb)",
      [user.id,saved.clientId,JSON.stringify({...parsed.data,productCode:saved.productCode})]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  revalidatePath("/clients");
  revalidatePath("/analysts");
  revalidatePath("/checklist");
  revalidatePath("/");
  redirect("/clients?saved=1");
}

export async function updateClientPortfolioAction(formData: FormData) {
  const actor = await requireUser(["ADMIN"]);
  const data = {
    portfolioId:text(formData,"portfolio_id"),
    clientName:text(formData,"client_name"),
    analystName:text(formData,"analyst_name"),
    productCode:text(formData,"product"),
    commercialName:text(formData,"commercial"),
  };

  const parsed = z.object({
    portfolioId:z.string().uuid(),
    clientName:z.string().min(2),
    analystName:z.string().min(1),
    productCode:z.string().min(1),
    commercialName:z.string().optional(),
  }).safeParse(data);
  if (!parsed.success) throw new Error("Dados inválidos para edição do cliente.");

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    const current = (await client.query<{
      id:string;
      client_id:string;
      product_id:string;
      analyst_id:string|null;
      commercial_id:string|null;
      client_name:string;
      product_code:string;
    }>(
      `SELECT
         cp.id,
         cp.client_id,
         cp.product_id,
         cp.analyst_id,
         cp.commercial_id,
         c.display_name AS client_name,
         p.code AS product_code
       FROM client_portfolios cp
       JOIN clients c ON c.id=cp.client_id
       JOIN products p ON p.id=cp.product_id
       WHERE cp.id=$1
       FOR UPDATE OF cp,c`,
      [parsed.data.portfolioId]
    )).rows[0];

    if (!current) throw new Error("Carteira não encontrada.");

    const clientName = parsed.data.clientName.replace(/\u00a0/g," ").replace(/\s+/g," ").trim();
    const productCode = normalizePortfolioValue(parsed.data.productCode) === "ada" ? "ADA"
      : normalizePortfolioValue(parsed.data.productCode) === "locator" ? "LOCATOR"
      : "";
    if (!productCode) throw new Error("Produto inválido. Use Locator ou ADA.");

    const analystId = await resolvePortfolioAnalyst(client,parsed.data.analystName);
    if (!analystId) throw new Error(`Acompanhamento "${parsed.data.analystName}" não encontrado.`);

    const product = (await client.query<{id:string}>(
      "SELECT id FROM products WHERE code=$1 AND active=TRUE LIMIT 1",
      [productCode]
    )).rows[0];
    if (!product) throw new Error(`Produto ${productCode} não está ativo no cadastro.`);

    let commercialId:string|null = null;
    if (parsed.data.commercialName) {
      const commercial = (await client.query<{id:string}>(
        "SELECT id FROM commercials WHERE LOWER(name)=LOWER($1) AND active=TRUE LIMIT 1",
        [parsed.data.commercialName]
      )).rows[0];
      if (!commercial) throw new Error(`Comercial "${parsed.data.commercialName}" não encontrado.`);
      commercialId = commercial.id;
    }

    const duplicateClient = (await client.query<{id:string}>(
      "SELECT id FROM clients WHERE id<>$1 AND LOWER(display_name)=LOWER($2) LIMIT 1",
      [current.client_id,clientName]
    )).rows[0];
    if (duplicateClient) {
      throw new Error(`Já existe outro cliente cadastrado como "${clientName}".`);
    }

    const duplicatePortfolio = (await client.query<{id:string}>(
      "SELECT id FROM client_portfolios WHERE client_id=$1 AND product_id=$2 AND id<>$3 LIMIT 1",
      [current.client_id,product.id,current.id]
    )).rows[0];
    if (duplicatePortfolio) {
      throw new Error(`O cliente ${clientName} já possui uma carteira ${productCode}.`);
    }

    await client.query(
      "UPDATE clients SET name=$2,display_name=$2,active=TRUE,updated_at=NOW() WHERE id=$1",
      [current.client_id,clientName]
    );

    await client.query(
      `UPDATE client_portfolios
       SET product_id=$2,analyst_id=$3,commercial_id=$4,active=TRUE,updated_at=NOW()
       WHERE id=$1`,
      [current.id,product.id,analystId,commercialId]
    );

    await client.query(
      `INSERT INTO client_products(client_id,product_id)
       VALUES($1,$2)
       ON CONFLICT(client_id,product_id) DO NOTHING`,
      [current.client_id,product.id]
    );

    if (current.product_id !== product.id) {
      await client.query(
        `DELETE FROM client_products cp
         WHERE cp.client_id=$1
           AND cp.product_id=$2
           AND NOT EXISTS (
             SELECT 1
             FROM client_portfolios p
             WHERE p.client_id=$1
               AND p.product_id=$2
               AND p.active=TRUE
           )`,
        [current.client_id,current.product_id]
      );
    }

    if (current.analyst_id && current.analyst_id !== analystId) {
      await client.query(
        `DELETE FROM analyst_clients ac
         WHERE ac.client_id=$1
           AND ac.analyst_id=$2
           AND NOT EXISTS (
             SELECT 1
             FROM client_portfolios p
             WHERE p.client_id=$1
               AND p.analyst_id=$2
               AND p.active=TRUE
           )`,
        [current.client_id,current.analyst_id]
      );
    }

    await client.query(
      `INSERT INTO analyst_clients(analyst_id,client_id,is_primary)
       VALUES($1,$2,FALSE)
       ON CONFLICT(analyst_id,client_id) DO NOTHING`,
      [analystId,current.client_id]
    );

    const hasPrimary = (await client.query<{exists:boolean}>(
      "SELECT EXISTS(SELECT 1 FROM analyst_clients WHERE client_id=$1 AND is_primary=TRUE) AS exists",
      [current.client_id]
    )).rows[0]?.exists ?? false;
    if (!hasPrimary) {
      await client.query(
        "UPDATE analyst_clients SET is_primary=TRUE WHERE analyst_id=$1 AND client_id=$2",
        [analystId,current.client_id]
      );
    }

    await client.query(
      "INSERT INTO audit_logs(user_id,action,entity,entity_id,metadata) VALUES($1,'UPDATE_CLIENT_PORTFOLIO','client_portfolio',$2,$3::jsonb)",
      [actor.id,current.id,JSON.stringify({
        before:{
          clientName:current.client_name,
          productCode:current.product_code,
          analystId:current.analyst_id,
          commercialId:current.commercial_id,
        },
        after:{
          clientName,
          productCode,
          analystId,
          commercialId,
        },
      })]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  revalidatePath("/clients");
  revalidatePath("/analysts");
  revalidatePath("/checklist");
  revalidatePath("/incidents/new");
  revalidatePath("/");
  redirect(`/clients?updated=${encodeURIComponent(parsed.data.clientName)}`);
}

export async function deleteClientAction(formData: FormData) {
  const actor = await requireUser(["ADMIN"]);
  const clientId = text(formData, "client_id");

  const parsed = z.string().uuid().safeParse(clientId);
  if (!parsed.success) throw new Error("Cliente inválido para exclusão.");

  const client = await getPool().connect();
  let clientName = "";
  try {
    await client.query("BEGIN");

    const target = (await client.query<{ id:string; display_name:string; active:boolean }>(
      "SELECT id,display_name,active FROM clients WHERE id=$1 FOR UPDATE",
      [clientId]
    )).rows[0];

    if (!target) throw new Error("Cliente não encontrado.");
    clientName = target.display_name;

    await client.query(
      "UPDATE clients SET active=FALSE,updated_at=NOW() WHERE id=$1",
      [clientId]
    );
    await client.query(
      "UPDATE client_portfolios SET active=FALSE,updated_at=NOW() WHERE client_id=$1",
      [clientId]
    );
    await client.query(
      "DELETE FROM analyst_clients WHERE client_id=$1",
      [clientId]
    );

    await client.query(
      "INSERT INTO audit_logs(user_id,action,entity,entity_id,metadata) VALUES($1,'DELETE_CLIENT','client',$2,$3::jsonb)",
      [actor.id,clientId,JSON.stringify({clientName,mode:"soft_delete",historyPreserved:true})]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  revalidatePath("/clients");
  revalidatePath("/analysts");
  revalidatePath("/checklist");
  revalidatePath("/incidents/new");
  revalidatePath("/");
  redirect(`/clients?deleted=${encodeURIComponent(clientName)}`);
}

export async function bulkUpsertClientsAction(formData: FormData) {
  const user = await requireUser(["ADMIN"]);
  const raw = text(formData,"bulk_clients");
  if (!raw) throw new Error("Cole a lista de clientes antes de importar.");

  const lines = raw
    .replace(/\r/g,"")
    .split("\n")
    .map(line=>line.replace(/\u00a0/g," ").trim())
    .filter(Boolean);

  const rows = lines.map((line,index)=>{
    const separator = line.includes("\t") ? "\t" : line.includes(";") ? ";" : "|";
    const parts = line.split(separator).map(value=>value.trim());
    return {
      line:index+1,
      clientName:parts[0] || "",
      analystName:parts[1] || "",
      productCode:parts[2] || "",
      commercialName:parts[3] || "",
    };
  }).filter((row,index)=>{
    if (index!==0) return true;
    return normalizePortfolioValue(row.clientName) !== "cliente";
  });

  if (!rows.length) throw new Error("Nenhuma linha válida encontrada.");

  const client = await getPool().connect();
  const saved:Array<{clientId:string;productCode:string}> = [];
  try {
    await client.query("BEGIN");

    for (const row of rows) {
      try {
        const result = await upsertClientPortfolio(client,row);
        saved.push({clientId:result.clientId,productCode:result.productCode});
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Linha ${row.line}: ${message}`);
      }
    }

    await client.query(
      "INSERT INTO audit_logs(user_id,action,entity,metadata) VALUES($1,'BULK_UPSERT_CLIENT_PORTFOLIOS','client_portfolio',$2::jsonb)",
      [user.id,JSON.stringify({rows:saved.length,source:"clients_bulk_paste"})]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  revalidatePath("/clients");
  revalidatePath("/analysts");
  revalidatePath("/checklist");
  revalidatePath("/");
  redirect(`/clients?bulk_saved=${saved.length}`);
}

export async function createAnalystAction(formData: FormData) {
  const actor = await requireUser(["ADMIN"]);
  const schema = z.object({ name: z.string().min(2), email: z.string().email(), username: z.string().min(3), position: z.string().optional() });
  const parsed = schema.safeParse({ name: text(formData, "name"), email: text(formData, "email"), username: text(formData, "username"), position: text(formData, "position") });
  if (!parsed.success) throw new Error("Dados do analista inválidos.");

  const hash = await bcrypt.hash(analystInitialPassword(), 12);
  const result = await query<{ id: string }>(
    `INSERT INTO users(name,email,username,password_hash,role,position,must_change_password,tutorial_completed)
     VALUES($1,$2,$3,$4,'ANALYST',$5,TRUE,FALSE) RETURNING id`,
    [parsed.data.name, parsed.data.email, parsed.data.username, hash, nullable(parsed.data.position ?? "")]
  );
  await audit(actor.id, "CREATE_ANALYST", "user", result.rows[0].id, { username: parsed.data.username, firstLoginPasswordChange: true });
  revalidatePath("/analysts");
}

// Admin user profile management
export async function adminUpdateUserProfileAction(formData: FormData) {
  const actor = await requireUser(["ADMIN"]);
  const data = {
    userId: text(formData, "user_id"),
    name: text(formData, "name"),
    position: text(formData, "position"),
    email: text(formData, "email"),
    username: text(formData, "username"),
    role: text(formData, "role"),
    active: text(formData, "active"),
  };

  const parsed = z.object({
    userId: z.string().uuid(),
    name: z.string().min(2),
    position: z.string().max(120).optional(),
    email: z.string().email(),
    username: z.string().min(3).max(80),
    role: z.enum(["ADMIN","ANALYST","VIEWER"]),
    active: z.enum(["true","false"]),
  }).safeParse(data);

  if (!parsed.success) throw new Error("Dados do usuário inválidos.");

  const current = (await query<{
    id:string; name:string; email:string|null; username:string; role:string; position:string|null; active:boolean;
  }>(
    "SELECT id,name,email,username,role,position,active FROM users WHERE id=$1",
    [data.userId]
  )).rows[0];

  if (!current) throw new Error("Usuário não encontrado.");

  const duplicate = (await query<{ id:string }>(
    "SELECT id FROM users WHERE id<>$1 AND (LOWER(username)=LOWER($2) OR LOWER(email)=LOWER($3)) LIMIT 1",
    [data.userId, data.username, data.email]
  )).rows[0];
  if (duplicate) throw new Error("Já existe outro usuário com este login ou e-mail.");

  const nextActive = data.active === "true";
  const removingAdmin = current.role === "ADMIN" && (data.role !== "ADMIN" || !nextActive);
  if (removingAdmin) {
    const admins = (await query<{ total:string }>(
      "SELECT COUNT(*)::text total FROM users WHERE role='ADMIN' AND active=TRUE AND id<>$1",
      [data.userId]
    )).rows[0];
    if (Number(admins?.total ?? 0) === 0) {
      throw new Error("Não é possível rebaixar ou desativar o último administrador ativo.");
    }
  }

  await query(
    `UPDATE users
     SET name=$2,
         position=$3,
         email=$4,
         username=$5,
         role=$6,
         active=$7,
         updated_at=NOW()
     WHERE id=$1`,
    [data.userId, data.name, nullable(data.position), data.email, data.username, data.role, nextActive]
  );

  await audit(actor.id, "ADMIN_UPDATE_USER_PROFILE", "user", data.userId, {
    before: {
      name: current.name,
      position: current.position,
      email: current.email,
      username: current.username,
      role: current.role,
      active: current.active,
    },
    after: {
      name: data.name,
      position: nullable(data.position),
      email: data.email,
      username: data.username,
      role: data.role,
      active: nextActive,
    },
  });

  revalidatePath("/analysts");
  redirect(`/analysts?user_updated=${encodeURIComponent(data.username)}`);
}

export async function adminUpdateUserPasswordAction(formData: FormData) {
  const actor = await requireUser(["ADMIN"]);
  const userId = text(formData, "user_id");
  const newPassword = text(formData, "new_password");
  const confirmPassword = text(formData, "confirm_password");
  const forceChangeRequested = formData.get("force_change") === "on";

  const parsed = z.object({
    userId: z.string().uuid(),
    newPassword: z.string().min(8),
    confirmPassword: z.string().min(8),
  }).safeParse({ userId, newPassword, confirmPassword });

  if (!parsed.success) throw new Error("Informe uma senha com no mínimo 8 caracteres.");
  if (newPassword !== confirmPassword) throw new Error("A confirmação da senha não confere.");

  const target = (await query<{ id:string; name:string; username:string; role:string }>(
    "SELECT id,name,username,role FROM users WHERE id=$1 AND role IN ('ADMIN','ANALYST','VIEWER')",
    [userId]
  )).rows[0];
  if (!target) throw new Error("Usuário não encontrado.");

  const forceChange = target.role === "ANALYST" && forceChangeRequested;
  const hash = await bcrypt.hash(newPassword, 12);
  await query(
    "UPDATE users SET password_hash=$2, must_change_password=$3, updated_at=NOW() WHERE id=$1",
    [userId, hash, forceChange]
  );

  await audit(actor.id, "ADMIN_CHANGE_USER_PASSWORD", "user", userId, {
    targetUsername: target.username,
    targetRole: target.role,
    forceChange,
  });

  revalidatePath("/analysts");
  redirect(`/analysts?password_updated=${encodeURIComponent(target.username)}`);
}

export async function changeFirstPasswordAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "ANALYST" || !user.must_change_password) redirect("/");

  const newPassword = text(formData, "new_password");
  const confirmPassword = text(formData, "confirm_password");

  if (newPassword.length < 8) redirect("/change-password?error=length");
  if (newPassword !== confirmPassword) redirect("/change-password?error=match");
  if (newPassword === analystInitialPassword()) redirect("/change-password?error=default");

  const hash = await bcrypt.hash(newPassword, 12);
  await query(
    "UPDATE users SET password_hash=$2, must_change_password=FALSE, updated_at=NOW() WHERE id=$1",
    [user.id, hash]
  );
  await audit(user.id, "CHANGE_INITIAL_PASSWORD", "user", user.id);
  await createSession({ ...user, must_change_password: false });
  redirect(user.tutorial_completed ? "/" : "/guide");
}

export async function completeTutorialAction() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "ANALYST") redirect("/");

  await query(
    "UPDATE users SET tutorial_completed=TRUE, updated_at=NOW() WHERE id=$1",
    [user.id]
  );
  await audit(user.id, "COMPLETE_FIRST_ACCESS_TUTORIAL", "user", user.id);
  await createSession({ ...user, tutorial_completed: true });
  revalidatePath("/guide");
  redirect("/");
}

export async function uploadAnalystPhotoAction(formData: FormData) {
  const actor = await requireUser(["ADMIN"]);
  const analystId = text(formData, "analyst_id");
  const photo = formData.get("photo");

  if (!analystId) throw new Error("Analista não informado.");
  if (!(photo instanceof File) || photo.size === 0) throw new Error("Selecione uma foto.");

  const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!allowed.has(photo.type)) throw new Error("Formato inválido. Use JPG, PNG ou WEBP.");
  if (photo.size > 3 * 1024 * 1024) throw new Error("A foto deve ter no máximo 3 MB.");

  const bytes = Buffer.from(await photo.arrayBuffer());
  const updated = await query<{ id: string }>(
    `UPDATE users
     SET photo_data=$2, photo_mime=$3, photo_updated_at=NOW(), updated_at=NOW()
     WHERE id=$1 AND role IN ('ADMIN','ANALYST')
     RETURNING id`,
    [analystId, bytes, photo.type]
  );
  if (!updated.rowCount) throw new Error("Analista não encontrado.");
  await audit(actor.id, "UPDATE_ANALYST_PHOTO", "user", analystId, { mime: photo.type, size: photo.size });
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

export async function saveChecklistAction(formData: FormData) {
  const actor = await requireUser();
  const checklistDate = text(formData, "checklist_date");
  const requestedAnalystId = text(formData, "analyst_id");
  const clientId = text(formData, "client_id");
  const returnAction = text(formData, "return_action");

  const parsed = z.object({
    checklistDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    analystId: z.string().uuid(),
    clientId: z.string().uuid(),
  }).safeParse({
    checklistDate,
    analystId: requestedAnalystId,
    clientId,
  });

  if (!parsed.success) throw new Error("Analista, cliente ou data inválidos.");

  const analystId = requestedAnalystId;

  const target = (await query<{ id:string; active:boolean }>(
    "SELECT id, active FROM users WHERE id=$1 AND role='ANALYST'",
    [analystId]
  )).rows[0];
  if (!target?.active) throw new Error("Analista responsável não encontrado ou inativo.");

  const targetClient = (await query<{ id:string }>(
    "SELECT id FROM clients WHERE id=$1 AND active=TRUE",
    [clientId]
  )).rows[0];
  if (!targetClient) throw new Error("Cliente não encontrado ou inativo.");

  const visibleItems = CHECKLIST_ITEMS.filter(
    (item) => formData.get(`present_${item.key}`) === "1"
  );
  if (!visibleItems.length) throw new Error("Nenhuma validação foi enviada para atualização.");

  const statusSchema = z.enum(["EM_VALIDACAO","COM_ERRO","CONCLUIDO"]);
  const client = await getPool().connect();
  let checklistId = "";
  const changes: Array<{
    itemKey:string;
    fromStatus:string|null;
    toStatus:string;
    fromObservation:string|null;
    toObservation:string|null;
  }> = [];

  try {
    await client.query("BEGIN");

    const checklist = await client.query<{ id:string }>(
      `INSERT INTO daily_checklists(checklist_date, analyst_id, client_id, created_by)
       VALUES($1::date,$2,$3,$4)
       ON CONFLICT(checklist_date, analyst_id, client_id)
       DO UPDATE SET updated_at=NOW()
       RETURNING id`,
      [checklistDate, analystId, clientId, actor.id]
    );
    checklistId = checklist.rows[0].id;

    for (const item of visibleItems) {
      const rawStatus = text(formData, `status_${item.key}`) || "EM_VALIDACAO";
      const parsedStatus = statusSchema.safeParse(rawStatus);
      if (!parsedStatus.success) throw new Error(`Status inválido para ${item.action}.`);

      const status = parsedStatus.data;
      const observation = text(formData, `note_${item.key}`);
      const current = (await client.query<{status:string;observation:string|null}>(
        "SELECT status,observation FROM daily_checklist_items WHERE checklist_id=$1 AND item_key=$2",
        [checklistId,item.key]
      )).rows[0];

      await client.query(
        `INSERT INTO daily_checklist_items(
           checklist_id,item_key,status,completed,observation,completed_at,updated_by,updated_at
         )
         VALUES(
           $1::uuid,
           $2::varchar(80),
           $3::varchar(24),
           ($3::varchar(24)='CONCLUIDO'::varchar),
           $4::text,
           CASE WHEN $3::varchar(24)='CONCLUIDO'::varchar THEN NOW() ELSE NULL END,
           $5::uuid,
           NOW()
         )
         ON CONFLICT(checklist_id,item_key)
         DO UPDATE SET
           status=EXCLUDED.status,
           completed=(EXCLUDED.status='CONCLUIDO'::varchar),
           observation=EXCLUDED.observation,
           completed_at=CASE
             WHEN EXCLUDED.status='CONCLUIDO'::varchar AND daily_checklist_items.completed_at IS NULL THEN NOW()
             WHEN EXCLUDED.status='CONCLUIDO'::varchar THEN daily_checklist_items.completed_at
             ELSE NULL
           END,
           updated_by=EXCLUDED.updated_by,
           updated_at=NOW()`,
        [checklistId, item.key, status, nullable(observation), actor.id]
      );

      const beforeStatus = current?.status ?? null;
      const beforeObservation = current?.observation ?? null;
      const afterObservation = nullable(observation);
      if (beforeStatus !== status || beforeObservation !== afterObservation) {
        changes.push({
          itemKey:item.key,
          fromStatus:beforeStatus,
          toStatus:status,
          fromObservation:beforeObservation,
          toObservation:afterObservation,
        });
      }
    }

    const totals = (await client.query<{completed:number;validation:number;errors:number}>(
      `SELECT
         COUNT(*) FILTER (WHERE status='CONCLUIDO')::int completed,
         COUNT(*) FILTER (WHERE status='EM_VALIDACAO')::int validation,
         COUNT(*) FILTER (WHERE status='COM_ERRO')::int errors
       FROM daily_checklist_items
       WHERE checklist_id=$1`,
      [checklistId]
    )).rows[0];

    await client.query(
      "INSERT INTO audit_logs(user_id,action,entity,entity_id,metadata) VALUES($1,'SAVE_DAILY_CHECKLIST','daily_checklist',$2,$3::jsonb)",
      [actor.id, checklistId, JSON.stringify({
        analystId,
        clientId,
        checklistDate,
        performedByUserId: actor.id,
        performedByName: actor.name,
        updatedItems: visibleItems.map(item => item.key),
        completed: totals?.completed ?? 0,
        validation: totals?.validation ?? 0,
        errors: totals?.errors ?? 0,
        changes,
      })]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  revalidatePath("/checklist");
  revalidatePath("/");
  const actionParam = returnAction ? `&action=${encodeURIComponent(returnAction)}` : "";
  redirect(`/checklist?date=${encodeURIComponent(checklistDate)}&analyst=${encodeURIComponent(analystId)}&client=${encodeURIComponent(clientId)}${actionParam}&saved=1`);
}

export async function createIncidentAction(formData: FormData) {
  const user = await requireUser(["ADMIN", "ANALYST"]);
  const data = {
    clientId: text(formData, "client_id"), area: text(formData, "area"), title: text(formData, "title"), description: text(formData, "description"),
    products: formData.getAll("products").map(String), priority: text(formData, "priority"), status: text(formData, "status"),
    analyst: text(formData, "assigned_user_id"), hasTicket: formData.get("has_ticket") === "on", ticketId: text(formData, "ticket_id"),
    ticketUrl: text(formData, "ticket_url"), ticketOpenedAt: text(formData, "ticket_opened_at"), notes: text(formData, "internal_notes")
  };
  const parsed = z.object({ clientId:z.string().uuid(), area:z.string().min(1), title:z.string().min(3), description:z.string().min(3), products:z.array(z.string()).min(1), priority:z.string().min(1), status:z.string().min(1) }).safeParse(data);
  if (!parsed.success) throw new Error("Preencha os campos obrigatórios do incidente.");
  if (data.hasTicket && !data.ticketId) throw new Error("Informe o ID do chamado.");

  const client = await getPool().connect();
  let incidentId = "";
  try {
    await client.query("BEGIN");
    const inserted = await client.query<{ id: string }>(`
      INSERT INTO incidents(client_id,area_code,title,description,has_ticket,ticket_id,ticket_url,ticket_opened_at,priority_code,status_code,assigned_user_id,internal_notes,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id
    `, [data.clientId,data.area,data.title,data.description,data.hasTicket,nullable(data.ticketId),nullable(data.ticketUrl),nullable(data.ticketOpenedAt),data.priority,data.status,nullable(data.analyst),nullable(data.notes),user.id]);
    incidentId = inserted.rows[0].id;
    await client.query(`INSERT INTO incident_products(incident_id,product_id) SELECT $1::uuid,id FROM products WHERE code=ANY($2::text[])`, [incidentId,data.products]);
    await client.query(`INSERT INTO incident_updates(incident_id,user_id,update_type,new_value,comment) VALUES($1,$2,'INCIDENT_CREATED',$3,$4)`, [incidentId,user.id,data.status,"Registro criado no diário de bordo"]);
    await client.query(`INSERT INTO audit_logs(user_id,action,entity,entity_id,metadata) VALUES($1,'CREATE_INCIDENT','incident',$2,$3::jsonb)`, [user.id,incidentId,JSON.stringify({ clientId:data.clientId,area:data.area,products:data.products,status:data.status })]);
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
  revalidatePath("/"); revalidatePath("/incidents"); revalidatePath("/logbook"); revalidatePath("/history");
  redirect(`/incidents/${incidentId}`);
}

export async function updateIncidentAction(formData: FormData) {
  const user = await requireUser(["ADMIN", "ANALYST"]);
  const id = text(formData, "id");
  const current = (await query<{ status_code:string; assigned_user_id:string|null; priority_code:string; area_code:string|null }>("SELECT status_code,assigned_user_id,priority_code,area_code FROM incidents WHERE id=$1", [id])).rows[0];
  if (!current) throw new Error("Incidente não encontrado.");
  const status = text(formData,"status"), analyst = nullable(text(formData,"assigned_user_id")), priority = text(formData,"priority"), area = nullable(text(formData,"area"));
  await query(`UPDATE incidents SET title=$2,description=$3,priority_code=$4,status_code=$5,assigned_user_id=$6,internal_notes=$7,
      has_ticket=$8,ticket_id=$9,ticket_url=$10,ticket_opened_at=$11,area_code=$12,updated_at=NOW(),resolved_at=CASE WHEN $5 IN ('RESOLVIDO','ENCERRADO') THEN COALESCE(resolved_at,NOW()) ELSE NULL END
      WHERE id=$1`, [id,text(formData,"title"),text(formData,"description"),priority,status,analyst,nullable(text(formData,"internal_notes")),formData.get("has_ticket")==="on",nullable(text(formData,"ticket_id")),nullable(text(formData,"ticket_url")),nullable(text(formData,"ticket_opened_at")),area]);
  if (current.status_code !== status) await query("INSERT INTO incident_updates(incident_id,user_id,update_type,old_value,new_value) VALUES($1,$2,'STATUS_CHANGE',$3,$4)",[id,user.id,current.status_code,status]);
  if (current.assigned_user_id !== analyst) await query("INSERT INTO incident_updates(incident_id,user_id,update_type,old_value,new_value) VALUES($1,$2,'ASSIGN_ANALYST',$3,$4)",[id,user.id,current.assigned_user_id,analyst]);
  if (current.area_code !== area) await query("INSERT INTO incident_updates(incident_id,user_id,update_type,old_value,new_value) VALUES($1,$2,'AREA_CHANGE',$3,$4)",[id,user.id,current.area_code,area]);
  await audit(user.id,"UPDATE_INCIDENT","incident",id,{status,priority,analyst,area});
  revalidatePath(`/incidents/${id}`); revalidatePath("/incidents"); revalidatePath("/"); revalidatePath("/history");
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
  revalidatePath(`/incidents/${incidentId}`); revalidatePath("/responses"); revalidatePath("/"); revalidatePath("/history");
  redirect(`/incidents/${incidentId}`);
}
