export function StatusBadge({ code, label }: { code: string; label?: string }) {
  return <span className={`badge ${code}`}>{label || code.replaceAll("_", " ")}</span>;
}
