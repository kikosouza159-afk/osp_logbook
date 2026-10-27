import { existsSync } from "node:fs";
import sql from "mssql";
import pg from "pg";

if (existsSync(".env")) process.loadEnvFile(".env");
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const { Client } = pg;

const SOURCE_TABLE_DEFAULT = "ProfessionalServices02.dbo.OSP_Alerta";
const BATCH_SIZE = Math.max(100, Math.min(Number(process.env.OSP_ALERTA_BATCH_SIZE || 500), 2000));

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} não configurada.`);
  return value;
}

function asBoolean(value, fallback = false) {
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "sim", "on"].includes(String(value).toLowerCase());
}

function saoPauloDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function safeIdentifier(value, label) {
  if (!/^[A-Za-z0-9_]+$/.test(value)) {
    throw new Error(`${label} inválido: ${value}`);
  }
  return value;
}

function parseSourceTable() {
  const raw = process.env.OSP_ALERTA_SOURCE_TABLE || SOURCE_TABLE_DEFAULT;
  const parts = raw.split(".").filter(Boolean);

  let database;
  let schema;
  let table;

  if (parts.length === 3) {
    [database, schema, table] = parts;
  } else if (parts.length === 2) {
    database = process.env.SQLSERVER_DATABASE || "ProfessionalServices02";
    [schema, table] = parts;
  } else if (parts.length === 1) {
    database = process.env.SQLSERVER_DATABASE || "ProfessionalServices02";
    schema = "dbo";
    [table] = parts;
  } else {
    throw new Error("OSP_ALERTA_SOURCE_TABLE deve estar no formato Banco.Schema.Tabela.");
  }

  return {
    database: safeIdentifier(database, "Banco"),
    schema: safeIdentifier(schema, "Schema"),
    table: safeIdentifier(table, "Tabela"),
  };
}

function sqlServerConfig(sourceDatabase) {
  const instanceName = process.env.SQLSERVER_INSTANCE || undefined;
  const config = {
    server: required("SQLSERVER_HOST"),
    database: process.env.SQLSERVER_DATABASE || sourceDatabase,
    user: required("SQLSERVER_USER"),
    password: required("SQLSERVER_PASSWORD"),
    connectionTimeout: Number(process.env.SQLSERVER_CONNECTION_TIMEOUT_MS || 15000),
    requestTimeout: Number(process.env.SQLSERVER_REQUEST_TIMEOUT_MS || 120000),
    pool: {
      max: 3,
      min: 0,
      idleTimeoutMillis: 30000,
    },
    options: {
      encrypt: asBoolean(process.env.SQLSERVER_ENCRYPT, false),
      trustServerCertificate: asBoolean(process.env.SQLSERVER_TRUST_CERT, true),
      enableArithAbort: true,
      ...(instanceName ? { instanceName } : {}),
    },
  };

  if (!instanceName) {
    config.port = Number(process.env.SQLSERVER_PORT || 1433);
  }

  if (process.env.SQLSERVER_DOMAIN) {
    config.domain = process.env.SQLSERVER_DOMAIN;
  }

  return config;
}

function postgresConnectionString() {
  return process.env.DATABASE_URL_UNPOOLED || required("DATABASE_URL");
}

function pgClient() {
  return new Client({
    connectionString: postgresConnectionString(),
    application_name: "osp-alerta-etl",
  });
}

function columnMap(rows) {
  return new Map(rows.map((row) => [String(row.COLUMN_NAME).toLowerCase(), String(row.COLUMN_NAME)]));
}

function quoted(name) {
  return `[${name.replaceAll("]", "]]")}]`;
}

function resolveColumn(columns, wanted, requiredColumn = true) {
  const actual = columns.get(wanted.toLowerCase());
  if (!actual && requiredColumn) {
    throw new Error(`Coluna obrigatória não encontrada na origem: ${wanted}`);
  }
  return actual || null;
}

function nullableString(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function nullableInteger(value) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function bigintValue(value) {
  if (value == null || value === "") return "0";
  if (typeof value === "bigint") return value.toString();
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "0";
  return Math.trunc(parsed).toString();
}

function normalizeRow(row, loadDate) {
  const hora = nullableInteger(row.hora);
  const produto = nullableInteger(row.produto);

  if (hora == null || hora < 0 || hora > 23) {
    throw new Error(`Hora inválida encontrada na origem: ${row.hora}`);
  }
  if (produto == null) {
    throw new Error("Produto nulo ou inválido encontrado na origem.");
  }

  return {
    data: loadDate,
    hora,
    servidor: nullableString(row.servidor),
    cliente: nullableString(row.cliente),
    agent_id: nullableInteger(row.agent_id),
    campaign_id: nullableInteger(row.campaign_id),
    disposition_id: nullableInteger(row.disposition_id),
    tabulacao: nullableString(row.tabulacao),
    nome_campanha: nullableString(row.nome_campanha),
    classificado: nullableString(row.classificado),
    quantidade: bigintValue(row.quantidade),
    segundos: bigintValue(row.segundos),
    produto,
  };
}

async function createRunLog(client, loadDate) {
  const result = await client.query(
    `INSERT INTO osp_alerta_etl_log(load_date,status,source_table,message)
     VALUES($1::date,'RUNNING',$2,'Extração iniciada')
     RETURNING id`,
    [loadDate, process.env.OSP_ALERTA_SOURCE_TABLE || SOURCE_TABLE_DEFAULT]
  );
  return result.rows[0].id;
}

async function finishRunLog(client, id, {
  status,
  loadDate,
  sourceRows = 0,
  insertedRows = 0,
  startedAt,
  message = null,
}) {
  const durationMs = Date.now() - startedAt;
  await client.query(
    `UPDATE osp_alerta_etl_log
     SET load_date=$2::date,
         finished_at=NOW(),
         status=$3,
         source_rows=$4,
         inserted_rows=$5,
         duration_ms=$6,
         message=$7
     WHERE id=$1`,
    [id, loadDate, status, sourceRows, insertedRows, durationMs, message]
  );
}

async function getSourceColumns(pool, source) {
  const request = pool.request();
  request.input("schema", sql.VarChar(128), source.schema);
  request.input("table", sql.VarChar(128), source.table);

  const result = await request.query(`
    SELECT COLUMN_NAME
    FROM ${quoted(source.database)}.INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA=@schema
      AND TABLE_NAME=@table
  `);

  if (!result.recordset.length) {
    throw new Error(
      `Tabela de origem não encontrada: ${source.database}.${source.schema}.${source.table}`
    );
  }

  return columnMap(result.recordset);
}

async function extractToday(pool, source) {
  const columns = await getSourceColumns(pool, source);

  const data = resolveColumn(columns, "DATA");
  const hora = resolveColumn(columns, "HORA");
  const agentId = resolveColumn(columns, "AgentId");
  const campaignId = resolveColumn(columns, "CampaignId");
  const dispositionId = resolveColumn(columns, "DispositionId");
  const tabulacao = resolveColumn(columns, "Tabulacao");
  const nomeCampanha = resolveColumn(columns, "NomeCampanha");
  const classificado = resolveColumn(columns, "Classificado");
  const quantidade = resolveColumn(columns, "Quantidade");
  const segundos = resolveColumn(columns, "Segundos");
  const produto = resolveColumn(columns, "Produto");

  const servidor = resolveColumn(columns, "Servidor", false);
  const cliente = resolveColumn(columns, "Cliente", false);

  if (!servidor || !cliente) {
    console.warn(
      "[ETL] Aviso: a origem ainda não possui todas as colunas Servidor/Cliente. " +
      "A carga será feita com NULL nesses campos até a tabela de origem ser ajustada."
    );
  }

  const qualifiedTable = [
    quoted(source.database),
    quoted(source.schema),
    quoted(source.table),
  ].join(".");

  const sourceDateResult = await pool.request().query(
    "SELECT CONVERT(char(10), CAST(GETDATE() AS date), 23) AS load_date"
  );
  const loadDate = sourceDateResult.recordset[0].load_date;

  const selectSql = `
    SELECT
      CAST(${quoted(data)} AS date) AS data,
      CAST(${quoted(hora)} AS int) AS hora,
      ${servidor ? `CAST(${quoted(servidor)} AS varchar(100))` : "CAST(NULL AS varchar(100))"} AS servidor,
      ${cliente ? `CAST(${quoted(cliente)} AS varchar(150))` : "CAST(NULL AS varchar(150))"} AS cliente,
      CAST(${quoted(agentId)} AS int) AS agent_id,
      CAST(${quoted(campaignId)} AS int) AS campaign_id,
      CAST(${quoted(dispositionId)} AS int) AS disposition_id,
      CAST(${quoted(tabulacao)} AS varchar(max)) AS tabulacao,
      CAST(${quoted(nomeCampanha)} AS varchar(255)) AS nome_campanha,
      CAST(${quoted(classificado)} AS varchar(50)) AS classificado,
      CAST(${quoted(quantidade)} AS bigint) AS quantidade,
      CAST(${quoted(segundos)} AS bigint) AS segundos,
      CAST(${quoted(produto)} AS int) AS produto
    FROM ${qualifiedTable} WITH (NOLOCK)
    WHERE ${quoted(data)} >= CAST(GETDATE() AS date)
      AND ${quoted(data)} < DATEADD(day,1,CAST(GETDATE() AS date));
  `;

  const result = await pool.request().query(selectSql);

  return {
    loadDate,
    query: selectSql,
    rows: result.recordset.map((row) => normalizeRow(row, loadDate)),
    hasServidor: Boolean(servidor),
    hasCliente: Boolean(cliente),
  };
}

async function insertBatch(client, rows) {
  if (!rows.length) return 0;

  const values = [];
  const tuples = rows.map((row) => {
    const start = values.length;
    values.push(
      row.data,
      row.hora,
      row.servidor,
      row.cliente,
      row.agent_id,
      row.campaign_id,
      row.disposition_id,
      row.tabulacao,
      row.nome_campanha,
      row.classificado,
      row.quantidade,
      row.segundos,
      row.produto
    );

    const p = Array.from({ length: 13 }, (_, index) => `$${start + index + 1}`);
    return `(${p.join(",")},NOW())`;
  });

  await client.query(
    `INSERT INTO osp_alerta(
       data,hora,servidor,cliente,agent_id,campaign_id,disposition_id,
       tabulacao,nome_campanha,classificado,quantidade,segundos,produto,data_hora_carga
     )
     VALUES ${tuples.join(",")}`,
    values
  );

  return rows.length;
}

async function replaceToday(client, loadDate, rows) {
  await client.query("BEGIN");
  try {
    await client.query("DELETE FROM osp_alerta WHERE data=$1::date", [loadDate]);

    let inserted = 0;
    for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
      inserted += await insertBatch(client, rows.slice(offset, offset + BATCH_SIZE));
    }

    await client.query("COMMIT");
    return inserted;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function main() {
  const startedAt = Date.now();
  const source = parseSourceTable();
  const pgDb = pgClient();
  let sqlPool;
  let logId = null;
  let loadDate = saoPauloDate();
  let sourceRows = 0;

  try {
    console.log("[ETL] OSP Alerta iniciado.");
    console.log(`[ETL] Origem: ${source.database}.${source.schema}.${source.table}`);

    await pgDb.connect();
    logId = await createRunLog(pgDb, loadDate);

    sqlPool = await sql.connect(sqlServerConfig(source.database));
    const extraction = await extractToday(sqlPool, source);
    loadDate = extraction.loadDate;
    sourceRows = extraction.rows.length;

    await pgDb.query(
      "UPDATE osp_alerta_etl_log SET load_date=$2::date,source_rows=$3 WHERE id=$1",
      [logId, loadDate, sourceRows]
    );

    console.log(`[ETL] Data de carga: ${loadDate}`);
    console.log(`[ETL] Registros extraídos: ${sourceRows}`);

    if (!sourceRows && !asBoolean(process.env.OSP_ALERTA_ALLOW_EMPTY_REPLACE, false)) {
      const message =
        "Origem retornou zero registros. A tabela PostgreSQL foi preservada para evitar perda de dados.";
      console.warn(`[ETL] ${message}`);
      await finishRunLog(pgDb, logId, {
        status: "EMPTY",
        loadDate,
        sourceRows,
        insertedRows: 0,
        startedAt,
        message,
      });
      return;
    }

    const insertedRows = await replaceToday(pgDb, loadDate, extraction.rows);

    const missingDimensions = [
      !extraction.hasServidor ? "Servidor" : null,
      !extraction.hasCliente ? "Cliente" : null,
    ].filter(Boolean);

    const message = missingDimensions.length
      ? `Carga concluída. Colunas ausentes na origem: ${missingDimensions.join(", ")}.`
      : "Carga concluída com sucesso.";

    await finishRunLog(pgDb, logId, {
      status: "SUCCESS",
      loadDate,
      sourceRows,
      insertedRows,
      startedAt,
      message,
    });

    console.log(`[ETL] PostgreSQL substituído com sucesso: ${insertedRows} registros.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[ETL] Falha:", message);

    if (logId != null) {
      try {
        await finishRunLog(pgDb, logId, {
          status: "FAILED",
          loadDate,
          sourceRows,
          insertedRows: 0,
          startedAt,
          message: message.slice(0, 4000),
        });
      } catch (logError) {
        console.error("[ETL] Não foi possível atualizar o log de falha:", logError);
      }
    }

    process.exitCode = 1;
  } finally {
    if (sqlPool) {
      try { await sqlPool.close(); } catch {}
    }
    try { await pgDb.end(); } catch {}
  }
}

await main();
