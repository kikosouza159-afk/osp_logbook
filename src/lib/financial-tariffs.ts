export type TariffProject = {
  code: string;
  name: string;
  client: string;
  agent: string;
  condition: string;
  owner: string;
  status: string;
  pocStart: string | null;
  billingStart: string | null;
};

export type TariffDay = {
  date: string;
  code: string | null;
  unlinkedClient: string | null;
  agent: string;
  costUnits: string;
  calls: string;
};

export type TariffReport = { year: number; years: number[]; projects: TariffProject[]; days: TariffDay[] };
export type TariffMetric = "cost" | "calls" | "unit";
export type TariffAmount = { cost: bigint; calls: bigint };
export type TariffLine = {
  key: string;
  project?: TariffProject;
  client: string;
  agent: string;
  periods: Map<string, TariffAmount>;
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const unitCurrency = new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL", minimumFractionDigits: 4, maximumFractionDigits: 4,
});
const count = new Intl.NumberFormat("pt-BR");
export const monthNames = Array.from({length: 12}, (_, i) =>
  new Intl.DateTimeFormat("pt-BR", {month: "long", timeZone: "UTC"}).format(Date.UTC(2000, i, 1))
);
export const productName = (agent: string) => agent === "4" ? "Locator" : agent === "5" ? "ADA" : "Tipo " + agent;

// The billing source retains eight decimal places. Round once, when displaying a cell.
function roundedRatio(value: bigint, divisor: bigint) {
  const half = divisor / 2n;
  return Number((value < 0n ? value - half : value + half) / divisor);
}

export function formatTariff(amount: TariffAmount | undefined, metric: TariffMetric) {
  if (!amount) return "—";
  if (metric === "calls") return count.format(amount.calls);
  if (metric === "unit") {
    return amount.calls > 0n ? unitCurrency.format(roundedRatio(amount.cost, 10_000n * amount.calls) / 10_000) : "—";
  }
  return currency.format(roundedRatio(amount.cost, 1_000_000n) / 100);
}

function accumulate(periods: Map<string, TariffAmount>, key: string, value: TariffAmount) {
  const previous = periods.get(key);
  if (previous) {
    previous.cost += value.cost;
    previous.calls += value.calls;
  } else {
    periods.set(key, { ...value });
  }
}

export function buildTariffLines(projects: TariffProject[], days: TariffDay[], firstMonth: string) {
  const lines = new Map<string, TariffLine>(projects.map(project => [
    project.code, { key: project.code, project, client: project.client, agent: project.agent, periods: new Map() },
  ]));
  for (const day of days) {
    const month = day.date.slice(0, 7);
    if (month < firstMonth) continue;
    const key = day.code ?? JSON.stringify([day.unlinkedClient, day.agent]);
    let line = lines.get(key);
    if (!line) {
      line = { key, client: day.unlinkedClient ?? "Origem sem identificação", agent: day.agent, periods: new Map() };
      lines.set(key, line);
    }
    const value = { cost: BigInt(day.costUnits), calls: BigInt(day.calls) };
    accumulate(line.periods, day.date, value);
    accumulate(line.periods, month, value);
    accumulate(line.periods, "total", value);
  }
  return [...lines.values()].sort((a, b) =>
    Number(!a.project) - Number(!b.project) || a.client.localeCompare(b.client, "pt-BR") ||
    a.key.localeCompare(b.key, "pt-BR"));
}

export function totalTariffLines(lines: TariffLine[]) {
  const totals = new Map<string, TariffAmount>();
  for (const line of lines) {
    for (const [key, value] of line.periods) accumulate(totals, key, value);
  }
  return totals;
}
