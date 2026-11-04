from __future__ import annotations

import ipaddress
import re
from typing import Any


# Uma linha = um vinculo Servidor + Cliente + Banco + Produto.

# Modo temporario de ativacao seletiva.
# Enquanto este conjunto tiver IDs, somente essas fontes entram no ETL.
# FastFlow-only no momento.
ACTIVE_SOURCE_IDS = {"ADA-02"}
#
# Em servidores/bancos compartilhados, preencha campaign_ids e/ou
# campaign_name_contains para separar cada cliente/produto com seguranca.

SOURCES: list[dict[str, Any]] = [
    {"source_id":"ADA-01","host":"10.196.174.12","client":"SETRA","database":"ProfessionalServices02","product":"ADA","enabled":True,"campaign_ids":[],"campaign_name_contains":[]},
    {"source_id":"ADA-02","host":"10.195.124.1","client":"FastFlow","database":"ProfessionalServices02","product":"ADA","enabled":True,"campaign_ids":[202,203,213],"campaign_name_contains":[]},
    {"source_id":"ADA-03","host":"10.195.124.1","client":"PagBank","database":"ProfessionalServices02","product":"ADA","enabled":True,"campaign_ids":[],"campaign_name_contains":[]},
    {"source_id":"ADA-04","host":"10.195.202.11","client":"Boticario","database":"ProfessionalServices02","product":"ADA","enabled":True,"campaign_ids":[],"campaign_name_contains":[]},
    {"source_id":"ADA-05","host":"10.195.114.12","client":"Energisa","database":"ProfessionalServices02","product":"ADA","enabled":True},

    {"source_id":"LOC-01","host":"10.196.111.12","client":"RENAC","database":"ProfessionalServices02","product":"Locator","enabled":True},
    {"source_id":"LOC-02","host":"10.196.112.11","client":"LINK","database":"ProfessionalServices02","product":"Locator","enabled":True},
    {"source_id":"LOC-03","host":"10.196.174.12","client":"SETRA","database":"ProfessionalServices02","product":"Locator","enabled":True,"campaign_ids":[],"campaign_name_contains":[]},
    {"source_id":"LOC-04","host":"10.195.104.1","client":"ARANHA E FERREIRA","database":"ProfessionalServices02","product":"Locator","enabled":True},
    {"source_id":"LOC-05","host":"10.195.150.11","client":"CREDITAS","database":"ProfessionalServices02","product":"Locator","enabled":True},
    {"source_id":"LOC-06","host":"10.195.212.11","client":"SYSCOB","database":"ProfessionalServices02","product":"Locator","enabled":True},
    {"source_id":"LOC-07","host":"10.196.108.12","client":"REDE BRASIL","database":"ProfessionalServices02","product":"Locator","enabled":True},
    {"source_id":"LOC-08","host":"10.195.228.11","client":"ELO","database":"ProfessionalServices02","product":"Locator","enabled":True},
    {"source_id":"LOC-09","host":"10.195.110.11","client":"PEREZ REZENDE","database":"ProfessionalServices02","product":"Locator","enabled":True},
    {"source_id":"LOC-10","host":"10.196.160.111","client":"FERREIRA E CHAGAS","database":"ProfessionalServices02","product":"Locator","enabled":True},
    {"source_id":"LOC-11","host":"10.196.196.11","client":"FULLTIME","database":"ProfessionalServices02","product":"Locator","enabled":True},
    {"source_id":"LOC-12","host":"10.196.164.11","client":"PRECISÃO GLOBAL","database":"ProfessionalServices02","product":"Locator","enabled":True},
    {"source_id":"LOC-13","host":"10.195.120.11","client":"DUNICE MARCON","database":"ProfessionalServices02","product":"Locator","enabled":True},
    {"source_id":"LOC-14","host":"10.196.143.11","client":"COBRAR ADVOGADOS","database":"ProfessionalServices02","product":"Locator","enabled":True},
    {"source_id":"LOC-15","host":"10.196.202.113","client":"NOVAQUEST","database":"ProfessionalServices03","product":"Locator","enabled":True},
    {"source_id":"LOC-16","host":"10.196.220.21","client":"TRC","database":"ProfessionalServices02","product":"Locator","enabled":True},
    {"source_id":"LOC-17","host":"10.195.158.11","client":"SCHULZE","database":"ProfessionalServices02","product":"Locator","enabled":True},
    {"source_id":"LOC-18","host":"10.195.128.1","client":"KAINOS","database":"ProfessionalServices02","product":"Locator","enabled":True},
    {"source_id":"LOC-19","host":"10.178.26.11","client":"RODOBENS","database":"ProfessionalServices02","product":"Locator","enabled":True},
    {"source_id":"LOC-20","host":"10.195.186.11","client":"EM DIA","database":"ProfessionalServices02","product":"Locator","enabled":True},
    {"source_id":"LOC-21","host":"10.196.208.211","client":"MAX RECOVERY","database":"ProfessionalServices02","product":"Locator","enabled":True},
    {"source_id":"LOC-22","host":"10.196.218.11","client":"TALENTOS","database":"ProfessionalServices02","product":"Locator","enabled":True},
    {"source_id":"LOC-23","host":"10.195.202.11","client":"BOTICARIO","database":"ProfessionalServices02","product":"Locator","enabled":True,"campaign_ids":[],"campaign_name_contains":[]},
    {"source_id":"LOC-24","host":"10.196.186.113","client":"VGX","database":"ProfessionalServices03","product":"Locator","enabled":True},
    {"source_id":"LOC-25","host":"10.101.72.12","client":"PASCHOALOTTO","database":"ProfessionalServices02","product":"Locator","enabled":True},
    {"source_id":"LOC-26","host":"10.178.14.12","client":"REIS ADV","database":"ProfessionalServices02","product":"Locator","enabled":True},
    {"source_id":"LOC-27","host":"10.196.155.11","client":"FIDUCIAL","database":"ProfessionalServices02","product":"Locator","enabled":True},
    {"source_id":"LOC-28","host":"10.196.249.11","client":"VERRESCHI","database":"ProfessionalServices02","product":"Locator","enabled":True},
    {"source_id":"LOC-29","host":"10.196.107.12","client":"DNR","database":"ProfessionalServices02","product":"Locator","enabled":True},
    {"source_id":"LOC-30","host":"10.196.139.11","client":"SVV COB","database":"ProfessionalServices02","product":"Locator","enabled":True},
    {"source_id":"LOC-31","host":"10.196.150.12","client":"MARTINS & COPETTI","database":"ProfessionalServices02","product":"Locator","enabled":True},
]


def enabled_sources() -> list[dict[str, Any]]:
    enabled = [
        source
        for source in SOURCES
        if source.get("enabled", True)
    ]

    if ACTIVE_SOURCE_IDS:
        return [
            source
            for source in enabled
            if source.get("source_id") in ACTIVE_SOURCE_IDS
        ]

    return enabled


def _has_rule(source: dict[str, Any]) -> bool:
    return bool(
        source.get("campaign_ids")
        or source.get("campaign_name_contains")
    )


def unique_connections() -> list[tuple[str, str]]:
    seen: list[tuple[str, str]] = []

    for source in enabled_sources():
        key = (
            str(source["host"]).strip(),
            str(source["database"]).strip(),
        )
        if key not in seen:
            seen.append(key)

    return seen


def sources_for_connection(
    host: str,
    database: str,
) -> list[dict[str, Any]]:
    return [
        source
        for source in enabled_sources()
        if str(source["host"]).strip() == host
        and str(source["database"]).strip() == database
    ]


def validate_source_config() -> list[str]:
    errors: list[str] = []
    source_ids: set[str] = set()

    for source in enabled_sources():
        source_id = str(source.get("source_id", "")).strip()
        host = str(source.get("host", "")).strip()
        database = str(source.get("database", "")).strip()
        client = str(source.get("client", "")).strip()
        product = str(source.get("product", "")).strip()

        if not source_id:
            errors.append("Existe fonte sem source_id.")
        elif source_id in source_ids:
            errors.append(f"source_id duplicado: {source_id}")
        else:
            source_ids.add(source_id)

        try:
            ipaddress.ip_address(host)
        except ValueError:
            errors.append(f"{source_id}: host invalido '{host}'.")

        if not re.fullmatch(r"[A-Za-z0-9_]+", database):
            errors.append(
                f"{source_id}: banco invalido '{database}'."
            )

        if not client:
            errors.append(f"{source_id}: cliente vazio.")

        if product not in {"ADA", "Locator"}:
            errors.append(
                f"{source_id}: produto invalido '{product}'."
            )

    for host, database in unique_connections():
        sources = sources_for_connection(host, database)

        if len(sources) <= 1:
            continue

        without_rule = [
            f"{source['client']} / {source['product']}"
            for source in sources
            if not _has_rule(source)
        ]

        if without_rule:
            errors.append(
                f"{host} / {database}: conexao compartilhada exige "
                "regra de campanha para: "
                + ", ".join(without_rule)
            )

    return errors


def resolve_source(
    host: str,
    database: str,
    campaign_id: int,
    campaign_name: str | None,
) -> dict[str, Any]:
    sources = sources_for_connection(host, database)

    if not sources:
        raise RuntimeError(
            f"{host} / {database}: nenhuma fonte configurada."
        )

    if len(sources) == 1 and not _has_rule(sources[0]):
        return sources[0]

    campaign_name_normalized = (campaign_name or "").casefold()
    matches: list[dict[str, Any]] = []

    for source in sources:
        campaign_ids = {
            int(value)
            for value in source.get("campaign_ids", [])
        }

        name_rules = [
            str(value).casefold()
            for value in source.get(
                "campaign_name_contains",
                [],
            )
            if str(value).strip()
        ]

        id_match = (
            bool(campaign_ids)
            and campaign_id in campaign_ids
        )

        name_match = (
            bool(name_rules)
            and any(
                rule in campaign_name_normalized
                for rule in name_rules
            )
        )

        if id_match or name_match:
            matches.append(source)

    if len(matches) == 1:
        return matches[0]

    if not matches:
        raise RuntimeError(
            f"{host} / {database}: CampaignId={campaign_id} / "
            f"NomeCampanha='{campaign_name}' sem regra "
            "cliente/produto."
        )

    raise RuntimeError(
        f"{host} / {database}: CampaignId={campaign_id} "
        "casou com mais de uma regra."
    )
