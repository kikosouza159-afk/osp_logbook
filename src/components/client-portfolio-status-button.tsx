"use client";

import { useState } from "react";
import { CirclePause, Play, X } from "lucide-react";
import { setClientPortfolioStatusAction } from "@/app/actions";
import { CLIENT_PORTFOLIO_INACTIVE_REASONS } from "@/lib/client-portfolio-status";

export function ClientPortfolioStatusButton({
  portfolioId,
  clientName,
  productCode,
  active,
}: {
  portfolioId:string;
  clientName:string;
  productCode:string;
  active:boolean;
}) {
  const [open,setOpen]=useState(false);

  if (!active) {
    return <form action={setClientPortfolioStatusAction}>
      <input type="hidden" name="portfolio_id" value={portfolioId}/>
      <input type="hidden" name="target_active" value="true"/>
      <button
        className="btn client-reactivate-btn"
        type="submit"
        title={`Reativar ${clientName} · ${productCode}`}
      >
        <Play size={14}/> Reativar
      </button>
    </form>;
  }

  return <>
    <button
      className="btn client-pause-btn"
      type="button"
      onClick={()=>setOpen(true)}
      title={`Desativar ${clientName} · ${productCode}`}
    >
      <CirclePause size={14}/> Desativar
    </button>

    {open && <div
      className="portfolio-status-modal-backdrop"
      role="presentation"
      onMouseDown={(event)=>{
        if (event.currentTarget===event.target) setOpen(false);
      }}
    >
      <section
        className="portfolio-status-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`portfolio-status-title-${portfolioId}`}
      >
        <div className="portfolio-status-modal-head">
          <div>
            <span className="portfolio-status-kicker">Status operacional</span>
            <h3 id={`portfolio-status-title-${portfolioId}`}>Desativar carteira</h3>
            <p><strong>{clientName}</strong> · {productCode}</p>
          </div>
          <button
            className="portfolio-status-close"
            type="button"
            aria-label="Fechar"
            onClick={()=>setOpen(false)}
          >
            <X size={17}/>
          </button>
        </div>

        <form action={setClientPortfolioStatusAction}>
          <input type="hidden" name="portfolio_id" value={portfolioId}/>
          <input type="hidden" name="target_active" value="false"/>

          <div className="field">
            <label>Justificativa *</label>
            <select className="select" name="inactive_reason_code" defaultValue="" required>
              <option value="" disabled>Selecione o motivo da paralisação</option>
              {CLIENT_PORTFOLIO_INACTIVE_REASONS.map(reason=>
                <option key={reason.code} value={reason.code}>{reason.label}</option>
              )}
            </select>
          </div>

          <div className="portfolio-status-warning">
            Esta carteira deixará de entrar no cálculo percentual do Checklist e não aparecerá em novos registros operacionais enquanto estiver inativa.
          </div>

          <div className="portfolio-status-modal-actions">
            <button className="btn btn-secondary" type="button" onClick={()=>setOpen(false)}>
              Cancelar
            </button>
            <button className="btn client-pause-confirm" type="submit">
              <CirclePause size={15}/> Confirmar desativação
            </button>
          </div>
        </form>
      </section>
    </div>}
  </>;
}
