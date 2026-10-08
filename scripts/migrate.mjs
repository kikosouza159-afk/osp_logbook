import pg from "pg";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const { Pool } = pg;
const rawConnectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!rawConnectionString) throw new Error("DATABASE_URL_UNPOOLED ou DATABASE_URL não configurada.");

const url = new URL(rawConnectionString);
url.searchParams.set("sslmode", "require");
const connectionString = url.toString();

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
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
