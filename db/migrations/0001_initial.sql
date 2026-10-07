CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(160) NOT NULL,
  email VARCHAR(220) UNIQUE,
  username VARCHAR(80) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'ANALYST' CHECK (role IN ('ADMIN','ANALYST','VIEWER')),
  position VARCHAR(120),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(180) NOT NULL,
  display_name VARCHAR(180) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS clients_display_name_uq ON clients (LOWER(display_name));

CREATE TABLE IF NOT EXISTS client_products (
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (client_id, product_id)
);

CREATE TABLE IF NOT EXISTS analyst_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analyst_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (analyst_id, client_id)
);

CREATE TABLE IF NOT EXISTS incident_statuses (
  code VARCHAR(40) PRIMARY KEY,
  label VARCHAR(100) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_closed BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS priorities (
  code VARCHAR(20) PRIMARY KEY,
  label VARCHAR(60) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  title VARCHAR(240) NOT NULL,
  description TEXT NOT NULL,
  has_ticket BOOLEAN NOT NULL DEFAULT FALSE,
  ticket_id VARCHAR(120),
  ticket_url TEXT,
  ticket_opened_at TIMESTAMPTZ,
  priority_code VARCHAR(20) NOT NULL REFERENCES priorities(code),
  status_code VARCHAR(40) NOT NULL REFERENCES incident_statuses(code),
  assigned_user_id UUID REFERENCES users(id),
  internal_notes TEXT,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT incidents_ticket_consistency CHECK (
    (has_ticket = FALSE) OR (has_ticket = TRUE AND ticket_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS incident_products (
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  PRIMARY KEY (incident_id, product_id)
);

CREATE TABLE IF NOT EXISTS incident_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  update_type VARCHAR(60) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  ticket_id VARCHAR(120),
  response_text TEXT NOT NULL,
  root_cause TEXT,
  solution TEXT,
  required_action TEXT,
  responded_by VARCHAR(180),
  response_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status_after VARCHAR(40) REFERENCES incident_statuses(code),
  internal_note TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(80) NOT NULL,
  entity VARCHAR(80) NOT NULL,
  entity_id VARCHAR(120),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS incidents_created_at_idx ON incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS incidents_status_idx ON incidents(status_code);
CREATE INDEX IF NOT EXISTS incidents_client_idx ON incidents(client_id);
CREATE INDEX IF NOT EXISTS incidents_ticket_id_idx ON incidents(ticket_id);
CREATE INDEX IF NOT EXISTS incidents_assigned_user_idx ON incidents(assigned_user_id);
CREATE INDEX IF NOT EXISTS incidents_status_created_idx ON incidents(status_code, created_at DESC);
CREATE INDEX IF NOT EXISTS incident_products_product_idx ON incident_products(product_id, incident_id);
CREATE INDEX IF NOT EXISTS incident_updates_incident_created_idx ON incident_updates(incident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ticket_responses_incident_created_idx ON ticket_responses(incident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON audit_logs(entity, entity_id);
