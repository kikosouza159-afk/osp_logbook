from __future__ import annotations

import json
import logging
import os
import socket
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable
from zoneinfo import ZoneInfo

import pyodbc
import psycopg
from dotenv import load_dotenv

from servers import (
    resolve_source,
    unique_connections,
    validate_source_config,
)

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
    CAST(Segundos AS bigint) AS Segundos,
    {productivity_expr} AS Produtividade
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
    {signaling_expr} AS SignalingExtraInfo,
    CAST(Quantidade AS bigint) AS Quantidade
FROM {table} WITH (NOLOCK)
WHERE Data = CAST(GETDATE() AS date);
"""


def required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(
            f"Variavel obrigatoria nao configurada: {name}"
        )
    return value


def env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default

    return raw.strip().lower() in {
        "1", "true", "yes", "sim", "on"
    }


def safe_source_table(
    value: str,
    label: str,
) -> str:
    parts = value.split(".")

    if len(parts) == 1:
        schema = "dbo"
        table = parts[0]
    elif len(parts) == 2:
        schema, table = parts
    else:
        raise RuntimeError(
            f"{label} deve estar no formato Schema.Tabela."
        )

    for part in (schema, table):
        if not part or not part.replace("_", "").isalnum():
            raise RuntimeError(
                f"{label} possui identificador invalido: {value}"
            )

    return f"[{schema}].[{table}]"


def sao_paulo_today():
    return datetime.now(
        ZoneInfo("America/Sao_Paulo")
    ).date()


def sqlserver_connection_string(
    host: str,
    database: str,
) -> str:
    port = os.getenv("SQLSERVER_PORT", "").strip()
    server = f"{host},{port}" if port else host

    driver = os.getenv(
        "SQLSERVER_DRIVER",
        "ODBC Driver 17 for SQL Server",
    ).strip()

    encrypt = (
        "yes"
        if env_bool("SQLSERVER_ENCRYPT", False)
        else "no"
    )
    trust_cert = (
        "yes"
        if env_bool("SQLSERVER_TRUST_CERT", True)
        else "no"
    )

    auth = os.getenv(
        "SQLSERVER_AUTH",
        "sql",
    ).strip().lower()

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
        raise RuntimeError(
            "SQLSERVER_AUTH deve ser 'sql' ou 'trusted'."
        )

    return ";".join(parts) + ";"


def connect_sqlserver(
    host: str,
    database: str,
) -> pyodbc.Connection:
    return pyodbc.connect(
        sqlserver_connection_string(
            host,
            database,
        ),
        timeout=int(
            os.getenv(
                "SQLSERVER_CONNECTION_TIMEOUT",
                "20",
            )
        ),
        autocommit=True,
    )


def connect_neon() -> psycopg.Connection:
    return psycopg.connect(
        required("NEON_DATABASE_URL"),
        autocommit=True,
        application_name="osp-monitor-engine",
    )


def sql_today(conn: pyodbc.Connection):
    cursor = conn.cursor()
    row = cursor.execute(
        "SELECT CAST(GETDATE() AS date)"
    ).fetchone()

    if not row:
        raise RuntimeError(
            "Nao foi possivel obter a data atual "
            "do SQL Server."
        )

    return row[0]


def source_column_exists(
    conn: pyodbc.Connection,
    table_name: str,
    column_name: str,
) -> bool:
    object_name = (
        table_name
        .replace("[", "")
        .replace("]", "")
    )

    row = conn.cursor().execute(
        """
        SELECT CASE
          WHEN COL_LENGTH(?, ?) IS NULL THEN 0
          ELSE 1
        END
        """,
        object_name,
        column_name,
    ).fetchone()

    return bool(row and int(row[0]) == 1)


def fetch_rows(
    conn: pyodbc.Connection,
    sql_text: str,
) -> list[tuple[Any, ...]]:
    cursor = conn.cursor()
    cursor.execute(sql_text)
    return [tuple(row) for row in cursor.fetchall()]


def write_status(payload: dict[str, Any]) -> None:
    STATUS_FILE.write_text(
        json.dumps(
            {
                "updated_at": datetime.now(
                    timezone.utc
                ).isoformat(),
                **payload,
            },
            ensure_ascii=False,
            indent=2,
            default=str,
        ),
        encoding="utf-8",
    )


def create_run(
    pg: psycopg.Connection,
    run_id: uuid.UUID,
    source_date,
    connections: list[tuple[str, str]],
) -> None:
    metadata = {
        "strategy": (
            "multi_server_database_"
            "delete_today_and_replace"
        ),
        "interval_minutes": 15,
        "connections": [
            {
                "host": host,
                "database": database,
            }
            for host, database in connections
        ],
        "connection_count": len(connections),
        "tabulation_source": os.getenv(
            "TABULATION_SOURCE_TABLE"
        ),
        "pbx_source": os.getenv(
            "PBX_SOURCE_TABLE"
        ),
    }

    with pg.cursor() as cur:
        cur.execute(
            """
            INSERT INTO osp_monitor_etl_control(
              run_id,
              source_date,
              status,
              source_server,
              etl_host,
              metadata
            )
            VALUES(
              %s,
              %s,
              'RUNNING',
              %s,
              %s,
              %s::jsonb
            )
            """,
            (
                run_id,
                source_date,
                f"MULTI_SOURCE:{len(connections)}",
                socket.gethostname(),
                json.dumps(
                    metadata,
                    ensure_ascii=False,
                ),
            ),
        )


def update_source_counts(
    pg,
    run_id,
    tabulation_rows,
    pbx_rows,
    source_results,
) -> None:
    with pg.cursor() as cur:
        cur.execute(
            """
            UPDATE osp_monitor_etl_control
            SET rows_tabulation=%s,
                rows_pbx_return=%s,
                metadata=metadata || %s::jsonb
            WHERE run_id=%s
            """,
            (
                tabulation_rows,
                pbx_rows,
                json.dumps(
                    {
                        "source_results":
                            source_results
                    },
                    ensure_ascii=False,
                    default=str,
                ),
                run_id,
            ),
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
                int(
                    (
                        time.monotonic()
                        - started
                    ) * 1000
                ),
                error_message,
                run_id,
            ),
        )


def chunks(
    rows: list[tuple[Any, ...]],
    size: int,
) -> Iterable[list[tuple[Any, ...]]]:
    for index in range(0, len(rows), size):
        yield rows[index:index + size]


def ensure_rows(
    host: str,
    database: str,
    source_date,
    label: str,
    rows: list[tuple[Any, ...]],
) -> None:
    if (
        not rows
        and not env_bool(
            "ALLOW_EMPTY_SOURCE",
            False,
        )
    ):
        raise RuntimeError(
            f"{host} / {database}: {label} "
            f"retornou zero registros para "
            f"{source_date}. "
            "Carga cancelada; Neon preservado."
        )

    if any(
        row[2] != source_date
        for row in rows
    ):
        raise RuntimeError(
            f"{host} / {database}: {label} "
            f"retornou registros fora da data "
            f"{source_date}."
        )


def classify_tabulation_rows(
    host: str,
    database: str,
    rows: list[tuple[Any, ...]],
) -> list[tuple[Any, ...]]:
    result: list[tuple[Any, ...]] = []

    for row in rows:
        campaign_id = int(row[4])
        campaign_name = row[5]

        source = resolve_source(
            host,
            database,
            campaign_id,
            campaign_name,
        )

        result.append((
            host,
            row[1],
            database,
            source["client"],
            source["product"],
            row[2],
            row[3],
            row[4],
            row[5],
            row[6],
            row[7],
            row[8],
            row[9],
            row[10],
            row[11],
            row[12],
        ))

    return result


def classify_pbx_rows(
    host: str,
    database: str,
    rows: list[tuple[Any, ...]],
) -> list[tuple[Any, ...]]:
    result: list[tuple[Any, ...]] = []

    for row in rows:
        campaign_id = int(row[4])
        campaign_name = row[5]

        source = resolve_source(
            host,
            database,
            campaign_id,
            campaign_name,
        )

        result.append((
            host,
            row[1],
            database,
            source["client"],
            source["product"],
            row[2],
            row[3],
            row[4],
            row[5],
            row[6],
            row[7],
            row[8],
            row[9],
        ))

    return result


def extract_all_sources(
    source_date,
    tabulation_table: str,
    pbx_table: str,
    connections: list[tuple[str, str]],
):
    all_tabulation: list[tuple[Any, ...]] = []
    all_pbx: list[tuple[Any, ...]] = []
    source_results: list[dict[str, Any]] = []

    total = len(connections)

    for index, (
        host,
        database,
    ) in enumerate(
        connections,
        start=1,
    ):
        conn = None
        started = time.monotonic()

        try:
            log.info(
                "[%s/%s] Conectando %s / %s...",
                index,
                total,
                host,
                database,
            )

            conn = connect_sqlserver(
                host,
                database,
            )

            remote_date = sql_today(conn)

            if remote_date != source_date:
                raise RuntimeError(
                    f"{host} / {database}: "
                    f"data SQL Server={remote_date}, "
                    f"esperada={source_date}."
                )

            has_productivity = source_column_exists(
                conn,
                tabulation_table,
                "Produtividade",
            )

            productivity_expr = (
                "CAST(Produtividade AS varchar(20))"
                if has_productivity
                else "CAST(NULL AS varchar(20))"
            )

            tabulation_source = fetch_rows(
                conn,
                TABULATION_SELECT.format(
                    table=tabulation_table,
                    productivity_expr=productivity_expr,
                ),
            )

            has_signaling_extra_info = source_column_exists(
                conn,
                pbx_table,
                "SignalingExtraInfo",
            )

            signaling_expr = (
                "CAST(SignalingExtraInfo AS varchar(100))"
                if has_signaling_extra_info
                else "CAST(NULL AS varchar(100))"
            )

            pbx_source = fetch_rows(
                conn,
                PBX_SELECT.format(
                    table=pbx_table,
                    signaling_expr=signaling_expr,
                ),
            )

            ensure_rows(
                host,
                database,
                source_date,
                "OSP_Alerta_Painel",
                tabulation_source,
            )

            ensure_rows(
                host,
                database,
                source_date,
                "Osp_Alerta_Retorno_Painel",
                pbx_source,
            )

            tabulation_rows = (
                classify_tabulation_rows(
                    host,
                    database,
                    tabulation_source,
                )
            )

            pbx_rows = classify_pbx_rows(
                host,
                database,
                pbx_source,
            )

            all_tabulation.extend(
                tabulation_rows
            )
            all_pbx.extend(pbx_rows)

            source_results.append({
                "host": host,
                "database": database,
                "status": "SUCCESS",
                "tabulation_rows": len(
                    tabulation_rows
                ),
                "pbx_rows": len(pbx_rows),
                "productivity_dimension": has_productivity,
                "signaling_extra_info_dimension":
                    has_signaling_extra_info,
                "duration_ms": int(
                    (
                        time.monotonic()
                        - started
                    ) * 1000
                ),
            })

            log.info(
                "[%s/%s] %s / %s OK | "
                "Tabulacao=%s | PBX=%s",
                index,
                total,
                host,
                database,
                len(tabulation_rows),
                len(pbx_rows),
            )

        except Exception as exc:
            source_results.append({
                "host": host,
                "database": database,
                "status": "ERROR",
                "error": str(exc),
                "duration_ms": int(
                    (
                        time.monotonic()
                        - started
                    ) * 1000
                ),
            })
            raise

        finally:
            if conn is not None:
                try:
                    conn.close()
                except Exception:
                    pass

    return (
        all_tabulation,
        all_pbx,
        source_results,
    )


def replace_today(
    pg,
    source_date,
    tabulation_rows,
    pbx_rows,
):
    batch_size = max(
        100,
        min(
            int(
                os.getenv(
                    "INSERT_BATCH_SIZE",
                    "1000",
                )
            ),
            5000,
        ),
    )

    insert_tabulation = """
      INSERT INTO osp_monitor_tabulation(
        server_ip,
        server_name,
        source_database,
        client_name,
        product_code,
        reference_date,
        reference_hour,
        campaign_id,
        campaign_name,
        route,
        disposition_id,
        tabulation,
        seconds_bucket,
        quantity,
        seconds,
        productivity_class,
        synced_at
      )
      VALUES(
        %s,%s,%s,%s,%s,
        %s,%s,%s,%s,%s,
        %s,%s,%s,%s,%s,
        %s,
        NOW()
      )
    """

    insert_pbx = """
      INSERT INTO osp_monitor_pbx_return(
        server_ip,
        server_name,
        source_database,
        client_name,
        product_code,
        reference_date,
        reference_hour,
        campaign_id,
        campaign_name,
        pbx_disposition_id,
        return_description,
        signaling_extra_info,
        quantity,
        synced_at
      )
      VALUES(
        %s,%s,%s,%s,%s,
        %s,%s,%s,%s,%s,
        %s,%s,%s,
        NOW()
      )
    """

    with pg.transaction():
        with pg.cursor() as cur:
            cur.execute(
                """
                DELETE FROM osp_monitor_tabulation
                WHERE reference_date=%s
                """,
                (source_date,),
            )
            deleted_tabulation = cur.rowcount

            cur.execute(
                """
                DELETE FROM osp_monitor_pbx_return
                WHERE reference_date=%s
                """,
                (source_date,),
            )
            deleted_pbx = cur.rowcount

            for batch in chunks(
                tabulation_rows,
                batch_size,
            ):
                cur.executemany(
                    insert_tabulation,
                    batch,
                )

            for batch in chunks(
                pbx_rows,
                batch_size,
            ):
                cur.executemany(
                    insert_pbx,
                    batch,
                )

    return (
        deleted_tabulation,
        deleted_pbx,
        len(tabulation_rows),
        len(pbx_rows),
    )


def main() -> int:
    started = time.monotonic()
    run_id = uuid.uuid4()
    source_date = sao_paulo_today()
    pg_conn = None
    source_results: list[dict[str, Any]] = []

    try:
        log.info(
            "OSP Monitor Engine iniciado. "
            "RunId=%s",
            run_id,
        )

        config_errors = validate_source_config()

        if config_errors:
            raise RuntimeError(
                "Configuracao de fontes invalida:\n- "
                + "\n- ".join(
                    config_errors
                )
            )

        connections = unique_connections()

        if not connections:
            raise RuntimeError(
                "Nenhuma fonte habilitada "
                "em servers.py."
            )

        tabulation_table = safe_source_table(
            os.getenv(
                "TABULATION_SOURCE_TABLE",
                "dbo.OSP_Alerta_Painel",
            ),
            "TABULATION_SOURCE_TABLE",
        )

        pbx_table = safe_source_table(
            os.getenv(
                "PBX_SOURCE_TABLE",
                "dbo.Osp_Alerta_Retorno_Painel",
            ),
            "PBX_SOURCE_TABLE",
        )

        pg_conn = connect_neon()

        create_run(
            pg_conn,
            run_id,
            source_date,
            connections,
        )

        (
            tabulation_rows,
            pbx_rows,
            source_results,
        ) = extract_all_sources(
            source_date,
            tabulation_table,
            pbx_table,
            connections,
        )

        if (
            not tabulation_rows
            and not env_bool(
                "ALLOW_EMPTY_SOURCE",
                False,
            )
        ):
            raise RuntimeError(
                "Consolidado de Tabulacao "
                "ficou vazio. Neon preservado."
            )

        if (
            not pbx_rows
            and not env_bool(
                "ALLOW_EMPTY_SOURCE",
                False,
            )
        ):
            raise RuntimeError(
                "Consolidado de Retorno PBX "
                "ficou vazio. Neon preservado."
            )

        update_source_counts(
            pg_conn,
            run_id,
            len(tabulation_rows),
            len(pbx_rows),
            source_results,
        )

        (
            deleted_tabulation,
            deleted_pbx,
            inserted_tabulation,
            inserted_pbx,
        ) = replace_today(
            pg_conn,
            source_date,
            tabulation_rows,
            pbx_rows,
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
            "connections": len(
                connections
            ),
            "tabulation_rows":
                inserted_tabulation,
            "pbx_rows": inserted_pbx,
            "duration_ms": int(
                (
                    time.monotonic()
                    - started
                ) * 1000
            ),
        })

        log.info(
            "Carga concluida. Conexoes=%s | "
            "DELETE/INSERT Tabulacao=%s/%s | "
            "PBX=%s/%s",
            len(connections),
            deleted_tabulation,
            inserted_tabulation,
            deleted_pbx,
            inserted_pbx,
        )

        return 0

    except Exception as exc:
        message = str(exc)

        log.exception(
            "Falha no OSP Monitor Engine: %s",
            message,
        )

        if pg_conn is not None:
            try:
                if source_results:
                    update_source_counts(
                        pg_conn,
                        run_id,
                        0,
                        0,
                        source_results,
                    )

                finish_run(
                    pg_conn,
                    run_id,
                    "ERROR",
                    started,
                    error_message=message[:4000],
                )

            except Exception:
                log.exception(
                    "Nao foi possivel registrar "
                    "a falha no Neon."
                )

        write_status({
            "status": "ERROR",
            "run_id": str(run_id),
            "source_date": source_date,
            "error": message,
            "duration_ms": int(
                (
                    time.monotonic()
                    - started
                ) * 1000
            ),
        })

        return 1

    finally:
        if pg_conn is not None:
            try:
                pg_conn.close()
            except Exception:
                pass


if __name__ == "__main__":
    raise SystemExit(main())
