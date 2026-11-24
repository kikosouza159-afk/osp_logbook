# Financeiro | OSP Logbook

Rota /financeiro, visível e autorizada exclusivamente para ADMIN até definição de perfis financeiros. Reutiliza AppShell e design system existentes. Nenhum dado financeiro está versionado.

## Ativação
1. Executar npm run db:migrate no ambiente autorizado para criar osp_financial_snapshot (0018).
2. Validar npm run typecheck, npm run lint e npm run build e testar a rota em homologação.
3. Entrar como ADMIN, Gestão > Financeiro, importar Custo_Locator.xlsx a partir do compartilhamento interno.
4. Conferir os totais contra o Excel e validar permissões. O upload substitui atomicamente todo o snapshot, não é incremental. Não publicar o XLSX.
5. Para automação futura, implementar ETL interno autenticado com credencial dedicada e validação de esquema. O navegador não lê automaticamente o caminho UNC.

O XLSX deve conter Cliente, Nome_Servidor, DATA, Logados, CampaignId, NomeCampanha, VirtualAgentTypeId, Chamadas_Tarifadas, Valor_Tarifado. A chave é cliente/servidor/data/campanha/tipo. Identificadores de agente permanecem sem mapeamento ADA/Locator. Média diária usa dias com registros, custo unitário é razão dos totais. CSV exporta a tabela pesquisada. Comparação usa intervalo anterior de igual duração e sinaliza quantidade de dias com registros.

Primeira entrega: gráficos SVG nativos, CSS e React sem dependências novas; não inclui ECharts/GSAP, comparação A/B livre, exportação XLSX, mapeamento de produtos ou ETL agendado. Dados restritos a ADMIN. Realizar teste visual e revisão antes de merge.
