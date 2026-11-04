from servers import (
    ACTIVE_SOURCE_IDS,
    SOURCES,
    enabled_sources,
    unique_connections,
    validate_source_config,
)


def main() -> int:
    print("=" * 64)
    print("OSP MONITOR ENGINE - VALIDACAO DE FONTES")
    print("=" * 64)

    active = enabled_sources()
    disabled = [
        source
        for source in SOURCES
        if not source.get("enabled", True)
    ]

    print(f"Vinculos configurados : {len(SOURCES)}")
    print(f"Vinculos ativos ETL   : {len(active)}")
    print(f"Conexoes IP + Banco   : {len(unique_connections())}")
    print(f"Vinculos desabilitados: {len(disabled)}")

    if ACTIVE_SOURCE_IDS:
        print(
            "Modo seletivo         : "
            + ", ".join(sorted(ACTIVE_SOURCE_IDS))
        )

    print()

    for source in active:
        print(
            f"ATIVO: {source['source_id']} | "
            f"{source['client']} | "
            f"{source['host']} | "
            f"{source['database']} | "
            f"{source['product']} | "
            f"CampaignIds={source.get('campaign_ids', [])}"
        )

    print()

    errors = validate_source_config()

    if errors:
        print("CONFIGURACAO PENDENTE:")
        for error in errors:
            print(f" - {error}")
        print()
        print(
            "Nenhuma carga deve ser ativada "
            "enquanto houver pendencias."
        )
        return 1

    print("CONFIGURACAO OK.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
