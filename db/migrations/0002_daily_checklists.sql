CREATE TABLE IF NOT EXISTS daily_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_date DATE NOT NULL,
  analyst_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (checklist_date, analyst_id, client_id)
);

CREATE TABLE IF NOT EXISTS daily_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES daily_checklists(id) ON DELETE CASCADE,
  item_key VARCHAR(80) NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  observation TEXT,
  completed_at TIMESTAMPTZ,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (checklist_id, item_key)
);

CREATE INDEX IF NOT EXISTS daily_checklists_date_idx
  ON daily_checklists(checklist_date DESC);

CREATE INDEX IF NOT EXISTS daily_checklists_analyst_client_idx
  ON daily_checklists(analyst_id, client_id, checklist_date DESC);

CREATE INDEX IF NOT EXISTS daily_checklist_items_checklist_idx
  ON daily_checklist_items(checklist_id);
