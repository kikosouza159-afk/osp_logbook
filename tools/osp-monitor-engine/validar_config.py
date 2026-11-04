from servers import SOURCES, unique_connections, validate_source_config


def main() -> int:
    print("=" * 64)
    print("OSP MONITOR ENGINE - VALIDACAO DE FONTES")
    print("=" * 64)

    enabled = [
        source
        for source in SOURCES
        if source.get("enabled", True)
    ]

    disabled = [
        source
        for source in SOURCES
        if not source.get("enabled", True)
    ]

    print(f"Vinculos configurados : {len(SOURCES)}")
    print(f"Vinculos habilitados  : {len(enabled)}")
    print(f"Conexoes IP + Banco   : {len(unique_connections())}")
    print(f"Vinculos desabilitados: {len(disabled)}")
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
