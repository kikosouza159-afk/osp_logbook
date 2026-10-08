import pg from "pg";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const { Pool } = pg;

function normalizeDatabaseUrl(value, label) {
  const url = new URL(value);
  if (!url.username) throw new Error(`${label} sem usuário na connection string.`);
  if (!url.password) throw new Error(`${label} sem senha na connection string. Copie a URL completa do Neon.`);
  url.searchParams.set("sslmode", "verify-full");
  return url.toString();
}

function pickMigrationUrl() {
  const candidates = [
    ["DATABASE_URL_UNPOOLED", process.env.DATABASE_URL_UNPOOLED],
    ["DATABASE_URL", process.env.DATABASE_URL],
  ];

  const errors = [];
  for (const [label, value] of candidates) {
    if (!value) {
      errors.push(`${label} não configurada`);
      continue;
    }
    try {
      return { label, connectionString: normalizeDatabaseUrl(value, label) };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(`Nenhuma connection string válida. ${errors.join(" | ")}`);
}

const selected = pickMigrationUrl();
console.log(`Conexão de migration selecionada: ${selected.label}`);

const pool = new Pool({
  connectionString: selected.connectionString,
  max: 1,
});
const client = await pool.connect();

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const dir = path.join(process.cwd(), "db", "migrations");
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

  for (const filename of files) {
    const sql = await fs.readFile(path.join(dir, filename), "utf8");
    const checksum = crypto.createHash("sha256").update(sql).digest("hex");
    const existing = await client.query("SELECT checksum FROM schema_migrations WHERE filename = $1", [filename]);

    if (existing.rowCount) {
      if (existing.rows[0].checksum !== checksum) {
        throw new Error(`Migration ${filename} já aplicada foi alterada. Crie uma nova migration.`);
      }
      continue;
    }

    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations(filename, checksum) VALUES ($1, $2)", [filename, checksum]);
      await client.query("COMMIT");
      console.log(`Applied ${filename}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  client.release();
  await pool.end();
}
