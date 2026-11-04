-- 0016_osp_monitor_pbx_signaling_extra_info.sql
-- Persiste SignalingExtraInfo do retorno PBX.

ALTER TABLE osp_monitor_pbx_return
  ADD COLUMN IF NOT EXISTS signaling_extra_info TEXT;

CREATE INDEX IF NOT EXISTS ix_osp_monitor_pbx_signaling
  ON osp_monitor_pbx_return(
    reference_date,
    client_name,
    product_code,
    campaign_id,
    return_description,
    signaling_extra_info,
    reference_hour
  );
