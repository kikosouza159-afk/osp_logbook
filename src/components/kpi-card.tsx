import type { LucideIcon } from "lucide-react";

export function KpiCard({ label, value, icon: Icon }: { label: string; value: number | string; icon: LucideIcon }) {
  return <div className="card kpi"><div className="kpi-top"><span>{label}</span><span className="kpi-icon"><Icon size={18}/></span></div><div className="kpi-value metric">{value}</div></div>;
}
