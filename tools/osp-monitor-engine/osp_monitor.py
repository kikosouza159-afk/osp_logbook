from __future__ import annotations

import json
import logging
import os
import socket
import sys
import time
import uuid
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import pyodbc
import psycopg
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
ENV_FILE = BASE_DIR / ".env"
STATUS_FILE = BASE_DIR / ".status.json"
LOG_DIR = BASE_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

load_dotenv(ENV_FILE)

LOG_FILE = LOG_DIR / f"osp_monitor_{datetime.now():%Y_%m_%d}.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger("osp-monitor")

TABULATION_SELECT = """
SELECT
    CAST(IP_Servidor AS varchar(100)) AS IP_Servidor,
    CAST(Nome_Servidor AS varchar(150)) AS Nome_Servidor,
    CAST(Data AS date) AS Data,
    CAST(Hora AS int) AS Hora,
    CAST(CampaignId AS int) AS CampaignId,
    CAST(NomeCampanha AS varchar(255)) AS NomeCampanha,
    CAST(Route AS varchar(255)) AS Route,
    CAST(DispositionId AS int) AS DispositionId,
    CAST(Tabulacao AS varchar(500)) AS Tabulacao,
    CAST(Fx_Segundos AS varchar(150)) AS Fx_Segundos,
    CAST(Quantidade AS bigint) AS Quantidade,
    CAST(Segundos AS bigint) AS Segundos
FROM {table} WITH (NOLOCK)
WHERE Data = CAST(GETDATE() AS date);
"""

PBX_SELECT = """
SELECT
    CAST(IP_Servidor AS varchar(100)) AS IP_Servidor,
    CAST(Nome_Servidor AS varchar(150)) AS Nome_Servidor,
    CAST(Data AS date) AS Data,
    CAST(Hora AS int) AS Hora,
    CAST(CampaignId AS int) AS CampaignId,
    CAST(NomeCampanha AS varchar(255)) AS NomeCampanha,
    CAST(PbxDispositionId AS int) AS PbxDispositionId,
    CAST(Retorno AS varchar(500)) AS Retorno,
    CAST(Quantidade AS bigint) AS Quantidade
FROM {table} WITH (NOLOCK)
WHERE Data = CAST(GETDATE() AS date);
"""

def required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Variavel obrigatoria nao configurada: {name}")
    return value

def env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    return raw.strip().lower() in {"1", "true", "yes", "sim", "on"}

def safe_source_table(value: str, label: str) -> str:
    parts = value.split(".")
    if len(parts) != 3:
        raise RuntimeError(f"{label} deve estar no formato Banco.Schema.Tabela")
    for part in parts:
        if not part or not part.replace("_", "").isalnum():
            raise RuntimeError(f"{label} possui identificador invalido: {value}")
    return ".".join(f"[{part}]" for part in parts)

def sqlserver_connection_string() -> str:
    host = required("SQLSERVER_HOST")
    port = os.getenv("SQLSERVER_PORT", "").strip()
    server = f"{host},{port}" if port else host
    driver = os.getenv("SQLSERVER_DRIVER", "ODBC Driver 17 for SQL Server").strip()
    database = os.getenv("SQLSERVER_DATABASE", "ProfessionalServices02").strip()
    encrypt = "yes" if env_bool("SQLSERVER_ENCRYPT", False) else "no"
    trust_cert = "yes" if env_bool("SQLSERVER_TRUST_CERT", True) else "no"
    auth = os.getenv("SQLSERVER_AUTH", "sql").strip().lower()

    parts = [
        f"DRIVER={{{driver}}}",
        f"SERVER={server}",
        f"DATABASE={database}",
        f"Encrypt={encrypt}",
        f"TrustServerCertificate={trust_cert}",
    ]
    if auth == "trusted":
        parts.append("Trusted_Connection=yes")
    elif auth == "sql":
        parts.extend([
            f"UID={required('SQLSERVER_USER')}",
            f"PWD={required('SQLSERVER_PASSWORD')}",
        ])
    else:
        raise RuntimeError("SQLSERVER_AUTH deve ser 'sql' ou 'trusted'.")
    return ";".join(parts) + ";"

def connect_sqlserver() -> pyodbc.Connection:
    return pyodbc.connect(
        sqlserver_connection_string(),
        timeout=int(os.getenv("SQLSERVER_CONNECTION_TIMEOUT", "20")),
        autocommit=True,
    )

def connect_neon() -> psycopg.Connection:
    return psycopg.connect(
        required("NEON_DATABASE_URL"),
        autocommit=True,
        application_name="osp-monitor-engine",
    )

def sql_today(conn: pyodbc.Connection) -> date:
    cursor = conn.cursor()
    cursor.timeout = int(os.getenv("SQLSERVER_QUERY_TIMEOUT", "180"))
    row = cursor.execute("SELECT CAST(GETDATE() AS date)").fetchone()
    if not row:
        raise RuntimeError("Nao foi possivel obter a data atual do SQL Server.")
    return row[0]

def fetch_rows(conn: pyodbc.Connection, sql_text: str) -> list[tuple[Any, ...]]:
    cursor = conn.cursor()
    cursor.timeout = int(os.getenv("SQLSERVER_QUERY_TIMEOUT", "180"))
    cursor.execute(sql_text)
    return [tuple(row) for row in cursor.fetchall()]

def write_status(payload: dict[str, Any]) -> None:
    STATUS_FILE.write_text(
        json.dumps(
            {"updated_at": datetime.now(timezone.utc).isoformat(), **payload},
            ensure_ascii=False,
            indent=2,
            default=str,
        ),
        encoding="utf-8",
    )

def create_run(pg: psycopg.Connection, run_id: uuid.UUID, source_date: date) -> None:
    with pg.cursor() as cur:
        cur.execute(
            """
            INSERT INTO osp_monitor_etl_control(
              run_id,source_date,status,source_server,etl_host,metadata
            )
            VALUES(%s,%s,'RUNNING',%s,%s,%s::jsonb)
            """,
            (
                run_id,
                source_date,
                os.getenv("SQLSERVER_HOST"),
                socket.gethostname(),
                json.dumps({
                    "strategy": "delete_today_and_replace",
                    "interval_minutes": 15,
                    "tabulation_source": os.getenv("TABULATION_SOURCE_TABLE"),
                    "pbx_source": os.getenv("PBX_SOURCE_TABLE"),
                }),
            ),
        )

def update_source_counts(pg, run_id, tabulation_rows, pbx_rows) -> None:
    with pg.cursor() as cur:
        cur.execute(
            """
            UPDATE osp_monitor_etl_control
            SET rows_tabulation=%s, rows_pbx_return=%s
            WHERE run_id=%s
            """,
            (tabulation_rows, pbx_rows, run_id),
        )

def finish_run(
    pg,
    run_id,
    status,
    started,
    deleted_tabulation=0,
    deleted_pbx=0,
    inserted_tabulation=0,
    inserted_pbx=0,
    error_message=None,
) -> None:
    with pg.cursor() as cur:
        cur.execute(
            """
            UPDATE osp_monitor_etl_control
            SET status=%s,
                finished_at=NOW(),
                deleted_tabulation=%s,
                deleted_pbx_return=%s,
                inserted_tabulation=%s,
                inserted_pbx_return=%s,
                duration_ms=%s,
                error_message=%s
            WHERE run_id=%s
            """,
            (
                status,
                deleted_tabulation,
                deleted_pbx,
                inserted_tabulation,
                inserted_pbx,
                int((time.monotonic() - started) * 1000),
                error_message,
                run_id,
            ),
        )

def chunks(rows: list[tuple[Any, ...]], size: int) -> Iterable[list[tuple[Any, ...]]]:
    for index in range(0, len(rows), size):
        yield rows[index:index + size]

def validate_sources(source_date, tabulation_rows, pbx_rows) -> None:
    if not env_bool("ALLOW_EMPTY_SOURCE", False):
        missing = []
        if not tabulation_rows:
            missing.append("OSP_Alerta_Painel")
        if not pbx_rows:
            missing.append("Osp_Alerta_Retorno_Painel")
        if missing:
            raise RuntimeError(
                "Carga cancelada por seguranca. Fonte(s) sem registros para "
                f"{source_date}: {', '.join(missing)}. O Neon foi preservado."
            )

    for label, rows in [("Tabulacao", tabulation_rows), ("Retorno PBX", pbx_rows)]:
        if any(row[2] != source_date for row in rows):
            raise RuntimeError(f"{label}: origem retornou registros fora da data {source_date}.")

def replace_today(pg, source_date, tabulation_rows, pbx_rows):
    batch_size = max(100, min(int(os.getenv("INSERT_BATCH_SIZE", "1000")), 5000))

    insert_tabulation = """
      INSERT INTO osp_monitor_tabulation(
        server_ip,server_name,reference_date,reference_hour,
        campaign_id,campaign_name,route,disposition_id,
        tabulation,seconds_bucket,quantity,seconds,synced_at
      )
      VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW())
    """

    insert_pbx = """
      INSERT INTO osp_monitor_pbx_return(
        server_ip,server_name,reference_date,reference_hour,
        campaign_id,campaign_name,pbx_disposition_id,
        return_description,quantity,synced_at
      )
      VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW())
    """

    with pg.transaction():
        with pg.cursor() as cur:
            cur.execute(
                "DELETE FROM osp_monitor_tabulation WHERE reference_date=%s",
                (source_date,),
            )
            deleted_tabulation = cur.rowcount

            cur.execute(
                "DELETE FROM osp_monitor_pbx_return WHERE reference_date=%s",
                (source_date,),
            )
            deleted_pbx = cur.rowcount

            for batch in chunks(tabulation_rows, batch_size):
                cur.executemany(insert_tabulation, batch)

            for batch in chunks(pbx_rows, batch_size):
                cur.executemany(insert_pbx, batch)

    return deleted_tabulation, deleted_pbx, len(tabulation_rows), len(pbx_rows)

def main() -> int:
    started = time.monotonic()
    run_id = uuid.uuid4()
    sql_conn = None
    pg_conn = None
    source_date = None

    try:
        log.info("OSP Monitor Engine iniciado. RunId=%s", run_id)

        tabulation_table = safe_source_table(
            os.getenv(
                "TABULATION_SOURCE_TABLE",
                "ProfessionalServices02.dbo.OSP_Alerta_Painel",
            ),
            "TABULATION_SOURCE_TABLE",
        )
        pbx_table = safe_source_table(
            os.getenv(
                "PBX_SOURCE_TABLE",
                "ProfessionalServices02.dbo.Osp_Alerta_Retorno_Painel",
            ),
            "PBX_SOURCE_TABLE",
        )

        sql_conn = connect_sqlserver()
        source_date = sql_today(sql_conn)

        pg_conn = connect_neon()
        create_run(pg_conn, run_id, source_date)

        tabulation_rows = fetch_rows(
            sql_conn,
            TABULATION_SELECT.format(table=tabulation_table),
        )
        pbx_rows = fetch_rows(
            sql_conn,
            PBX_SELECT.format(table=pbx_table),
        )

        update_source_counts(pg_conn, run_id, len(tabulation_rows), len(pbx_rows))
        validate_sources(source_date, tabulation_rows, pbx_rows)

        deleted_tabulation, deleted_pbx, inserted_tabulation, inserted_pbx = replace_today(
            pg_conn, source_date, tabulation_rows, pbx_rows
        )

        finish_run(
            pg_conn,
            run_id,
            "SUCCESS",
            started,
            deleted_tabulation,
            deleted_pbx,
            inserted_tabulation,
            inserted_pbx,
        )

        write_status({
            "status": "SUCCESS",
            "run_id": str(run_id),
            "source_date": source_date,
            "tabulation_rows": inserted_tabulation,
            "pbx_rows": inserted_pbx,
            "duration_ms": int((time.monotonic() - started) * 1000),
        })

        log.info(
            "Carga concluida. DELETE/INSERT Tabulacao=%s/%s | PBX=%s/%s",
            deleted_tabulation,
            inserted_tabulation,
            deleted_pbx,
            inserted_pbx,
        )
        return 0

    except Exception as exc:
        message = str(exc)
        log.exception("Falha no OSP Monitor Engine: %s", message)

        if pg_conn is not None and source_date is not None:
            try:
                finish_run(
                    pg_conn,
                    run_id,
                    "ERROR",
                    started,
                    error_message=message[:4000],
                )
            except Exception:
                log.exception("Nao foi possivel registrar a falha no Neon.")

        write_status({
            "status": "ERROR",
            "run_id": str(run_id),
            "source_date": source_date,
            "error": message,
            "duration_ms": int((time.monotonic() - started) * 1000),
        })
        return 1

    finally:
        if sql_conn is not None:
            try:
                sql_conn.close()
            except Exception:
                pass
        if pg_conn is not None:
            try:
                pg_conn.close()
            except Exception:
                pass

if __name__ == "__main__":
    raise SystemExit(main())
