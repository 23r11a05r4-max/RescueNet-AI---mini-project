import { TrendUp, UserFocus, Clock, Target } from "@phosphor-icons/react";

const cards = [
  { key: "total_active", label: "Active Cases", icon: UserFocus, color: "text-blue-400", format: v => v ?? 0 },
  { key: "total_recovered", label: "Recovered", icon: TrendUp, color: "text-emerald-400", format: v => v ?? 0 },
  { key: "recovery_rate", label: "Recovery Rate", icon: Target, color: "text-cyan-400", format: v => `${v ?? 0}%` },
  { key: "avg_investigation_hours", label: "Avg Duration", icon: Clock, color: "text-amber-400", format: v => `${v ?? 0}h` },
];

const chips = [
  { key: "cases_today", label: "Today" },
  { key: "cases_this_week", label: "7 days" },
  { key: "cases_this_month", label: "30 days" },
  { key: "total_cases", label: "All time" },
];

export default function StatsCards({ data }) {
  return (
    <div className="space-y-3" data-testid="stats-cards">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => {
          const Icon = c.icon;
          return (
            <div key={c.key} data-testid={`stat-${c.key}`} className="border border-slate-800 rounded-md bg-slate-900 p-5 relative overflow-hidden">
              <div className="flex items-start justify-between mb-4">
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold">{c.label}</div>
                <Icon size={16} className={c.color} weight="duotone" />
              </div>
              <div className={`font-display text-4xl sm:text-5xl font-black tracking-tighter ${c.color}`}>
                {c.format(data?.[c.key])}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        {chips.map(c => (
          <div key={c.key} className="border border-slate-800 rounded-md bg-slate-900 px-3 py-1.5 flex items-center gap-2 text-xs">
            <span className="text-slate-500 uppercase tracking-wider text-[10px]">{c.label}</span>
            <span className="font-mono font-semibold text-white" data-testid={`chip-${c.key}`}>{data?.[c.key] ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
