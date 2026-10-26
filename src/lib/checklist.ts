export type ChecklistActionKey =
  | "mailing"
  | "campanhas"
  | "monitoramento"
  | "gravacoes"
  | "painel_gestor";

export type ChecklistItemDefinition = {
  key: string;
  actionKey: ChecklistActionKey;
  action: string;
  validation: string;
};

export const CHECKLIST_ACTIONS: Array<{ key:ChecklistActionKey; label:string }> = [
  { key:"mailing", label:"Mailing" },
  { key:"campanhas", label:"Campanhas" },
  { key:"monitoramento", label:"Monitoramento" },
  { key:"gravacoes", label:"Gravações" },
  { key:"painel_gestor", label:"Painel Gestor" },
];

export const CHECKLIST_ITEMS: ChecklistItemDefinition[] = [
  { key:"mailing", actionKey:"mailing", action:"Mailing", validation:"Importação de mailling" },

  { key:"campanhas", actionKey:"campanhas", action:"Campanhas", validation:"Plano de tabulação" },
  { key:"rotas", actionKey:"campanhas", action:"Campanhas", validation:"Rotas" },
  { key:"recurso_midia_vpl", actionKey:"campanhas", action:"Campanhas", validation:"Recurso de mídia / VPL" },
  { key:"campanha_receptiva", actionKey:"campanhas", action:"Campanhas", validation:"Campanha receptiva" },
  { key:"calculo_demanda", actionKey:"campanhas", action:"Campanhas", validation:"Cálculo de demanda" },

  { key:"monitoramento", actionKey:"monitoramento", action:"Monitoramento", validation:"Agente Logado" },
  { key:"mailing_ativo", actionKey:"monitoramento", action:"Monitoramento", validation:"Mailing Ativo" },
  { key:"ocupacao_canais", actionKey:"monitoramento", action:"Monitoramento", validation:"Ocupação de canais" },
  { key:"sem_tabulacao", actionKey:"monitoramento", action:"Monitoramento", validation:"% Sem tabulação / No Disposition" },
  { key:"hangup", actionKey:"monitoramento", action:"Monitoramento", validation:"Hangup" },
  { key:"classificacoes", actionKey:"monitoramento", action:"Monitoramento", validation:"Classificações em Geral" },
  { key:"transferencia_chamada", actionKey:"monitoramento", action:"Monitoramento", validation:"Transferência de chamada" },
  { key:"tabulacao_agente", actionKey:"monitoramento", action:"Monitoramento", validation:"Tabulação do Agente" },

  { key:"gravacoes", actionKey:"gravacoes", action:"Gravações", validation:"Vocalizou as variáveis" },
  { key:"reconhecimento_voz", actionKey:"gravacoes", action:"Gravações", validation:"Reconhecimento de voz / Fluidez" },
  { key:"ruidos_picotes", actionKey:"gravacoes", action:"Gravações", validation:"Ruídos e picotes" },

  { key:"painel_gestor", actionKey:"painel_gestor", action:"Painel Gestor", validation:"Validar os dados" },
  { key:"gerar_fechamento", actionKey:"painel_gestor", action:"Painel Gestor", validation:"Gerar fechamento" },
];
