"use client";

import { Trash2 } from "lucide-react";
import { deleteIncidentAction } from "@/app/actions";

export function DeleteIncidentButton({
  incidentId,
  incidentTitle,
}: {
  incidentId: string;
  incidentTitle: string;
}) {
  return (
    <form
      action={deleteIncidentAction}
      className="client-delete-form"
      onSubmit={(event) => {
        const confirmed = window.confirm(
          `Excluir definitivamente o incidente "${incidentTitle}"? A timeline, os produtos vinculados e as respostas desse incidente também serão removidos.`
        );
        if (!confirmed) event.preventDefault();
      }}
    >
      <input type="hidden" name="incident_id" value={incidentId}/>
      <button
        className="btn client-delete-btn"
        type="submit"
        title={`Excluir ${incidentTitle}`}
        aria-label={`Excluir incidente ${incidentTitle}`}
      >
        <Trash2 size={14}/>
        Excluir
      </button>
    </form>
  );
}
