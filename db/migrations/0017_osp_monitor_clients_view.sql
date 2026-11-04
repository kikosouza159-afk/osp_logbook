-- 0017_osp_monitor_clients_view.sql
-- Visão consolidada de clientes disponíveis no Alert Center.

CREATE OR REPLACE VIEW osp_monitor_clients AS
SELECT
  client_name,
  MIN(reference_date) AS first_reference_date,
  MAX(reference_date) AS last_reference_date,
  MAX(synced_at) AS last_sync
FROM (
  SELECT client_name, reference_date, synced_at
  FROM osp_monitor_tabulation
  WHERE client_name IS NOT NULL
    AND BTRIM(client_name) <> ''

  UNION ALL

  SELECT client_name, reference_date, synced_at
  FROM osp_monitor_pbx_return
  WHERE client_name IS NOT NULL
    AND BTRIM(client_name) <> ''
) x
GROUP BY client_name;
