import { Users, Buildings, HandHeart, Camera, Microphone, Timer } from "@phosphor-icons/react";

const rows = [
  { key: "total_users", label: "Registered Users", icon: Users, color: "text-blue-400" },
  { key: "police_stations", label: "Police Stations", icon: Buildings, color: "text-cyan-400" },
  { key: "ngo_participation", label: "NGO Participation", icon: HandHeart, color: "text-emerald-400" },
  { key: "active_investigations", label: "Active Cases", icon: Timer, color: "text-amber-400" },
  { key: "closed_investigations", label: "Closed Cases", icon: Timer, color: "text-slate-400" },
  { key: "ai_match_accuracy", label: "AI Match Accuracy", icon: Camera, color: "text-cyan-400", suffix: "%" },
  { key: "cctv_detections", label: "CCTV Detections", icon: Camera, color: "text-purple-400" },
  { key: "voice_ai_interactions", label: "Voice AI Calls", icon: Microphone, color: "text-pink-400" },
  { key: "avg_police_response_min", label: "Avg Police Response", icon: Timer, color: "text-orange-400", suffix: " min" },
  { key: "avg_ngo_response_min", label: "Avg NGO Response", icon: Timer, color: "text-orange-400", suffix: " min" },
];

export default function ExecutivePanel({ data }) {
  return (
    <div className="border border-slate-800 rounded-md bg-slate-900 p-5" data-testid="executive-panel">
      <div className="mb-4">
        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Executive dashboard</div>
        <h2 className="font-display font-bold text-lg">Command Center Overview</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {rows.map(r => {
          const Icon = r.icon;
          return (
            <div key={r.key} data-testid={`exec-${r.key}`} className="border border-slate-800 rounded-md bg-slate-950 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-wider text-slate-500">{r.label}</span>
                <Icon size={12} className={r.color} weight="duotone" />
              </div>
              <div className={`font-display text-2xl font-black tracking-tighter ${r.color}`}>
                {data?.[r.key] ?? 0}{r.suffix||""}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
