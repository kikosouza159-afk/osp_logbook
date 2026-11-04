"use client";

import { useMemo, useState } from "react";
import {
  RadioTower,
  Target,
  Sparkles,
  Code2,
  Network,
  Waves,
  MessageSquareWarning,
  GitBranch,
  CircleAlert,
  Braces,
  Route,
  Cable,
  Ellipsis,
  Volume2,
  Tags,
  CircleHelp,
  Workflow,
  MessageSquareText,
  CircleStop,
  Repeat2,
  Webhook,
  Bot,
  ListChecks,
  ArrowRightLeft,
  Check
} from "lucide-react";

type Area = {
  code:string;
  name:string;
};

type ProblemType = {
  code:string;
  area_code:string;
  label:string;
};

const areaMeta = {
  OSP: {
    icon: Target,
    kicker:"Planejamento Estratégico",
    description:"Mailing, campanhas, pilotagem e continuidade operacional.",
  },
  OTS: {
    icon: RadioTower,
    kicker:"Telecom",
    description:"Telefonia, rede, análise de chamada e canais.",
  },
  OPC: {
    icon: Sparkles,
    kicker:"Curadoria",
    description:"Voz, entendimento, tabulação, fraseologia e jornada.",
  },
  ODE: {
    icon: Code2,
    kicker:"Desenvolvimento",
    description:"Fluxos, integrações, regras e transferência.",
  },
} as const;

const problemIcons: Record<string, React.ComponentType<{size?:number}>> = {
  OSP_MAILING: Tags,
  OSP_FILA_PARADA: CircleStop,
  OSP_CONFIG_CAMPANHA: ListChecks,
  OSP_PILOTAGEM: Target,
  OTS_CONGESTIONAMENTO: Network,
  OTS_CALLANLYSE: Waves,
  OTS_IMPOSSIVEL_COMPLETAR: MessageSquareWarning,
  OTS_LINHA_MUD: GitBranch,
  OTS_RUIDO: Volume2,
  OTS_CANAIS: Cable,
  OTS_OUTROS: Ellipsis,

  OPC_VOZES: Volume2,
  OPC_TABULACAO_INCORRETA: Tags,
  OPC_FALHA_ENTENDIMENTO: CircleHelp,
  OPC_FLUXO_INCORRETO: Workflow,
  OPC_FRASEOLOGIA_JORNADA: MessageSquareText,
  OPC_INTERRUPCAO: CircleStop,
  OPC_OUTROS: Ellipsis,

  ODE_ALTERACAO_FLUXO: GitBranch,
  ODE_REPETICAO: Repeat2,
  ODE_FALHA_INTEGRACAO: Webhook,
  ODE_AISM: Bot,
  ODE_ERRO_TABULACAO: ListChecks,
  ODE_ERRO_FLUXO: Route,
  ODE_FALHA_TRANSFERENCIA: ArrowRightLeft,
  ODE_OUTROS: Braces,
};

export function IncidentClassificationSelector({
  areas,
  problemTypes,
  defaultArea="",
  defaultProblem="",
}:{
  areas:Area[];
  problemTypes:ProblemType[];
  defaultArea?:string;
  defaultProblem?:string;
}) {
  const validDefaultArea = areas.some(area=>area.code===defaultArea) ? defaultArea : "";
  const validDefaultProblem = problemTypes.some(problem=>problem.code===defaultProblem && problem.area_code===validDefaultArea)
    ? defaultProblem
    : "";

  const [area,setArea]=useState(validDefaultArea);
  const [problem,setProblem]=useState(validDefaultProblem);

  const visibleProblems=useMemo(
    ()=>problemTypes.filter(item=>item.area_code===area),
    [problemTypes,area]
  );

  return <div className="incident-classification-shell">
    <div className="incident-classification-head">
      <div>
        <span className="incident-classification-kicker">Classificação inteligente</span>
        <strong>Área Responsável</strong>
        <p>Selecione primeiro a frente responsável. Em seguida, escolha o tipo de problema.</p>
      </div>
      <div className="incident-classification-step">01 / 02</div>
    </div>

    <div className="incident-area-grid" role="radiogroup" aria-label="Área responsável">
      {areas.map(item=>{
        const meta=areaMeta[item.code as keyof typeof areaMeta];
        const Icon=meta?.icon ?? CircleAlert;
        const active=area===item.code;
        return <label className={`incident-area-card ${active ? "selected" : ""}`} key={item.code}>
          <input
            type="radio"
            name="area"
            value={item.code}
            checked={active}
            required
            onChange={()=>{
              setArea(item.code);
              setProblem("");
            }}
          />
          <span className="incident-area-card-icon"><Icon size={22}/></span>
          <span className="incident-area-card-copy">
            <small>{meta?.kicker ?? item.name} ({item.code})</small>
            <strong>{item.name}</strong>
            <span>{meta?.description ?? "Classificação do incidente."}</span>
          </span>
          <span className="incident-area-card-check"><Check size={13}/></span>
        </label>;
      })}
    </div>

    <div className={`incident-problem-panel ${area ? "ready" : ""}`}>
      <div className="incident-classification-head compact">
        <div>
          <span className="incident-classification-kicker">Tipo do incidente</span>
          <strong>{area ? "Qual problema foi identificado?" : "Selecione uma área acima"}</strong>
          <p>{area ? "O tipo selecionado será salvo separadamente para filtros, histórico e indicadores." : "Os problemas serão carregados de acordo com a área responsável."}</p>
        </div>
        <div className="incident-classification-step">02 / 02</div>
      </div>

      {area ? <div className="incident-problem-grid" role="radiogroup" aria-label="Tipo de problema">
        {visibleProblems.map(item=>{
          const Icon=problemIcons[item.code] ?? CircleAlert;
          const active=problem===item.code;
          return <label className={`incident-problem-card ${active ? "selected" : ""}`} key={item.code}>
            <input
              type="radio"
              name="problem_type"
              value={item.code}
              checked={active}
              required
              onChange={()=>setProblem(item.code)}
            />
            <span className="incident-problem-icon"><Icon size={17}/></span>
            <span>{item.label}</span>
            <span className="incident-problem-check"><Check size={11}/></span>
          </label>;
        })}
      </div> : <div className="incident-problem-empty">
        <CircleAlert size={20}/>
        <span>Escolha Telecom, Curadoria ou Desenvolvimento para abrir a matriz de problemas.</span>
      </div>}
    </div>
  </div>;
}
