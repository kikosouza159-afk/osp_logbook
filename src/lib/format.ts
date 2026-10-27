export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}


export function formatClientProducts(value: string | null | undefined) {
  if (!value) return "Sem produto";
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((code) => code.toUpperCase() === "LOCATOR" ? "Locator" : code.toUpperCase())
    .join(" + ");
}

export function clientOptionLabel(name: string, products: string | null | undefined) {
  return `${name} · ${formatClientProducts(products)}`;
}
