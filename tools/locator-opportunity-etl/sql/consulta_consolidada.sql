/*
  Oportunidades Locator: consulta consolidada enviada pela operação.
  Executada por etl_locator.py com dois parâmetros ODBC: início e fim.
  NÃO substituir os placeholders por concatenação de strings.

  Campos extras para o painel: VirtualAgentTypeId e MailingData.
*/
SET NOCOUNT ON;

------------------------------------------------------------
-- 1. PARÂMETROS (FIM INCLUSIVO)
------------------------------------------------------------
DECLARE @DataInicio DATE = CONVERT(DATE, ?);
DECLARE @DataFim DATE = CONVERT(DATE, ?);
DECLARE @Hoje DATE = CAST(GETDATE() AS DATE);
DECLARE @DataAtual DATE = @DataInicio;
DECLARE @ProximoDia DATE;
DECLARE @NomeTabela SYSNAME;
DECLARE @SQL NVARCHAR(MAX);

IF @DataFim < @DataInicio
    THROW 50001, 'DataFim deve ser maior ou igual a DataInicio.', 1;
IF @DataFim > @Hoje
    THROW 50002, 'DataFim nao pode ser maior que hoje.', 1;

------------------------------------------------------------
-- 2. MAILING CONSOLIDADO
-- Fonte direta do ambiente, sem linked server.
------------------------------------------------------------
DROP TABLE IF EXISTS #MAILING_AJUSTE;
;WITH MailingBase AS
(
    SELECT
        CONVERT(DATE, RI.DateProccess) AS Data,
        RI.CampaignId,
        RI.TotalRecordsImported,
        ROW_NUMBER() OVER
        (
            PARTITION BY
                RI.CampaignId,
                CONVERT(DATE, RI.DateProccess),
                LEFT(
                    RI.FileName,
                    LEN(RI.FileName) - CHARINDEX('_', REVERSE(RI.FileName))
                )
            ORDER BY RI.DateProccess DESC
        ) AS RN
    FROM ImportExportControl.dbo.ReportImport RI WITH (NOLOCK)
    WHERE RI.ImportStatusId = 3
      AND RI.DateProccess < DATEADD(DAY, 1, @DataFim)
)
SELECT
    Data,
    CampaignId,
    SUM(CONVERT(BIGINT, TotalRecordsImported)) AS Mailing
INTO #MAILING_AJUSTE
FROM MailingBase
WHERE RN = 1
GROUP BY Data, CampaignId;

CREATE CLUSTERED INDEX CX_MAILING_AJUSTE
ON #MAILING_AJUSTE (CampaignId, Data DESC);

------------------------------------------------------------
-- 3. TABELA TEMPORÁRIA PARA CONSOLIDAÇÃO
------------------------------------------------------------
DROP TABLE IF EXISTS #RESUMO_CHAMADAS;
CREATE TABLE #RESUMO_CHAMADAS
(
    Data DATE NOT NULL,
    CampaignId INT NOT NULL,
    Logados INT,
    Tentativas BIGINT,
    Atendidas BIGINT
);

------------------------------------------------------------
-- 4. CONTROLE DE TABELAS AUSENTES
------------------------------------------------------------
DROP TABLE IF EXISTS #TABELAS_AUSENTES;
CREATE TABLE #TABELAS_AUSENTES
(
    Data DATE,
    NomeTabela SYSNAME
);

------------------------------------------------------------
-- 5. LOOP DINÂMICO POR DATA
------------------------------------------------------------
WHILE @DataAtual <= @DataFim
BEGIN
    SET @ProximoDia = DATEADD(DAY, 1, @DataAtual);

    IF @DataAtual = @Hoje
    BEGIN
        SET @NomeTabela = 'AttemptsRawData';
    END
    ELSE
    BEGIN
        SET @NomeTabela = 'AttemptsRawData_'
            + REPLACE(CONVERT(CHAR(10), @DataAtual, 23), '-', '_');
    END;

    IF EXISTS
    (
        SELECT 1
        FROM ExportDataV3.sys.tables T
        INNER JOIN ExportDataV3.sys.schemas S ON T.schema_id = S.schema_id
        WHERE T.name = @NomeTabela AND S.name = 'dbo'
    )
    BEGIN
        SET @SQL = N'
        ;WITH AGENTE AS
        (
            SELECT
                A.CampaignId,
                A.AgentId,
                COUNT_BIG(*) AS Tentativas
            FROM ExportDataV3.dbo.' + QUOTENAME(@NomeTabela) + N' A WITH (NOLOCK)
            WHERE A.StartDate >= @Dia
              AND A.StartDate < @DiaSeguinte
            GROUP BY A.CampaignId, A.AgentId
        )
        INSERT INTO #RESUMO_CHAMADAS
            (Data, CampaignId, Logados, Tentativas, Atendidas)
        SELECT
            @Dia AS Data,
            CampaignId,
            SUM(CASE WHEN AgentId > 0 THEN 1 ELSE 0 END) AS Logados,
            SUM(Tentativas) AS Tentativas,
            SUM(CASE WHEN AgentId > 0 THEN Tentativas
                     ELSE CONVERT(BIGINT, 0) END) AS Atendidas
        FROM AGENTE
        GROUP BY CampaignId
        OPTION (MAXDOP 2, RECOMPILE);
        ';

        EXEC sys.sp_executesql
            @SQL,
            N'@Dia DATE, @DiaSeguinte DATE',
            @Dia = @DataAtual,
            @DiaSeguinte = @ProximoDia;
    END
    ELSE
    BEGIN
        INSERT INTO #TABELAS_AUSENTES (Data, NomeTabela)
        VALUES (@DataAtual, @NomeTabela);
    END;

    SET @DataAtual = @ProximoDia;
END;

------------------------------------------------------------
-- 6. ÍNDICE DO RESUMO
------------------------------------------------------------
CREATE CLUSTERED INDEX CX_RESUMO_CHAMADAS
ON #RESUMO_CHAMADAS (CampaignId, Data);

------------------------------------------------------------
-- 7. CRUZAMENTO FINAL COM CAMPANHA E MAILING
------------------------------------------------------------
DROP TABLE IF EXISTS #Chamadas;
SELECT
    @@SERVERNAME AS Nome_Servidor,
    R.Data,
    R.CampaignId,
    B.Description AS NomeCampanha,
    M.Mailing,
    R.Logados,
    R.Tentativas,
    R.Atendidas,
    TRY_CONVERT(INT, B.VirtualAgentTypeId) AS VirtualAgentTypeId,
    M.Data AS MailingData
INTO #Chamadas
FROM #RESUMO_CHAMADAS R
INNER JOIN SysConfiguration.dbo.Campaign B WITH (NOLOCK)
    ON R.CampaignId = B.CampaignId
OUTER APPLY
(
    SELECT TOP (1)
        MA.Mailing, MA.Data
    FROM #MAILING_AJUSTE MA
    WHERE MA.CampaignId = R.CampaignId
      AND MA.Data <= R.Data
    ORDER BY MA.Data DESC
) M
OPTION (MAXDOP 2, RECOMPILE);

------------------------------------------------------------
-- 8. RESULTADO FINAL
------------------------------------------------------------
SELECT
    Nome_Servidor, Data, CampaignId, NomeCampanha,
    Mailing, Logados, Tentativas, Atendidas,
    VirtualAgentTypeId, MailingData
FROM #Chamadas
ORDER BY Data, CampaignId;

------------------------------------------------------------
-- 9. TABELAS NÃO ENCONTRADAS
------------------------------------------------------------
SELECT Data, NomeTabela
FROM #TABELAS_AUSENTES
ORDER BY Data;
