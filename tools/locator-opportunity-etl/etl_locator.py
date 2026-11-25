#!/usr/bin/env python3
"""ETL diário de oportunidades Locator: SQL Server -> PostgreSQL do OSP Logbook.

Não roda no Render. Execute em um Windows com acesso à rede privada,
ODBC Driver para SQL Server e servidor PostgreSQL/Neon acessível.
Credenciais e arquivo servidores.json ficam SOMENTE no ambiente local.
"""
from __future__ import annotations

import argparse
import ipaddress
import json
import logging
import os
import re
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

BASE = Path(__file__).resolve().parent
LOG = logging.getLogger("locator-etl")
QUERY_FILE = BASE / "sql" / "consulta_consolidada.sql"


def env_load() -> None:
    """Carrega .env simples sem dependência extra (não substitui variáveis existentes)."""
    path = BASE / ".env"
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        if re.fullmatch(r"[A-Z][A-Z0-9_]*", k.strip()):
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise ValueError(f"Variável {name} não configurada no .env.")
    return value


def get_sources(path: Path) -> list[dict]:
    if not path.exists():
        raise FileNotFoundError(
            f"Arquivo {path} inexistente. Copie o JSON de servidores para este caminho. "
            "Não suba o JSON com IPs internos ao repositório."
        )
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(data, list):
        raise ValueError("servidores.json deve conter uma lista de objetos.")
    # Desduplicação: servidor compartilha host com clientes/produtos diferentes.
    sources: dict[str, dict] = {}
    for record in data:
        if not isinstance(record, dict) or str(record.get("Ativo", "0")) not in ("1", "True", "true"):
            continue
        host = str(record.get("host", "")).strip()
        ipaddress.ip_address(host)
        if host in sources:
            raise ValueError(f"Host duplicado no JSON: {host}. Consolidar configuração antes da carga.")
        sources[host] = record
    return list(sources.values())


def resolve_client(source: dict, campaign_id: int) -> tuple[str, str]:
    """Nunca atribui automaticamente a um cliente ambíguo de servidor compartilhado."""
    lookup = source.get("depara_campanhas_painel") or {}
    mapped = lookup.get(str(campaign_id))
    if mapped:
        return str(mapped).strip(), "RESOLVED"
    origin = str(source.get("client") or source.get("cliente_painel") or "Ambiente").strip()
    client_names = {
        str(link.get("cliente", "")).strip()
        for link in source.get("vinculos_painel", [])
        if isinstance(link, dict) and link.get("cliente")
    }
    if origin.casefold() == "energisa":
        return ("Energisa - SDR" if campaign_id == 345 else "Energisa - Cobrança"), "RESOLVED"
    if len(client_names) == 1:
        return next(iter(client_names)), "RESOLVED"
    if len(client_names) > 1:
        return "A validar · " + origin, "UNRESOLVED"
    if source.get("cliente_painel"):
        return str(source["cliente_painel"]), "RESOLVED"
    return "A validar · " + origin, "UNRESOLVED"


def select_odbc_driver(installed: list[str], configured: str = "auto") -> str:
    """Resolve against drivers visible to the actual Python process."""
    available = {name.casefold(): name for name in installed}
    requested = configured.strip()
    if requested and requested.casefold() != "auto":
        if not re.fullmatch(r"[\w .()+-]+", requested):
            raise ValueError("Nome de driver ODBC inválido.")
        if requested.casefold() in available:
            return available[requested.casefold()]
    for name in ("ODBC Driver 17 for SQL Server", "ODBC Driver 18 for SQL Server"):
        if name.casefold() in available:
            selected = available[name.casefold()]
            if requested and requested.casefold() != "auto":
                LOG.warning("Driver solicitado (%s) indisponível; usando %s.", requested, selected)
            return selected
    raise RuntimeError("Nenhum ODBC Driver 17 ou 18 para SQL Server disponível neste Python. "
                       "Drivers visíveis: " + (", ".join(installed) or "(nenhum)") +
                       ". Instale um driver compatível com a arquitetura do Python.")


def preflight_odbc() -> str:
    import pyodbc
    configured = os.getenv("SQL_ODBC_DRIVER", "auto")
    driver = select_odbc_driver(pyodbc.drivers(), configured)
    LOG.info("Python: %s | ODBC selecionado: %s", sys.executable, driver)
    os.environ["SQL_ODBC_DRIVER"] = driver
    return driver


def sql_connection(host: str):
    import pyodbc
    driver = select_odbc_driver(pyodbc.drivers(), os.getenv("SQL_ODBC_DRIVER", "auto"))
    parts = [
        "DRIVER={" + driver + "}",
        "SERVER=" + host + "," + str(int(os.getenv("SQL_PORT", "1433"))),
        "DATABASE=master",
        "Encrypt=" + os.getenv("SQL_ENCRYPT", "no"),
        "TrustServerCertificate=" + os.getenv("SQL_TRUST_CERTIFICATE", "yes"),
        "Connection Timeout=" + os.getenv("SQL_CONNECT_TIMEOUT", "15"),
    ]
    if os.getenv("SQL_TRUSTED_CONNECTION", "0").strip().lower() in {"1", "true", "yes"}:
        parts.append("Trusted_Connection=yes")
    else:
        parts.extend(["UID=" + required("SQL_USER"), "PWD=" + required("SQL_PASSWORD")])
    cn = pyodbc.connect(";".join(parts) + ";", timeout=int(os.getenv("SQL_CONNECT_TIMEOUT", "15")), autocommit=True)
    cn.timeout = int(os.getenv("SQL_QUERY_TIMEOUT", "1800"))
    return cn


def as_date(value):
    """Converte a data retornada por pyodbc sem alterar o dia local."""
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value)[:10])


def extract_period(cursor, start: date, end: date) -> tuple[list[dict], list[dict]]:
    """Executa uma consulta consolidada por servidor e lê os dois result sets.

    1) Funil por dia/campanha; 2) tabelas históricas não encontradas.
    SET NOCOUNT ON evita os contadores intermediários de linhas do T-SQL.
    """
    sql = QUERY_FILE.read_text(encoding="utf-8-sig")
    cursor.execute(sql, start, end)
    calls = None
    missing = None
    expected = {"data", "campaignid", "nomecampanha", "mailing",
                "logados", "tentativas", "atendidas", "nome_servidor"}
    while True:
        if cursor.description is not None:
            cols = [c[0] for c in cursor.description]
            lowered = {c.lower() for c in cols}
            rows = [dict(zip(cols, record)) for record in cursor.fetchall()]
            if expected.issubset(lowered):
                if calls is not None:
                    raise RuntimeError("Consulta retornou mais de um resultado de chamadas.")
                calls = rows
            elif {"data", "nometabela"}.issubset(lowered):
                if missing is not None:
                    raise RuntimeError("Consulta retornou mais de um resultado de tabelas ausentes.")
                missing = rows
        if not cursor.nextset():
            break
    if calls is None or missing is None:
        raise RuntimeError(
            "A consulta SQL deve retornar dois conjuntos: chamadas e tabelas ausentes. "
            "Verifique o script sql/consulta_consolidada.sql."
        )
    return calls, missing


UPSERT = """
INSERT INTO public.osp_locator_opportunity_daily
(source_host,data,campaign_id,nome_servidor,cliente,mapping_status,nome_campanha,
 virtual_agent_type_id,mailing,mailing_source_date,logados,tentativas,atendidas,data_hora_carga)
VALUES (%s::inet,%s::date,%s,%s,%s,%s,%s,%s,%s,%s::date,%s,%s,%s,now())
ON CONFLICT(source_host,data,campaign_id) DO UPDATE SET
 nome_servidor=EXCLUDED.nome_servidor, cliente=EXCLUDED.cliente,
 mapping_status=EXCLUDED.mapping_status, nome_campanha=EXCLUDED.nome_campanha,
 virtual_agent_type_id=EXCLUDED.virtual_agent_type_id,
 mailing=EXCLUDED.mailing, mailing_source_date=EXCLUDED.mailing_source_date,
 logados=EXCLUDED.logados,tentativas=EXCLUDED.tentativas,
 atendidas=EXCLUDED.atendidas,data_hora_carga=now()
"""


def pg_connection():
    import psycopg
    url = os.getenv("DATABASE_URL_UNPOOLED") or required("DATABASE_URL")
    # O TLS é obrigatório para a base remota.
    return psycopg.connect(url, sslmode=os.getenv("PG_SSLMODE", "require"),
                           connect_timeout=15, autocommit=True,
                           application_name="osp-locator-opportunity-etl")


def log_run(pg, host: str, day: date, status: str, count=0, message=""):
    with pg.transaction():
        pg.execute("""
          INSERT INTO osp_locator_opportunity_etl_log
          (source_host,load_date,status,row_count,message)
          VALUES (%s::inet,%s::date,%s,%s,%s)
        """, (host, day, status, count, message[:2000]))


def process_period(pg, source: dict, start: date, end: date, dry_run: bool):
    """Extrai o período uma vez por servidor; persiste em transações por dia."""
    host = source["host"]
    sql_cn = sql_connection(host)
    try:
        calls, missing_tables = extract_period(sql_cn.cursor(), start, end)
    finally:
        sql_cn.close()

    # O SQL devolve datas de tabelas inexistentes em segundo result set.
    missing_by_day = {as_date(row["Data"]): str(row["NomeTabela"])
                      for row in missing_tables}
    by_day: dict[date, list[dict]] = {}
    seen: set[tuple[date, int]] = set()
    for row in calls:
        day = as_date(row["Data"])
        cid = int(row["CampaignId"])
        if not start <= day <= end:
            raise ValueError(f"Data fora do intervalo retornada pelo SQL Server: {day}")
        if day in missing_by_day:
            raise ValueError(f"Dia {day} com chamadas e tabela ausente ao mesmo tempo.")
        if (day, cid) in seen:
            raise ValueError(f"Campanha duplicada na extração: {host}, {day}, {cid}")
        seen.add((day, cid))
        by_day.setdefault(day, []).append(row)

    stats = {"SUCCESS": 0, "PARTIAL": 0, "SKIPPED": 0, "EMPTY": 0}
    count = 0
    day = start
    while day <= end:
        if day in missing_by_day:
            status = "SKIPPED"
            message = f"Tabela histórica ausente: {missing_by_day[day]}. Dados anteriores preservados."
            LOG.warning("%s %s | %s", host, day, message)
            if not dry_run:
                log_run(pg, host, day, status, message=message)
        else:
            rows = by_day.get(day, [])
            if not rows:
                status = "EMPTY"
                message = "Consulta sem chamadas no dia; dados anteriores preservados."
                LOG.info("%s %s | %s", host, day, message)
                if not dry_run:
                    log_run(pg, host, day, status, message=message)
            else:
                values = []
                null_mailing = 0
                for row in rows:
                    cid = int(row["CampaignId"])
                    client, mapping = resolve_client(source, cid)
                    mailing = row["Mailing"]
                    if mailing is None:
                        null_mailing += 1
                    values.append((
                        host, day, str(cid),
                        str(row["Nome_Servidor"] or source.get("client") or host),
                        client, mapping,
                        str(row["NomeCampanha"] or f"Campanha {cid}"),
                        int(row["VirtualAgentTypeId"]) if row.get("VirtualAgentTypeId") is not None else None,
                        int(mailing) if mailing is not None else None,
                        as_date(row["MailingData"]) if row.get("MailingData") is not None else None,
                        int(row["Logados"]), int(row["Tentativas"]), int(row["Atendidas"]),
                    ))
                status = "PARTIAL" if null_mailing else "SUCCESS"
                LOG.info("%s %s | %s campanhas; %s sem Mailing | %s",
                         host, day, len(values), null_mailing, status)
                if not dry_run:
                    # Autocommit=True com transação explícita, garantindo COMMIT no Neon.
                    with pg.transaction():
                        with pg.cursor() as cursor:
                            cursor.executemany(UPSERT, values)
                            cursor.execute("""
                                INSERT INTO osp_locator_opportunity_etl_log
                                (source_host,load_date,status,row_count,message)
                                VALUES (%s::inet,%s::date,%s,%s,%s)
                            """, (host, day, status, len(values),
                                  f"{null_mailing} campanhas sem Mailing. Consulta consolidada."))
                count += len(values)
        stats[status] += 1
        day += timedelta(days=1)
    LOG.info("%s | %s a %s | %s registros | status %s | dry-run=%s",
             host, start, end, count, stats, dry_run)
    return stats, count


def run():
    env_load()
    parser = argparse.ArgumentParser(description="ETL SQL Server -> OSP Oportunidades Locator")
    parser.add_argument("--start", help="Data inicial inclusiva (YYYY-MM-DD)")
    parser.add_argument("--end", help="Data final inclusiva (YYYY-MM-DD)")
    parser.add_argument("--days", type=int, default=1,
                        help="Sem datas explícitas: quantidade de dias anteriores, padrão 1 (ontem)")
    parser.add_argument("--host", help="Processar somente este host do JSON")
    parser.add_argument("--servers", default=os.getenv("LOCATOR_SERVERS_FILE", str(BASE/"servidores.json")))
    parser.add_argument("--dry-run", action="store_true", help="Consulta sem gravar no PostgreSQL")
    parser.add_argument("--check-driver", action="store_true", help="Valida Python e driver ODBC sem consultar servidores ou Neon")
    args = parser.parse_args()
    try:
        preflight_odbc()
    except (ImportError, RuntimeError, ValueError) as exc:
        LOG.error("Falha na validação local do ODBC: %s", exc)
        return 1
    if args.check_driver:
        return 0
    if args.days<1 or args.days>366:
        parser.error("--days deve estar entre 1 e 366")
    today = datetime.now(ZoneInfo("America/Sao_Paulo")).date()
    end = date.fromisoformat(args.end) if args.end else today-timedelta(days=1)
    start = date.fromisoformat(args.start) if args.start else end-timedelta(days=args.days-1)
    if start>end or (end-start).days>365 or end>today:
        parser.error("Período inválido. Limite: 366 dias, sem datas futuras.")
    sources=get_sources(Path(args.servers or str(BASE/"servidores.json")))
    if args.host:
        sources=[s for s in sources if s["host"]==args.host]
        if not sources:
            parser.error("--host não encontrado entre os hosts ativos do JSON")
    if not sources:
        parser.error("Nenhum servidor ativo disponível.")
    LOG.info("Servidores ativos: %d | Período: %s a %s | Dry run: %s",
             len(sources),start,end,args.dry_run)
    failed=0
    pg=None if args.dry_run else pg_connection()
    try:
        for source in sources:
            host = source["host"]
            try:
                process_period(pg, source, start, end, args.dry_run)
            except Exception as exc:
                failed += 1
                LOG.exception("%s %s a %s | Falha. Dados anteriores preservados.", host, start, end)
                if pg is not None:
                    try:
                        log_run(pg, host, start, "FAILED",
                                message=f"Período {start} a {end}: {exc}")
                    except Exception:
                        LOG.exception("Não foi possível persistir o log de erro.")
    finally:
        if pg is not None:
            pg.close()
    if failed:
        LOG.error("Finalizado com %s fontes/datas com falha.",failed)
        return 1
    LOG.info("ETL concluído sem falhas de extração.")
    return 0


if __name__=="__main__":
    logging.basicConfig(level=logging.INFO,format="%(asctime)s %(levelname)s %(message)s",
                        handlers=[logging.StreamHandler(sys.stdout)])
    try:
        sys.exit(run())
    except Exception:
        LOG.exception("Erro de configuração/inicialização.")
        sys.exit(1)
