export const CLIENT_PORTFOLIO_INACTIVE_REASONS = [
  { code:"CLIENT_STRATEGY", label:"Paralisado por Estratégia do cliente" },
  { code:"POC_CANCELLED", label:"POC Cancelado" },
  { code:"POC_COMPLETED", label:"POC Finalizado" },
  { code:"RESULTS_REVIEW", label:"Apuração dos Resultados" },
] as const;

export type ClientPortfolioInactiveReasonCode =
  typeof CLIENT_PORTFOLIO_INACTIVE_REASONS[number]["code"];

export function clientPortfolioInactiveReasonLabel(code:string|null|undefined) {
  if (!code) return null;
  return CLIENT_PORTFOLIO_INACTIVE_REASONS.find(item=>item.code===code)?.label ?? code;
}
