import { query } from "@/lib/db";

export async function audit(userId: string | null, action: string, entity: string, entityId?: string | null, metadata: Record<string, unknown> = {}) {
  await query(
    "INSERT INTO audit_logs(user_id, action, entity, entity_id, metadata) VALUES ($1,$2,$3,$4,$5::jsonb)",
    [userId, action, entity, entityId ?? null, JSON.stringify(metadata)]
  );
}
