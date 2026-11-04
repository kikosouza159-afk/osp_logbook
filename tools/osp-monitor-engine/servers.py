from __future__ import annotations

import ipaddress
from typing import Any


# Configuracao central dos servidores consumidos pelo OSP Monitor Engine.
#
# Regras:
# - Servidor exclusivo: uma unica atribuicao cliente/produto. Nao precisa filtro.
# - Servidor compartilhado: mais de uma atribuicao no mesmo IP.
#   Nesse caso, cada atribuicao precisa informar campaign_ids e/ou
#   campaign_name_contains para separar corretamente os registros.
# - enabled=False: servidor conhecido, mas bloqueado ate correcao/validacao.

SERVERS: list[dict[str, Any]] = [
    {
        "source_id": "LOC-01",
        "host": "10.196.111.12",
        "enabled": True,
        "assignments": [{"client": "RENAC", "product": "Locator"}],
    },
    {
        "source_id": "LOC-02",
        "host": "10.196.112.11",
        "enabled": True,
        "assignments": [{"client": "LINK", "product": "Locator"}],
    },
    {
        "source_id": "SHARED-SETRA",
        "host": "10.196.174.12",
        "enabled": True,
        "assignments": [
            {
                "client": "SETRA",
                "product": "Locator",
                "campaign_ids": [],
                "campaign_name_contains": [],
            },
            {
                "client": "SETRA",
                "product": "ADA",
                "campaign_ids": [],
                "campaign_name_contains": [],
            },
        ],
        "note": "Servidor compartilhado entre Locator e ADA. Preencher regra por campanha antes da primeira carga.",
    },
    {
        "source_id": "LOC-04",
        "host": "10.195.104.1",
        "enabled": True,
        "assignments": [{"client": "ARANHA E FERREIRA", "product": "Locator"}],
    },
    {
        "source_id": "LOC-05",
        "host": "10.195.150.11",
        "enabled": True,
        "assignments": [{"client": "CREDITAS", "product": "Locator"}],
    },
    {
        "source_id": "LOC-06",
        "host": "10.195.212.11",
        "enabled": True,
        "assignments": [{"client": "SYSCOB", "product": "Locator"}],
    },
    {
        "source_id": "LOC-07",
        "host": "10.196.108.12",
        "enabled": True,
        "assignments": [{"client": "REDE BRASIL", "product": "Locator"}],
    },
    {
        "source_id": "LOC-08",
        "host": "10.195.228.11",
        "enabled": True,
        "assignments": [{"client": "ELO", "product": "Locator"}],
    },
    {
        "source_id": "LOC-09",
        "host": "10.195.110.11",
        "enabled": True,
        "assignments": [{"client": "PEREZ REZENDE", "product": "Locator"}],
    },
    {
        "source_id": "LOC-10",
        "host": "10.196.160.111",
        "enabled": True,
        "assignments": [{"client": "FERREIRA E CHAGAS", "product": "Locator"}],
    },
    {
        "source_id": "LOC-11",
        "host": "10.196.196.11",
        "enabled": True,
        "assignments": [{"client": "FULLTIME", "product": "Locator"}],
    },
    {
        "source_id": "LOC-12",
        "host": "10.196.164.11",
        "enabled": True,
        "assignments": [{"client": "PRECISÃO GLOBAL", "product": "Locator"}],
    },
    {
        "source_id": "LOC-13",
        "host": "10.195.120.11",
        "enabled": True,
        "assignments": [{"client": "DUNICE MARCON", "product": "Locator"}],
    },
    {
        "source_id": "LOC-14",
        "host": "10.196.143.11",
        "enabled": True,
        "assignments": [{"client": "COBRAR ADVOGADOS", "product": "Locator"}],
    },
    {
        "source_id": "LOC-15",
        "host": "10.196.202.113",
        "enabled": True,
        "assignments": [{"client": "NOVAQUEST", "product": "Locator"}],
    },
    {
        "source_id": "LOC-16",
        "host": "10.196.220.21",
        "enabled": True,
        "assignments": [{"client": "TRC", "product": "Locator"}],
    },
    {
        "source_id": "LOC-17",
        "host": "10.195.158.11",
        "enabled": True,
        "assignments": [{"client": "SCHULZE", "product": "Locator"}],
    },
    {
        "source_id": "LOC-18",
        "host": "10.195.128.1",
        "enabled": True,
        "assignments": [{"client": "KAINOS", "product": "Locator"}],
    },
    {
        "source_id": "LOC-19",
        "host": "10.178.26.11",
        "enabled": True,
        "assignments": [{"client": "RODOBENS", "product": "Locator"}],
    },
    {
        "source_id": "LOC-20",
        "host": "10.195.186.11",
        "enabled": True,
        "assignments": [{"client": "EM DIA", "product": "Locator"}],
    },
    {
        "source_id": "LOC-21",
        "host": "10.196.208.211",
        "enabled": True,
        "assignments": [{"client": "MAX RECOVERY", "product": "Locator"}],
    },
    {
        "source_id": "LOC-22",
        "host": "10.196.218.11",
        "enabled": True,
        "assignments": [{"client": "TALENTOS", "product": "Locator"}],
    },
    {
        "source_id": "LOC-23",
        "host": "10.195.202.11",
        "enabled": True,
        "assignments": [{"client": "BOTICARIO", "product": "Locator"}],
    },
    {
        "source_id": "LOC-24",
        "host": "10196186113",
        "enabled": False,
        "assignments": [{"client": "VGX", "product": "Locator"}],
        "note": "IP recebido sem separadores. Confirmar IP correto antes de habilitar.",
    },
    {
        "source_id": "LOC-25",
        "host": "10.101.72.12",
        "enabled": True,
        "assignments": [{"client": "PASCHOALOTTO", "product": "Locator"}],
    },
    {
        "source_id": "LOC-26",
        "host": "10.178.14.12",
        "enabled": True,
        "assignments": [{"client": "REIS ADV", "product": "Locator"}],
    },
    {
        "source_id": "LOC-27",
        "host": "10.196.155.11",
        "enabled": True,
        "assignments": [{"client": "FIDUCIAL", "product": "Locator"}],
    },
    {
        "source_id": "LOC-28",
        "host": "10.196.249.11",
        "enabled": True,
        "assignments": [{"client": "VERRESCHI", "product": "Locator"}],
    },
    {
        "source_id": "LOC-29",
        "host": "10.196.107.12",
        "enabled": True,
        "assignments": [{"client": "DNR", "product": "Locator"}],
    },
    {
        "source_id": "LOC-30",
        "host": "10.196.139.11",
        "enabled": True,
        "assignments": [{"client": "SVV COB", "product": "Locator"}],
    },
    {
        "source_id": "SHARED-FASTFLOW-PAGBANK",
        "host": "10.195.124.1",
        "enabled": True,
        "assignments": [
            {
                "client": "FastFlow",
                "product": "ADA",
                "campaign_ids": [],
                "campaign_name_contains": [],
            },
            {
                "client": "PagBank",
                "product": "ADA",
                "campaign_ids": [],
                "campaign_name_contains": [],
            },
        ],
        "note": "Servidor compartilhado. Preencher regra de campanha para separar FastFlow e PagBank.",
    },
    {
        "source_id": "ADA-04",
        "host": "10.195.202.11",
        "enabled": True,
        "assignments": [
            {
                "client": "Boticario",
                "product": "ADA",
                "campaign_ids": [],
                "campaign_name_contains": [],
            }
        ],
        "note": "Mesmo host do Boticario Locator. Este IP passa a ser compartilhado e precisa de regra de campanha.",
    },
    {
        "source_id": "ADA-05",
        "host": "10.195.114.12",
        "enabled": True,
        "assignments": [{"client": "Energisa", "product": "ADA"}],
    },
]


def enabled_servers() -> list[dict[str, Any]]:
    return [server for server in SERVERS if server.get("enabled", True)]


def _has_rule(assignment: dict[str, Any]) -> bool:
    return bool(assignment.get("campaign_ids") or assignment.get("campaign_name_contains"))


def validate_server_config() -> list[str]:
    errors: list[str] = []

    # Valida IPs somente dos servidores habilitados.
    for server in enabled_servers():
        host = str(server["host"]).strip()
        try:
            ipaddress.ip_address(host)
        except ValueError:
            errors.append(
                f"{server['source_id']}: host invalido '{host}'."
            )

    # Agrupa atribuicoes por host. Um mesmo host pode aparecer em mais de uma
    # entrada da lista, como Boticario Locator + ADA.
    by_host: dict[str, list[dict[str, Any]]] = {}
    for server in enabled_servers():
        host = str(server["host"]).strip()
        for assignment in server.get("assignments", []):
            by_host.setdefault(host, []).append(assignment)

    for host, assignments in by_host.items():
        if len(assignments) <= 1:
            continue

        without_rule = [
            f"{a.get('client')} / {a.get('product')}"
            for a in assignments
            if not _has_rule(a)
        ]
        if without_rule:
            errors.append(
                f"{host}: servidor compartilhado exige regra de campanha para: "
                + ", ".join(without_rule)
            )

    return errors


def assignments_for_host(host: str) -> list[dict[str, Any]]:
    assignments: list[dict[str, Any]] = []

    for server in enabled_servers():
        if str(server["host"]).strip() != host:
            continue
        assignments.extend(server.get("assignments", []))

    return assignments


def unique_enabled_hosts() -> list[str]:
    seen: list[str] = []
    for server in enabled_servers():
        host = str(server["host"]).strip()
        if host not in seen:
            seen.append(host)
    return seen


def resolve_assignment(
    host: str,
    campaign_id: int,
    campaign_name: str | None,
) -> dict[str, Any]:
    assignments = assignments_for_host(host)

    if not assignments:
        raise RuntimeError(f"{host}: nenhuma atribuicao configurada.")

    if len(assignments) == 1 and not _has_rule(assignments[0]):
        return assignments[0]

    campaign_name_normalized = (campaign_name or "").casefold()
    matches: list[dict[str, Any]] = []

    for assignment in assignments:
        campaign_ids = {int(value) for value in assignment.get("campaign_ids", [])}
        name_rules = [
            str(value).casefold()
            for value in assignment.get("campaign_name_contains", [])
            if str(value).strip()
        ]

        id_match = bool(campaign_ids) and campaign_id in campaign_ids
        name_match = bool(name_rules) and any(
            rule in campaign_name_normalized for rule in name_rules
        )

        if id_match or name_match:
            matches.append(assignment)

    if len(matches) == 1:
        return matches[0]

    if not matches:
        raise RuntimeError(
            f"{host}: CampaignId={campaign_id} / NomeCampanha='{campaign_name}' "
            "nao possui regra cliente/produto."
        )

    raise RuntimeError(
        f"{host}: CampaignId={campaign_id} casou com mais de uma regra."
    )
