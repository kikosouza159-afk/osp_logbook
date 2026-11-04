/*
OSP MONITOR ENGINE
Patch da origem: classificação Produtivo x Improdutivo

Aplicar na consulta que recria:
ProfessionalServices02.dbo.OSP_Alerta_Painel

REGRA:
  AgentId = 0  -> IMPRODUTIVO
  AgentId > 0  -> PRODUTIVO

IMPORTANTE:
A OSP_Alerta_Painel é uma tabela agregada.
Por isso a classificação precisa entrar no SELECT e no GROUP BY
da consulta que lê AttemptsRawData. Não é seguro tentar preencher
essa informação depois.
*/

-- 1) ADICIONAR AO SELECT:
CASE
    WHEN a.AgentId > 0 THEN 'PRODUTIVO'
    ELSE 'IMPRODUTIVO'
END AS Produtividade,

-- 2) ADICIONAR AO GROUP BY:
CASE
    WHEN a.AgentId > 0 THEN 'PRODUTIVO'
    ELSE 'IMPRODUTIVO'
END

/*
Exemplo estrutural:

SELECT
    ...,
    CASE
        WHEN a.AgentId > 0 THEN 'PRODUTIVO'
        ELSE 'IMPRODUTIVO'
    END AS Produtividade,
    COUNT(*) AS Quantidade,
    SUM(DATEDIFF(SECOND,a.StartDate,a.EndCall)) AS Segundos
INTO ProfessionalServices02.dbo.OSP_Alerta_Painel
FROM ExportDataV3.dbo.AttemptsRawData a WITH(NOLOCK)
...
GROUP BY
    ...,
    CASE
        WHEN a.AgentId > 0 THEN 'PRODUTIVO'
        ELSE 'IMPRODUTIVO'
    END;

Depois da alteração, validar com:

SELECT
    Produtividade,
    SUM(Quantidade) AS Quantidade
FROM ProfessionalServices02.dbo.OSP_Alerta_Painel WITH(NOLOCK)
WHERE Data = CAST(GETDATE() AS date)
GROUP BY Produtividade;

Esperado:
PRODUTIVO
IMPRODUTIVO
*/
