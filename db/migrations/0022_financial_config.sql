ALTER TABLE public.osp_financial_billing_start
  ADD COLUMN IF NOT EXISTS poc_start date,
  ADD COLUMN IF NOT EXISTS poc_end date,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by text;
ALTER TABLE public.osp_financial_billing_start
  ADD CONSTRAINT osp_financial_billing_start_dates_check CHECK (
    (poc_start IS NULL OR poc_start <= start_date)
    AND (poc_end IS NULL OR poc_end <= start_date)
    AND (poc_start IS NULL OR poc_end IS NULL OR poc_start <= poc_end)
  );
