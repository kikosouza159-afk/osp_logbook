import { Pool, type QueryResultRow } from "pg";

const globalForDb = globalThis as unknown as { ospPool?: Pool };

function normalizeDatabaseUrl(value: string, label: string) {
  const url = new URL(value);
  if (!url.username) throw new Error(`${label} sem usuário na connection string.`);
  if (!url.password) throw new Error(`${label} sem senha na connection string. Copie a URL completa do Neon.`);
  url.searchParams.set("sslmode", "verify-full");
  return url.toString();
}

export function getPool() {
  if (globalForDb.ospPool) return globalForDb.ospPool;

  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL não configurada.");

  const pool = new Pool({
    connectionString: normalizeDatabaseUrl(raw, "DATABASE_URL"),
    max: 10,
    idleTimeoutMillis: 30_000,
  });

  if (process.env.NODE_ENV !== "production") globalForDb.ospPool = pool;
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
  return getPool().query<T>(text, params);
}
