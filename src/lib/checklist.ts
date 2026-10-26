export type ChecklistItemDefinition = {
  key: string;
  action: string;
  validation?: string;
  detail?: string;
};

export const CHECKLIST_ITEMS: ChecklistItemDefinition[] = [
  { key: "mailing", action: "Mailing", validation: "Importação de mailing" },
  { key: "campanhas", action: "Campanhas", validation: "Plano de tabulação", detail: "Anunciadora / Silence / Outros" },
  { key: "rotas", action: "Rotas", validation: "LCR / SIPADA" },
  { key: "recurso_midia_vpl", action: "Recurso de mídia / VPL" },
  { key: "campanha_receptiva", action: "Campanha receptiva", validation: "Transferência" },
  { key: "calculo_demanda", action: "Cálculo de demanda" },
  { key: "monitoramento", action: "Monitoramento", validation: "Agente Logado", detail: "AD e Humano" },
  { key: "mailing_ativo", action: "Mailing Ativo" },
  { key: "ocupacao_canais", action: "Ocupação de canais", validation: "Trava PDM" },
  { key: "sem_tabulacao", action: "% Sem tabulação / No Disposition" },
  { key: "hangup", action: "Hangup" },
  { key: "classificacoes", action: "Classificações em Geral" },
  { key: "transferencia_chamada", action: "Transferência de chamada" },
  { key: "tabulacao_agente", action: "Tabulação do Agente" },
  { key: "gravacoes", action: "Gravações", validation: "Vocalizou as variáveis", detail: "Nome / CPF / 0800" },
  { key: "reconhecimento_voz", action: "Reconhecimento de voz / Fluidez" },
  { key: "ruidos_picotes", action: "Ruídos e picotes" },
  { key: "painel_gestor", action: "Painel Gestor", validation: "Validar os dados", detail: "Histórico e D-1" },
  { key: "gerar_fechamento", action: "Gerar fechamento", validation: "Envio no grupo" },
];
