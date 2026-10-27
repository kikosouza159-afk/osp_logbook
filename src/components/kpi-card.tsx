import type { LucideIcon } from "lucide-react";

export function KpiCard({ label, value, icon: Icon }: { label: string; value: number | string; icon: LucideIcon }) {
  return <article className="card kpi elite-kpi">
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
