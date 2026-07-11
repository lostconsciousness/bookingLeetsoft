type Props = {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "positive" | "warning";
};

export function StatCard({ label, value, hint, tone = "default" }: Props) {
  return (
    <div className={`surface p-5 ${tone === "positive" ? "border-accent-200 bg-accent-50/60" : tone === "warning" ? "border-amber-200 bg-amber-50/50" : ""}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
      {hint ? <p className="mt-2 text-sm text-slate-500">{hint}</p> : null}
    </div>
  );
}
