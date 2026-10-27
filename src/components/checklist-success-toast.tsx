"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

export function ChecklistSuccessToast() {
  const [visible,setVisible] = useState(true);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("saved")) {
      url.searchParams.delete("saved");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }

    const timer = window.setTimeout(() => setVisible(false), 2000);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return <div className="checklist-success-toast" role="status" aria-live="polite">
    <span className="checklist-success-toast-icon"><CheckCircle2 size={18}/></span>
    <div>
      <strong>Checklist cadastrado</strong>
      <span>As alterações foram salvas com sucesso.</span>
    </div>
  </div>;
}
