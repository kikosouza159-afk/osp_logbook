CREATE INDEX IF NOT EXISTS ticket_responses_response_date_idx
  ON ticket_responses(response_date DESC);

CREATE INDEX IF NOT EXISTS analyst_clients_client_primary_idx
  ON analyst_clients(client_id, is_primary);

CREATE INDEX IF NOT EXISTS users_active_role_name_idx
  ON users(active, role, name);

CREATE INDEX IF NOT EXISTS incidents_created_client_idx
  ON incidents(created_at DESC, client_id);
