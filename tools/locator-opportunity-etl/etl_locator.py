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
SOURCE_DB = "ExportDataV3"
LINKED_REPORT = "OLOSMEFFLADTB01.ImportExportControl.dbo.ReportImport"


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


def sql_connection(host: str):
    import pyodbc
    driver = os.environ.get("SQL_ODBC_DRIVER", "ODBC Driver 18 for SQL Server")
    if not re.fullmatch(r"[\w .()+-]+", driver):
        raise ValueError("Nome de driver ODBC inválido.")
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
    cn = pyodbc.connect(";".join(parts) + ";", timeout=15, autocommit=True)
    cn.timeout = int(os.getenv("SQL_QUERY_TIMEOUT", "240"))
    return cn


def source_table(cursor, day: date) -> str | None:
    suffix = day.strftime("%Y_%m_%d")
    choices = (["AttemptsRawData"] if day == date.today() else []) + [
        "AttemptsRawData_" + suffix
    ]
    for table in choices:
        object_name = f"{SOURCE_DB}.dbo.{table}"
        cursor.execute("SELECT OBJECT_ID(?, 'U')", object_name)
        if cursor.fetchone()[0] is not None:
            return table
    return None


def extract_calls(cursor, day: date, table: str) -> list[dict]:
    # A tabela vem exclusivamente de source_table(), nunca de entrada de usuário.
    if not re.fullmatch(r"AttemptsRawData(?:_\d{4}_\d{2}_\d{2})?", table):
        raise ValueError("Tabela de tentativas fora do padrão permitido.")
    sql = f"""
    SELECT @@SERVERNAME AS Nome_Servidor, CAST(a.StartDate AS DATE) AS Data,
      a.CampaignId, MAX(b.Description) AS NomeCampanha,
      MAX(TRY_CONVERT(INT,b.VirtualAgentTypeId)) AS VirtualAgentTypeId,
      COUNT(DISTINCT CASE WHEN a.AgentId > 0 THEN a.AgentId END) AS Logados,
      COUNT_BIG(*) AS Tentativas,
      SUM(CASE WHEN a.AgentId > 0 THEN CONVERT(bigint,1) ELSE CONVERT(bigint,0) END) AS Atendidas
    FROM {SOURCE_DB}.dbo.[{table}] a WITH(NOLOCK)
    INNER JOIN SysConfiguration.dbo.Campaign b WITH(NOLOCK)
      ON a.CampaignId = b.CampaignId
    WHERE a.StartDate >= ? AND a.StartDate < ?
    GROUP BY CAST(a.StartDate AS DATE), a.CampaignId
    """
    cursor.execute(sql, day, day + timedelta(days=1))
    columns = [c[0] for c in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


def fetch_mailing(cursor, day: date, campaign_ids: list[int]) -> dict[int, tuple[int, date]]:
    """Última carga por campanha até a data; deduplica arquivos da mesma família.

    O original particionava por data e filename apenas. Acrescentar CampaignId
    evita misturar importações homônimas de campanhas diferentes.
    """
    if not campaign_ids:
        return {}
    unique_ids = sorted(set(int(i) for i in campaign_ids))
    output: dict[int, tuple[int, date]] = {}
    # Cada lote limita a quantidade de parâmetros do SQL Server.
    for offset in range(0, len(unique_ids), 250):
        ids = unique_ids[offset:offset+250]
        placeholders = ",".join("?" for _ in ids)
        sql = f"""
        ;WITH MailingBase AS (
          SELECT CONVERT(date,RI.DateProccess) AS Data,
            RI.CampaignId,
            LEFT(RI.FileName, LEN(RI.FileName) - CHARINDEX('_', REVERSE(RI.FileName))) AS FileName_Base,
            RI.TotalRecordsImported,
            ROW_NUMBER() OVER (
              PARTITION BY CONVERT(date,RI.DateProccess),RI.CampaignId,
                LEFT(RI.FileName,LEN(RI.FileName)-CHARINDEX('_',REVERSE(RI.FileName)))
              ORDER BY RI.DateProccess DESC
            ) AS RN
          FROM {LINKED_REPORT} RI WITH(NOLOCK)
          WHERE RI.ImportStatusId=3 AND RI.CampaignId IN ({placeholders})
            AND RI.DateProccess < DATEADD(day,1,CONVERT(date,?))
        ), MailingDia AS (
          SELECT Data,CampaignId,SUM(CAST(TotalRecordsImported AS bigint)) AS Mailing
          FROM MailingBase WHERE RN=1
          GROUP BY Data,CampaignId
        ), Ultimo AS (
          SELECT *,ROW_NUMBER() OVER(PARTITION BY CampaignId ORDER BY Data DESC) AS U
          FROM MailingDia
        )
        SELECT CampaignId,Data,Mailing FROM Ultimo WHERE U=1
        """
        cursor.execute(sql, *ids, day)
        for campaign, source_date, mailing in cursor.fetchall():
            if mailing is not None:
                source_day = source_date.date() if isinstance(source_date, datetime) else source_date
                output[int(campaign)] = int(mailing), source_day
    return output


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
                           connect_timeout=15, application_name="osp-locator-opportunity-etl")


def log_run(pg, host: str, day: date, status: str, count=0, message=""):
    with pg.transaction():
        pg.execute("""
          INSERT INTO osp_locator_opportunity_etl_log
          (source_host,load_date,status,row_count,message)
          VALUES (%s::inet,%s::date,%s,%s,%s)
        """, (host, day, status, count, message[:2000]))


def process(pg, source: dict, day: date, dry_run: bool):
    host = source["host"]
    with sql_connection(host) as sql_cn:
        cur = sql_cn.cursor()
        table = source_table(cur, day)
        if table is None:
            LOG.warning("%s %s | Tabela particionada não encontrada. Dados preservados.", host, day)
            if not dry_run:
                log_run(pg, host, day, "SKIPPED", message="Tabela AttemptsRawData não encontrada.")
            return "SKIPPED", 0
        rows = extract_calls(cur, day, table)
        if not rows:
            LOG.info("%s %s | Nenhuma tentativa na partição. Dados preservados.", host, day)
            if not dry_run:
                log_run(pg, host, day, "EMPTY", message="Consulta sem linhas; sem exclusões.")
            return "EMPTY", 0
        mailing_warning = ""
        try:
            mailings = fetch_mailing(cur, day, [r["CampaignId"] for r in rows])
        except Exception as exc:
            mailings = {}
            mailing_warning = "ReportImport indisponível, Mailing gravado como NULL"
            LOG.warning("%s %s | %s: %s", host, day, mailing_warning, type(exc).__name__)
        values = []
        missing = 0
        for r in rows:
            cid = int(r["CampaignId"])
            client, status = resolve_client(source, cid)
            mailing = mailings.get(cid)
            if mailing is None:
                missing += 1
            values.append((
                host, day, str(cid), str(r["Nome_Servidor"] or source["client"]),
                client, status, str(r["NomeCampanha"] or f"Campanha {cid}"),
                r["VirtualAgentTypeId"], mailing[0] if mailing else None,
                mailing[1] if mailing else None,
                int(r["Logados"]), int(r["Tentativas"]), int(r["Atendidas"]),
            ))
        status = "PARTIAL" if missing else "SUCCESS"
        LOG.info("%s %s | %s linhas | %s sem Mailing | %s", host, day, len(values), missing, status)
        if dry_run:
            return status, len(values)
        # Idempotente, transação por servidor+dia. Falha nunca apaga carga anterior.
        with pg.transaction():
            with pg.cursor() as cursor:
                cursor.executemany(UPSERT, values)
                cursor.execute("""
                    INSERT INTO osp_locator_opportunity_etl_log
                    (source_host,load_date,status,row_count,message)
                    VALUES (%s::inet,%s::date,%s,%s,%s)
                """, (host,day,status,len(values),
                      f"{missing} campanhas sem Mailing. {mailing_warning}"))
        return status, len(values)


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
    args = parser.parse_args()
    if args.days<1 or args.days>366:
        parser.error("--days deve estar entre 1 e 366")
    today = datetime.now(ZoneInfo("America/Sao_Paulo")).date()
    end = date.fromisoformat(args.end) if args.end else today-timedelta(days=1)
    start = date.fromisoformat(args.start) if args.start else end-timedelta(days=args.days-1)
    if start>end or (end-start).days>365 or end>today:
        parser.error("Período inválido. Limite: 366 dias, sem datas futuras.")
    sources=get_sources(Path(args.servers))
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
        day=start
        while day<=end:
            for source in sources:
                host=source["host"]
                try:
                    process(pg,source,day,args.dry_run)
                except Exception as exc:
                    failed+=1
                    LOG.exception("%s %s | Falha. Dados anteriores preservados.",host,day)
                    if pg is not None:
                        try:
                            log_run(pg,host,day,"FAILED",message=str(exc))
                        except Exception:
                            LOG.exception("Não foi possível persistir o log de erro.")
            day+=timedelta(days=1)
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
