ALTER TABLE daily_checklist_items
  ADD COLUMN IF NOT EXISTS status VARCHAR(24);

UPDATE daily_checklist_items
SET status = CASE
  WHEN completed = TRUE THEN 'CONCLUIDO'
  ELSE 'EM_VALIDACAO'
END
WHERE status IS NULL OR status = '';

ALTER TABLE daily_checklist_items
  ALTER COLUMN status SET DEFAULT 'EM_VALIDACAO';

ALTER TABLE daily_checklist_items
  ALTER COLUMN status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='daily_checklist_items_status_check'
  ) THEN
    ALTER TABLE daily_checklist_items
      ADD CONSTRAINT daily_checklist_items_status_check
      CHECK (status IN ('EM_VALIDACAO','COM_ERRO','CONCLUIDO'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS daily_checklist_items_status_idx
  ON daily_checklist_items(status);
