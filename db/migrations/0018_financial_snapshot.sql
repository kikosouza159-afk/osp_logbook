CREATE TABLE IF NOT EXISTS osp_financial_snapshot (
  id integer PRIMARY KEY CHECK (id = 1),
  records jsonb NOT NULL CHECK (jsonb_typeof(records) = 'array'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL
);
