# OSP Monitor Engine

ETL Windows/Python para sincronizar, a cada **15 minutos**, as tabelas:

- `dbo.OSP_Alerta_Painel`
- `dbo.Osp_Alerta_Retorno_Painel`

dos servidores/bancos configurados em `servers.py` com o Neon do OSP Logbook.

## Configuração das fontes

Cada linha de `servers.py` possui:

- IP do servidor
- Cliente
- Banco (`ProfessionalServices02` ou `ProfessionalServices03`)
- Produto (`ADA` ou `Locator`)
- Regra de campanha quando o mesmo IP+banco atende mais de um vínculo

O ETL abre a conexão usando exatamente o banco configurado naquela fonte.

Exemplos PS3 atuais:

- NOVAQUEST → 10.196.202.113 → ProfessionalServices03
- VGX → 10.196.186.113 → ProfessionalServices03

## Estratégia

Cada execução consulta somente o dia atual:

```sql
WHERE Data = CAST(GETDATE() AS DATE)
```

O processo primeiro consulta e classifica todas as conexões `IP + Banco`.
Somente depois altera o Neon.

Quando tudo está válido:

1. DELETE do dia atual em `osp_monitor_tabulation`
2. DELETE do dia atual em `osp_monitor_pbx_return`
3. INSERT do snapshot completo de Tabulação
4. INSERT do snapshot completo de Retorno PBX
5. COMMIT

Em qualquer erro ocorre ROLLBACK.

## Servidores compartilhados

Enquanto houver mais de um vínculo no mesmo IP + Banco, cada um precisa de
`campaign_ids` e/ou `campaign_name_contains`.

Pendências atuais:

- 10.196.174.12 / ProfessionalServices02 → SETRA ADA e Locator
- 10.195.124.1 / ProfessionalServices02 → FastFlow ADA e PagBank ADA
- 10.195.202.11 / ProfessionalServices02 → Boticario ADA e Locator

Execute `VALIDAR_CONFIG.bat` antes da primeira carga.

## Pasta de rede

O pacote foi preparado para:

`\\10.15.5.30\Variados\Gerber\ETL\Logbook\Alerta`

Os BATs usam caminho UNC e o agendador recebe o caminho completo do Python.

## Rotina diária

1. Entrar na VM.
2. Executar `INICIAR_MONITORAMENTO.bat`.
3. O BAT recria a tarefa `OSP Monitor Engine`.
4. A primeira carga é disparada imediatamente.
5. As próximas rodam a cada 15 minutos até 23:59.

Você pode desconectar o RDP. Evite Logoff/Sair durante o expediente.

## Segurança

Mantenha:

`ALLOW_EMPTY_SOURCE=false`

Se uma conexão/fonte vier vazia, o ETL preserva a fotografia anterior do Neon.
