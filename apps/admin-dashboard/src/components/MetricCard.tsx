import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  accent: "green" | "blue" | "amber" | "red";
  suffix?: string;
}

const accentMap = {
  green: "text-emerald-300 bg-emerald-400/12 ring-emerald-400/20",
  blue: "text-sky-300 bg-sky-400/12 ring-sky-400/20",
  amber: "text-amber-300 bg-amber-400/12 ring-amber-400/20",
  red: "text-red-300 bg-red-400/12 ring-red-400/20"
};

export function MetricCard({ icon: Icon, label, value, accent, suffix }: MetricCardProps) {
  return (
    <section className="rounded-lg border border-white/10 bg-slate-950/70 p-4 shadow-panel">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-slate-400">{label}</span>
        <span className={`grid h-9 w-9 place-items-center rounded-md ring-1 ${accentMap[accent]}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div className="mt-3 flex items-end gap-1">
        <strong className={`text-3xl font-semibold leading-none ${accentMap[accent].split(" ")[0]}`}>{value}</strong>
        {suffix ? <span className="pb-1 text-sm text-slate-500">{suffix}</span> : null}
      </div>
    </section>
  );
}
