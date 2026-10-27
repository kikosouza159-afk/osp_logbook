"use client";

import { Trash2 } from "lucide-react";
import { deleteClientAction } from "@/app/actions";

export function DeleteClientButton({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  return (
    <form
      action={deleteClientAction}
      className="client-delete-form"
      onSubmit={(event) => {
        const confirmed = window.confirm(
          `Excluir "${clientName}" da operação? O cliente deixará de aparecer nos fluxos ativos, mas o histórico já registrado será preservado.`
        );
        if (!confirmed) event.preventDefault();
      }}
    >
      <input type="hidden" name="client_id" value={clientId}/>
      <button
        className="btn client-delete-btn"
        type="submit"
        title={`Excluir ${clientName}`}
        aria-label={`Excluir cliente ${clientName}`}
      >
        <Trash2 size={14}/>
        Excluir
      </button>
    </form>
  );
}
