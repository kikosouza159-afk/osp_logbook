# ETL do Mapa de Oportunidades Locator

Componente de **Gestão > Oportunidades Locator** no OSP Logbook.
O Next.js é hospedado normalmente; o Python é executado **na rede interna Windows**, por uma máquina com acesso aos SQL Servers e ao PostgreSQL/Neon. Não executar no Render.

## Instalação no Windows

1. Copie ou clone a pasta `tools/locator-opportunity-etl` para uma máquina interna, com leitura da pasta de instaladores.
2. Execute `INSTALAR_DEPENDENCIAS.bat`. Caso não exista Python >= 3.10, o script usa **python-3.13.15-amd64.exe** de `\\10.15.5.30\Variados\Gerber\ETL\Cockipt\runtime\installer`.
   - O `.exe` não é versionado ou distribuído com o projeto.
   - Se a pasta da rede possuir subpasta `wheels`, o pip instala pacotes offline dela. Se não, é necessário acesso ao índice pip corporativo ou Internet.
   - Também é necessário **Microsoft ODBC Driver 18 for SQL Server**, instalado separadamente.
3. Copie `.env.example` para `.env`; informe credenciais de **somente leitura** do SQL Server e um usuário PostgreSQL restrito às tabelas OSP Locator.
4. Copie o JSON de referência `servidores(4).json` para **`servidores.json`** nesta pasta ou informe `LOCATOR_SERVERS_FILE=C:\caminho\servidores.json` no `.env`.
   **Nunca faça commit desse JSON ou do `.env`**. O repositório GitHub é público.
5. Execute a migration **`db/migrations/0028_locator_opportunity_daily.sql`** no PostgreSQL antes da primeira carga, usando `npm run db:migrate` com as credenciais apropriadas (o migrador aplica também outras migrations pendentes).
6. Faça uma primeira coleta pequena e verifique os logs. Depois amplie o histórico.

## Comandos

Na pasta do ETL, no CMD:

```bat
INSTALAR_DEPENDENCIAS.bat
EXECUTAR_ETL.bat --start 2026-11-10 --end 2026-11-16 --dry-run
EXECUTAR_ETL.bat --start 2026-11-10 --end 2026-11-16
EXECUTAR_ETL.bat --days 1
EXECUTAR_ETL.bat --host 10.195.124.1 --days 1
```

**Agendamento sugerido:** uma vez por dia, após o fechamento das tabelas diárias, executando `EXECUTAR_ETL.bat --days 1` no Agendador de Tarefas do Windows. O `--days 1` consulta **ontem** em São Paulo. Para reprocessamento, use `--start` e `--end`; a chave (IP, data, campanha) impede duplicação.

## Modelo operacional

- Origem: `ExportDataV3.dbo.AttemptsRawData_YYYY_MM_DD`; no dia corrente usa `AttemptsRawData`. **Executa uma única consulta consolidada por servidor e período** (`sql/consulta_consolidada.sql`), com `@DataInicio` e `@DataFim` inclusivos, incluindo o loop das partições, `OPTION (MAXDOP 2, RECOMPILE)` e agrupamento preliminar por `CampaignId, AgentId`.
- Dimensões: `@@SERVERNAME`, Data, `CampaignId`, descrição de `SysConfiguration.dbo.Campaign`, `VirtualAgentTypeId`.
- Logados: soma de uma unidade por `AgentId > 0` após o agrupamento por agente, equivalente à quantidade de agentes distintos no dia.
- Tentativas: soma do `COUNT_BIG(*)` agrupado por agente.
- **Atendidas: soma das tentativas do grupo com `AgentId > 0`**, exatamente a regra da consulta nova. Não equivale necessariamente a todas as chamadas atendidas por voz.
- Mailing: consulta **diretamente `ImportExportControl.dbo.ReportImport` no servidor SQL de origem** (sem linked server), apenas `ImportStatusId=3`, elimina reimportações da mesma família de arquivo e campanha, soma `TotalRecordsImported` e aplica a última importação **menor ou igual à data de operação** (as-of).
- Como salvaguarda, a deduplicação do Mailing inclui também `CampaignId` na chave para não fundir campanhas com mesmo nome-base de arquivo.
- Servidores compartilhados **não são duplicados**: existe uma consulta por host. Um `depara_campanhas_painel` define o cliente quando disponível; Energisa 345 = SDR, demais campanhas = Cobrança. Em casos ambíguos, a campanha é marcada `UNRESOLVED`; a tela permite exibi-la por filtro, mas não a mistura por padrão com o ranking confirmado.
- A consulta devolve **dois result sets**: o consolidado diário e a lista de `#TABELAS_AUSENTES`. O ETL registra `SKIPPED` por data de partição ausente, sem zerar as tabelas no Neon.
- Status: `SUCCESS`, `PARTIAL` (Mailing nulo), `EMPTY`, `SKIPPED` (partição ausente), `FAILED`. O histórico é preservado em casos de falha ou consulta vazia.
- **Não há DELETE no ETL**. Existe apenas UPSERT da partição que foi extraída com sucesso; executar novamente não duplica registros.
- O ETL não abre conexão do navegador com SQL Server; a API do painel lê somente o PostgreSQL, com sessão de ADMIN.

## Índice de Oportunidade automático (0 a 100)

Cada componente contribui com até 25 pontos, usando crescimento contínuo e referências de 1.667 Mailing/Log, 100 Atendidas/Log, 50 mil Mailing e 30 Logados:

1. Mailing/Log: `25 * x/(x+50000/30)` (**maior é melhor**)
2. Atend/Log: `25 * 100/(100+y)` (**menor é melhor**)
3. Mailing: `25 * mailing/(mailing+50000)` (**maior é melhor**)
4. Logados: `25 * logados/(logados+30)` (**maior é melhor**)

Médias calculadas por campanha no período escolhido. O Hit% = somatório de Atendidas / somatório de Tentativas; Spin = Tentativas médias / Mailing médio. O Hit% não interfere na pontuação, mas permanece visível.

## Simulação no pop-up

- Mailing: média dos dias com valor disponível
- Tentativas: Mailing médio × Spin atual (editável)
- Atendidas: Tentativas projetadas × Hit% observado
- CPC: Atendidas × taxa manual de CPC%
- Acordos: CPC × taxa manual de acordo%
- HC planejado: teto(HC médio arredondado × (1-redução desejada%))
- HC mínimo: teto(CPC projetado / capacidade diária de CPC por operador)

**Benchmarks iniciais:** CPC 29,4%, Acordo/CPC 4,4%, capacidade 95 CPC/HC/dia e redução desejada 35%; ajustar no detalhamento. A base não contém CPC ou acordos reais: os valores da simulação não são resultados comprovados.

## Monitoramento no PostgreSQL

```sql
SELECT load_date, status, count(*) AS fontes, sum(row_count) AS registros
FROM osp_locator_opportunity_etl_log
GROUP BY load_date,status
ORDER BY load_date DESC,status;
SELECT max(data) AS data_mais_recente, count(*) AS registros
FROM osp_locator_opportunity_daily;
SELECT cliente,campaign_id,nome_campanha,mailing,logados,tentativas,atendidas
FROM osp_locator_opportunity_daily
ORDER BY data DESC LIMIT 30;
```

**Atenção ao banco de Mailing:** a consulta nova utiliza `ImportExportControl.dbo.ReportImport` em cada servidor configurado. É obrigatório que o banco exista e a credencial tenha permissão de leitura; caso contrário, a extração do servidor falha e a carga anterior é preservada. Não substitua Mailing ausente por zero. No `.env`, `SQL_QUERY_TIMEOUT=1800` (segundos) é o timeout padrão recomendado para períodos longos.

**SQL original adaptado:** `sql/consulta_consolidada.sql` reproduz a consulta recebida e acrescenta apenas os campos `VirtualAgentTypeId` e `MailingData`, necessários ao painel e à auditoria da origem do mailing.

**Execução por período:** um comando `--start/--end` extrai todo o intervalo por host, incluindo a lista de partições ausentes. Um erro em um host não impede consultar os demais; o comando termina com código de erro se alguma origem falhar. A carga continua idempotente no Neon.
