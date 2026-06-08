import type { LucideIcon } from "lucide-react";

interface MetricTileProps {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: "blue" | "green" | "amber" | "red" | "slate";
}

const tones = {
  blue: "text-blue-300 bg-blue-400/10 border-blue-300/15",
  green: "text-emerald-300 bg-emerald-400/10 border-emerald-300/15",
  amber: "text-amber-300 bg-amber-400/10 border-amber-300/15",
  red: "text-red-300 bg-red-400/10 border-red-300/15",
  slate: "text-slate-300 bg-slate-800 border-white/10"
};

export function MetricTile({ icon: Icon, label, value, tone = "slate" }: MetricTileProps) {
  return (
    <div className={`min-h-[82px] rounded-lg border p-3 ${tones[tone]}`}>
      <div className="flex items-center gap-2 text-xs">
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </div>
      <div className="mt-3 text-2xl font-semibold leading-none text-white">{value}</div>
    </div>
  );
}
