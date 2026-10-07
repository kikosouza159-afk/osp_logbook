import { Pool, type QueryResultRow } from "pg";

const globalForDb = globalThis as unknown as { ospPool?: Pool };

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL não configurada.");
  return new Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000 });
}

export const db = globalForDb.ospPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.ospPool = db;

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
  return db.query<T>(text, params);
}
