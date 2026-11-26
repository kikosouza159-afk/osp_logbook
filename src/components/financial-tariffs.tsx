"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Columns3, Download, Minus, Plus, RefreshCw, Search } from "lucide-react";
import {
  buildTariffLines, formatTariff, monthNames, productName, totalTariffLines,
  type TariffAmount, type TariffMetric, type TariffReport, type TariffLine,
} from "@/lib/financial-tariffs";
import { downloadTariffWorkbook, groupTariffClients } from "@/lib/financial-tariff-export";
import "./financial-tariffs.css";

const metricLabels = {cost: "Valor tarifado", calls: "Chamadas tarifadas", unit: "Custo por chamada"} as const;
const weekday = new Intl.DateTimeFormat("pt-BR", {weekday: "short", timeZone: "UTC"});
const fullDate = new Intl.DateTimeFormat("pt-BR", {dateStyle: "full", timeZone: "UTC"});
const pad = (n: number) => String(n).padStart(2, "0");
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const searchKey = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
const displayDate = (value?: string | null) => value ? value.split("-").reverse().join("/") : "—";
const projectFields = ["Condição", "Produto", "Responsável", "Status atual", "Início da POC", "Início de faturamento"];

type PeriodColumn = {key: string; kind: "month" | "day"; label: string; description: string; weekday?: string};

function periodColumns(year: number, first: number, expanded: string | null) {
  const columns: PeriodColumn[] = [];
  for (let month = first; month <= 12; month++) {
    const key = year + "-" + pad(month);
    const name = monthNames[month - 1];
    columns.push({key, kind: "month", label: capitalize(name), description: name + " de " + year});
    if (expanded !== key) continue;
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    for (let day = 1; day <= days; day++) {
      const date = Date.UTC(year, month - 1, day);
      columns.push({
        key: key + "-" + pad(day), kind: "day", label: pad(day) + "/" + pad(month),
        description: fullDate.format(date), weekday: weekday.format(date),
      });
    }
  }
  return columns;
}

function AmountCells({periods, columns, metric}: {
  periods: Map<string, TariffAmount>; columns: PeriodColumn[]; metric: TariffMetric;
}) {
  return <>
    <td className="tariff-number tariff-period-total">{formatTariff(periods.get("total"), metric)}</td>
    {columns.map(column => <td key={column.key}
      className={"tariff-number tariff-" + column.kind + (periods.has(column.key) ? "" : " tariff-missing")}>
      {formatTariff(periods.get(column.key), metric)}
    </td>)}
  </>;
}

export function FinancialTariffs({report}: {report: TariffReport | null}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [first, setFirst] = useState(report?.year === 2026 ? 4 : 1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [details, setDetails] = useState(false);
  const [openClients, setOpenClients] = useState<Set<string>>(() => new Set());
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [metric, setMetric] = useState<TariffMetric>("cost");
  const [search, setSearch] = useState("");
  const [agent, setAgent] = useState("");
  const [scope, setScope] = useState("");
  const tableRef = useRef<HTMLDivElement>(null);
  const year = report?.year ?? 0;
  const lines = useMemo(() => report ? buildTariffLines(report.projects, report.days, year + "-" + pad(first)) : [], [report, year, first]);
  const visible = useMemo(() => {
    const term = searchKey(search);
    return lines.filter(line => {
      if ((agent && line.agent !== agent) || (scope === "projects" && !line.project) || (scope === "unlinked" && line.project)) return false;
      const project = line.project;
      return !term || searchKey([line.client, project?.code, project?.name, project?.owner, project?.status].join(" ")).includes(term);
    });
  }, [lines, search, agent, scope]);
  const totals = useMemo(() => totalTariffLines(visible), [visible]);
  const clients = useMemo(() => groupTariffClients(visible), [visible]);
  const columns = useMemo(() => periodColumns(year, first, expanded), [year, first, expanded]);
  const products = useMemo(() => [...new Set(lines.map(line => line.agent))].sort(), [lines]);
  const lastDay = useMemo(() => report?.days.reduce((latest, row) => row.date > latest ? row.date : latest, ""), [report]);
  const projectCount = visible.filter(line => line.project).length;
  const unlinkedCount = visible.length - projectCount;
  const width = 2 + columns.length + (details ? projectFields.length : 0);

  useEffect(() => {
    const container = tableRef.current;
    if (!expanded || !container) return;
    const month = container.querySelector('thead button[aria-expanded="true"]');
    const identity = container.querySelector("thead .tariff-identity");
    if (month && identity) container.scrollLeft += month.getBoundingClientRect().left - identity.getBoundingClientRect().right;
  }, [expanded]);

  function collapseDays() {
    const header = tableRef.current?.querySelector<HTMLButtonElement>('thead button[aria-expanded="true"]');
    setExpanded(null);
    if (header) requestAnimationFrame(() => {
      header.focus({preventScroll: true});
      header.scrollIntoView({block: "nearest", inline: "center"});
    });
  }

  function toggleClient(key: string) {
    setOpenClients(previous => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function exportExcel() {
    setExportError("");
    setExporting(true);
    try {
      await downloadTariffWorkbook({clients, totals, year, first, metric, expanded, openClients});
    } catch {
      setExportError("Não foi possível exportar o Excel. Tente novamente.");
    } finally {
      setExporting(false);
    }
  }

  const refresh = <button type="button" className="btn btn-secondary" disabled={pending}
    onClick={() => startTransition(() => router.refresh())}>
    <RefreshCw size={15} aria-hidden="true"/>{pending ? "Atualizando…" : "Atualizar dados"}
  </button>;

  if (!report) return <section className="card tariff-error" role="alert">
    <p>Não foi possível carregar a tarifação mensal.</p>{refresh}
  </section>;

  return <section className="card tariff-card" aria-labelledby="tariff-heading" aria-busy={pending}>
    <header className="tariff-heading">
      <div><h2 id="tariff-heading">Consumo por cliente</h2><p>Expanda o cliente para ver os projetos e o mês para ver os dias.</p></div>
      <div className="tariff-update">{lastDay && <small>Dados até <b>{displayDate(lastDay)}</b></small>}{refresh}</div>
    </header>

    <div className="tariff-filters">
      <label className="tariff-find">Buscar projeto ou cliente<span>
        <Search size={16} aria-hidden="true"/><input className="input" type="search" value={search}
          placeholder="Nome ou ID do projeto" onChange={event => setSearch(event.target.value)}/></span></label>
      <label>Ano<select aria-label="Ano" className="select" value={year} disabled={pending} onChange={event => {
        const selected = event.target.value;
        startTransition(() => router.replace("/financeiro/tarifacao?ano=" + selected, {scroll: false}));
      }}>{report.years.map(y => <option key={y}>{y}</option>)}</select></label>
      <label>Mês inicial<select aria-label="Mês inicial" className="select" value={first} onChange={event => {
        setFirst(Number(event.target.value)); setExpanded(null);
      }}>{monthNames.map((name, i) => <option key={name} value={i + 1}>{capitalize(name)}</option>)}</select></label>
      <label>Produto<select aria-label="Produto" className="select" value={agent} onChange={event => setAgent(event.target.value)}>
        <option value="">Todos os produtos</option>{products.map(a => <option key={a} value={a}>{productName(a)}</option>)}
      </select></label>
      <label>Vínculo<select aria-label="Vínculo" className="select" value={scope} onChange={event => setScope(event.target.value)}>
        <option value="">Toda a tarifação</option><option value="projects">Projetos da matriz</option><option value="unlinked">Sem vínculo</option>
      </select></label>
    </div>

    <div className="tariff-toolbar">
      <div className="tariff-metrics" role="group" aria-label="Indicador da tabela">
        {(Object.keys(metricLabels) as TariffMetric[]).map(key => <button type="button" key={key}
          aria-pressed={metric === key} onClick={() => setMetric(key)}>{metricLabels[key]}</button>)}
      </div>
      <div className="tariff-tools">
        <button type="button" disabled={!clients.length || exporting} onClick={exportExcel}>
          <Download size={15} aria-hidden="true"/>{exporting ? "Exportando…" : "Exportar Excel (.xlsm)"}
        </button>
        <button type="button" disabled={!clients.length} onClick={() => setOpenClients(clients.every(c => openClients.has(c.key)) ? new Set() : new Set(clients.map(c => c.key)))}>
          {clients.length > 0 && clients.every(c => openClients.has(c.key)) ? <><Minus size={15}/>Recolher clientes</> : <><Plus size={15}/>Expandir clientes</>}
        </button>
        {expanded && <button type="button" onClick={collapseDays}><Minus size={15}/>Recolher dias</button>}
        <button type="button" aria-pressed={details} onClick={() => setDetails(!details)}>
          <Columns3 size={15} aria-hidden="true"/>{details ? "Ocultar cadastro" : "Exibir cadastro"}
        </button>
      </div>
    </div>

    {exportError && <p className="tariff-export-error" role="alert">{exportError}</p>}
    <div className="tariff-scroll" role="region" aria-label="Tabela de tarifação com rolagem horizontal"
      tabIndex={0} ref={tableRef}>
      <table className="tariff-table" aria-label={metricLabels[metric] + " por cliente, projeto e período, " + year}>
        <thead><tr>
          <th scope="col" className="tariff-identity">Cliente / Projeto</th>
          {details && projectFields.map(field => <th scope="col" className="tariff-meta" key={field}>{field}</th>)}
          <th scope="col" className="tariff-number tariff-period-total">Total do período</th>
          {columns.map(col => <th key={col.key} scope="col" className={"tariff-" + col.kind + (expanded === col.key ? " is-open" : "")}>
            {col.kind === "month" ? <button type="button" aria-expanded={expanded === col.key} title={capitalize(col.description)}
              aria-label={(expanded === col.key ? "Recolher" : "Expandir") + " dias de " + col.description}
              onClick={() => setExpanded(expanded === col.key ? null : col.key)}>
              <span className="tariff-month-long">{col.label}</span><span className="tariff-month-short">{col.label.slice(0, 3)}</span>
              {expanded === col.key ? <Minus size={13}/> : <Plus size={13}/>}
            </button> : <span aria-label={col.description}>{col.label}<small>{col.weekday}</small></span>}
          </th>)}
        </tr></thead>
        <tbody>
          {visible.length > 0 && <tr className="tariff-summary">
            <th className="tariff-identity" scope="row">Total da seleção</th>
            {details && <td colSpan={projectFields.length}/>}
            <AmountCells periods={totals} columns={columns} metric={metric}/>
          </tr>}
          {clients.map(client => <ClientRows key={client.key} client={client} open={openClients.has(client.key)}
            onToggle={() => toggleClient(client.key)} details={details} columns={columns} metric={metric}/>)}
          {!visible.length && <tr><td colSpan={width} className="tariff-no-results">
            Nenhum projeto ou origem corresponde à seleção.
          </td></tr>}
        </tbody>
      </table>
    </div>
    <footer className="tariff-footer">
      <span aria-live="polite">{clients.length} clientes · {projectCount} {projectCount === 1 ? "projeto" : "projetos"} · {unlinkedCount} {unlinkedCount === 1 ? "origem sem vínculo" : "origens sem vínculo"}</span>
      <span><CalendarDays size={14} aria-hidden="true"/>{metric === "unit" ? "Custo total ÷ chamadas. Traço indica ausência de dados ou de chamadas." : "Traço indica ausência de registro. Zero indica consumo registrado com valor zero."}</span>
    </footer>
  </section>;
}

function ClientRows({client, open, onToggle, details, columns, metric}: {
  client: ReturnType<typeof groupTariffClients>[number]; open: boolean; onToggle: () => void;
  details: boolean; columns: PeriodColumn[]; metric: TariffMetric;
}) {
  return <>
    <tr className="tariff-client">
      <th scope="row" className="tariff-identity">
        <button type="button" className="tariff-client-toggle" aria-expanded={open} onClick={onToggle}>
          {open ? <Minus size={15}/> : <Plus size={15}/>}
          <span><strong>{client.name}</strong><small>{client.lines.length} {client.lines.length === 1 ? "item" : "itens"}</small></span>
        </button>
      </th>
      {details && <td colSpan={projectFields.length}/>}
      <AmountCells periods={client.periods} columns={columns} metric={metric}/>
    </tr>
    {open && client.lines.map((line: TariffLine) => {
            const project = line.project;
            return <tr className="tariff-project" key={line.key}>
              <th scope="row" className="tariff-identity">
                <span className="tariff-code">{project?.code ?? "Sem vínculo"}<span> · {productName(line.agent)}</span></span>
                <strong>{project?.name ?? line.client}</strong>{project && <small>{line.client}</small>}
              </th>
              {details && <>
                <td className="tariff-meta">{project?.condition ?? "—"}</td><td className="tariff-meta">{productName(line.agent)}</td>
                <td className="tariff-meta">{project?.owner ?? "—"}</td><td className="tariff-meta">
                  {project && <span className="tariff-status" data-status={project.status}>{project.status}</span>}
                  {!project && "—"}</td>
                <td className="tariff-meta">{displayDate(project?.pocStart)}</td>
                <td className="tariff-meta">{displayDate(project?.billingStart)}</td>
              </>}
              <AmountCells periods={line.periods} columns={columns} metric={metric}/>
            </tr>;
          })}
  </>;
}
