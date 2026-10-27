import type { LucideIcon } from "lucide-react";

function toneForLabel(label:string) {
  const value = label.toLowerCase();
  if (value.includes("resolvid")) return "success";
  if (value.includes("aguard")) return "warning";
  if (value.includes("abert")) return "danger";
  if (value.includes("tratativa")) return "blue";
  if (value.includes("locator")) return "blue";
  if (value.includes("ada")) return "orange";
  if (value.includes("cliente")) return "violet";
  return "navy";
}

export function KpiCard({ label, value, icon: Icon }: { label: string; value: number | string; icon: LucideIcon }) {
  const tone = toneForLabel(label);
  return <article className={`card kpi elite-kpi tone-${tone}`}>
    <div className="elite-kpi-accent" aria-hidden="true"/>
    <div className="kpi-top">
      <span>{label}</span>
      <span className="kpi-icon"><Icon size={18}/></span>
    </div>
    <div className="kpi-value metric">{value}</div>
    <div className="elite-kpi-footer">
      <span className="elite-kpi-pulse"><i/>LIVE</span>
      <span className="elite-kpi-lines" aria-hidden="true"><i/><i/><i/><i/><i/></span>
    </div>
  </article>;
}
