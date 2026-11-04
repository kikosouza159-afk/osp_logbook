from servers import SERVERS, unique_enabled_hosts, validate_server_config


def main() -> int:
    print("=" * 58)
    print("OSP MONITOR ENGINE - VALIDACAO DE SERVIDORES")
    print("=" * 58)

    enabled = [s for s in SERVERS if s.get("enabled", True)]
    disabled = [s for s in SERVERS if not s.get("enabled", True)]

    print(f"Entradas configuradas : {len(SERVERS)}")
    print(f"Entradas habilitadas  : {len(enabled)}")
    print(f"Hosts unicos ativos   : {len(unique_enabled_hosts())}")
    print(f"Entradas desabilitadas: {len(disabled)}")
    print()

    errors = validate_server_config()

    if errors:
        print("CONFIGURACAO PENDENTE:")
        for error in errors:
            print(f" - {error}")
        print()
        print("Nenhuma carga deve ser ativada enquanto houver pendencias.")
        return 1

    print("CONFIGURACAO OK.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
