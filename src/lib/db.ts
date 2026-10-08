import { Pool, type QueryResultRow } from "pg";

const globalForDb = globalThis as unknown as { ospPool?: Pool };

function secureConnectionString(value: string) {
  const url = new URL(value);
  url.searchParams.set("sslmode", "require");
  return url.toString();
}

export function getPool() {
  if (globalForDb.ospPool) return globalForDb.ospPool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL não configurada.");

  const pool = new Pool({
    connectionString: secureConnectionString(connectionString),
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30_000,
  });

  if (process.env.NODE_ENV !== "production") globalForDb.ospPool = pool;
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
  return getPool().query<T>(text, params);
}
