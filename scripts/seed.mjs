import pg from "pg";
import bcrypt from "bcryptjs";

const { Pool } = pg;
const rawConnectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!rawConnectionString) throw new Error("DATABASE_URL_UNPOOLED ou DATABASE_URL não configurada.");

const url = new URL(rawConnectionString);
url.searchParams.set("sslmode", "require");
const connectionString = url.toString();

const password = process.env.ADMIN_INITIAL_PASSWORD || "admin123";
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 1,
});

try {
  await pool.query(`
    INSERT INTO products(code, name, description)
    VALUES
      ('LOCATOR', 'Locator', 'Produto de localização e estratégia operacional'),
      ('ADA', 'ADA', 'Assistente digital automatizada')
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, active = TRUE
  `);

  await pool.query(`
    INSERT INTO incident_statuses(code, label, sort_order, is_closed)
    VALUES
      ('NOVO', 'Novo', 10, FALSE),
      ('EM_ANALISE', 'Em análise', 20, FALSE),
      ('EM_TRATATIVA', 'Em tratativa', 30, FALSE),
      ('AGUARDANDO_RETORNO', 'Aguardando retorno', 40, FALSE),
      ('AGUARDANDO_CLIENTE', 'Aguardando cliente', 50, FALSE),
      ('AGUARDANDO_SUSTENTACAO', 'Aguardando sustentação', 60, FALSE),
      ('RESOLVIDO', 'Resolvido', 90, TRUE),
      ('ENCERRADO', 'Encerrado', 100, TRUE)
    ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order, is_closed = EXCLUDED.is_closed, active = TRUE
  `);

  await pool.query(`
    INSERT INTO priorities(code, label, sort_order)
    VALUES
      ('BAIXA', 'Baixa', 10),
      ('MEDIA', 'Média', 20),
      ('ALTA', 'Alta', 30),
      ('CRITICA', 'Crítica', 40)
    ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order, active = TRUE
  `);

  const existing = await pool.query("SELECT id FROM users WHERE username = 'admin'");
  if (!existing.rowCount) {
    const hash = await bcrypt.hash(password, 12);
    await pool.query(
      `INSERT INTO users(name, email, username, password_hash, role, position, active, must_change_password)
       VALUES ($1, $2, $3, $4, 'ADMIN', $5, TRUE, TRUE)`,
      ["Administrador OSP", "admin@osp.local", "admin", hash, "Administrador"]
    );
    console.log("Usuário admin criado.");
  }
} finally {
  await pool.end();
}
