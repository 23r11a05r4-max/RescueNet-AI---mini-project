import { Folder, FolderOpen, MagnifyingGlass, CheckCircle, Archive, Target, Clock } from "@phosphor-icons/react";

const cards = [
  { key: "total_cases", label: "Total Cases", icon: Folder, color: "text-slate-300", format: v => v ?? 0 },
  { key: "open_cases", label: "Open Cases", icon: FolderOpen, color: "text-blue-400", format: v => v ?? 0 },
  { key: "investigation_cases", label: "Investigation", icon: MagnifyingGlass, color: "text-amber-400", format: v => v ?? 0 },
  { key: "resolved_cases", label: "Resolved", icon: CheckCircle, color: "text-emerald-400", format: v => v ?? 0 },
  { key: "closed_cases", label: "Closed", icon: Archive, color: "text-slate-500", format: v => v ?? 0 },
];

export default function StatsCards({ data }) {
  return (
    <div className="space-y-4" data-testid="stats-cards">
      {/* 5 Core Dashboard Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map(c => {
          const Icon = c.icon;
          return (
            <div key={c.key} data-testid={`stat-${c.key}`} className="border border-slate-800 rounded-md bg-slate-900 p-4 relative overflow-hidden flex flex-col justify-between min-h-[110px]">
              <div className="flex items-start justify-between">
                <div className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-bold">{c.label}</div>
                <Icon size={16} className={c.color} weight="duotone" />
              </div>
              <div className={`font-display text-3xl sm:text-4xl font-black tracking-tighter mt-2 ${c.color}`}>
                {c.format(data?.[c.key])}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sub-metrics & AI Priorities Row */}
      <div className="flex flex-wrap gap-3 items-center pt-1">
        <div className="border border-slate-800 rounded-md bg-slate-900 px-3 py-1.5 flex items-center gap-2 text-xs">
          <Target size={14} className="text-cyan-400" />
          <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">Recovery Rate:</span>
          <span className="font-mono font-bold text-cyan-400">{data?.recovery_rate ?? 0}%</span>
        </div>
        <div className="border border-slate-800 rounded-md bg-slate-900 px-3 py-1.5 flex items-center gap-2 text-xs">
          <Clock size={14} className="text-pink-400" />
          <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">Avg Duration:</span>
          <span className="font-mono font-bold text-pink-400">{data?.avg_investigation_hours ?? 0}h</span>
        </div>

        <div className="h-4 w-[1px] bg-slate-800 mx-1 hidden sm:block" />

        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mr-1">AI Risk Priorities:</span>
        <div className="border border-slate-800 rounded-md bg-slate-900 px-2.5 py-1.5 flex items-center gap-2 text-xs">
          <span className="text-red-400 uppercase tracking-wider text-[9px] font-bold">Critical</span>
          <span className="font-mono font-black text-white">{data?.by_priority?.Critical ?? 0}</span>
        </div>
        <div className="border border-slate-800 rounded-md bg-slate-900 px-2.5 py-1.5 flex items-center gap-2 text-xs">
          <span className="text-orange-400 uppercase tracking-wider text-[9px] font-bold">High</span>
          <span className="font-mono font-black text-white">{data?.by_priority?.High ?? 0}</span>
        </div>
        <div className="border border-slate-800 rounded-md bg-slate-900 px-2.5 py-1.5 flex items-center gap-2 text-xs">
          <span className="text-amber-400 uppercase tracking-wider text-[9px] font-bold">Medium</span>
          <span className="font-mono font-black text-white">{data?.by_priority?.Medium ?? 0}</span>
        </div>
        <div className="border border-slate-800 rounded-md bg-slate-900 px-2.5 py-1.5 flex items-center gap-2 text-xs">
          <span className="text-slate-400 uppercase tracking-wider text-[9px] font-bold">Low</span>
          <span className="font-mono font-black text-white">{data?.by_priority?.Low ?? 0}</span>
        </div>
      </div>
    </div>
  );
}
