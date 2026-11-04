# OSP Monitor Engine

ETL Windows/Python para sincronizar, a cada **15 minutos**, as tabelas do SQL Server:

- ProfessionalServices02.dbo.OSP_Alerta_Painel
- ProfessionalServices02.dbo.Osp_Alerta_Retorno_Painel

com o Neon do OSP Logbook.

## Estrategia

Cada execucao consulta somente o dia atual:

WHERE Data = CAST(GETDATE() AS DATE)

Antes de alterar o Neon, o ETL le as duas fontes por completo.

Se uma fonte vier vazia e ALLOW_EMPTY_SOURCE=false, a carga e cancelada e os dados existentes no Neon sao preservados.

Quando as fontes estao validas, ocorre uma unica transacao:

1. DELETE do dia atual em osp_monitor_tabulation
2. DELETE do dia atual em osp_monitor_pbx_return
3. INSERT completo do snapshot de Tabulacao
4. INSERT completo do snapshot de Retorno PBX
5. COMMIT

Em qualquer erro ocorre ROLLBACK.

## Primeira configuracao na VM

1. Copie esta pasta para a VM.
2. Copie .env.example para .env.
3. Preencha SQL Server e NEON_DATABASE_URL.
4. Execute INSTALAR_DEPENDENCIAS.bat.
5. Execute EXECUTAR_AGORA.bat.
6. Confirme Exit Code 0.
7. Depois execute INICIAR_MONITORAMENTO.bat.

## Rotina diaria

Como a imagem da VM remove o Agendador do Windows toda noite:

1. Entrar na VM pela manha.
2. Executar INICIAR_MONITORAMENTO.bat.
3. O BAT recria a tarefa OSP Monitor Engine.
4. Uma carga e disparada imediatamente.
5. As proximas execucoes rodam a cada 15 minutos ate 23:59.

Voce pode desconectar o RDP e desligar sua maquina local.

Evite Logoff/Sair da sessao da VM durante o expediente, pois a tarefa usa o token interativo do usuario atual.

## Arquivos

- osp_monitor.py: ETL
- .env: credenciais locais
- INICIAR_MONITORAMENTO.bat: recria agendador e inicia
- EXECUTAR_AGORA.bat: teste manual
- STATUS_MONITORAMENTO.bat: consulta tarefa e ultima carga
- PARAR_MONITORAMENTO.bat: para e remove tarefa
- INSTALAR_DEPENDENCIAS.bat: instala bibliotecas Python
- criar_tarefa.ps1: configuracao do Task Scheduler
- logs/: logs diarios
- .status.json: ultimo resultado local

## Autenticacao SQL Server

SQL Login:
SQLSERVER_AUTH=sql

Windows Authentication:
SQLSERVER_AUTH=trusted

## Destinos Neon

- osp_monitor_tabulation
- osp_monitor_pbx_return
- osp_monitor_etl_control
- osp_monitor_etl_status

## Protecao contra zeramento

Mantenha:

ALLOW_EMPTY_SOURCE=false

Assim, se qualquer uma das duas fontes retornar zero linhas, o ETL nao executa o DELETE no Neon.
