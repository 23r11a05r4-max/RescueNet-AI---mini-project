import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { Warning, Fire, Bell, CheckCircle } from "@phosphor-icons/react";
import { toast } from "sonner";

const priorityStyles = {
  Critical: "border-l-red-500 bg-red-500/5 text-red-400",
  High: "border-l-orange-500 bg-orange-500/5 text-orange-400",
  Medium: "border-l-amber-400 bg-amber-400/5 text-amber-400",
  Low: "border-l-slate-500 bg-slate-500/5 text-slate-300",
};

const priorityIcon = {
  Critical: Fire, High: Warning, Medium: Bell, Low: CheckCircle,
};

function eventLabel(e) {
  return e.replaceAll("_", " ").replace(/\b\w/g, l => l.toUpperCase());
}

function relTime(iso) {
  const d = new Date(iso); const n = new Date();
  const s = Math.floor((n - d) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

export default function AlertFeed() {
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState("");
  const seenRef = useRef(new Set());

  const fetchAlerts = async (initial=false) => {
    try {
      const r = await api.get("/alerts", { params: { limit: 30 } });
      const data = r.data;
      if (!initial) {
        for (const a of data) {
          if (!seenRef.current.has(a.id)) {
            if (a.priority === "Critical") {
              toast.error(`CRITICAL · ${a.description}`, { description: `Investigation ${a.investigation_id.slice(0,8)}` });
            } else if (a.priority === "High") {
              toast.warning(`HIGH · ${a.description}`);
            }
          }
        }
      }
      data.forEach(a => seenRef.current.add(a.id));
      setAlerts(data);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      const r = await api.get("/alerts", { params: { limit: 30 } });
      if (!mounted) return;
      r.data.forEach(a => seenRef.current.add(a.id));
      setAlerts(r.data);
    })();
    const t = setInterval(() => fetchAlerts(false), 8000);
    return () => { mounted = false; clearInterval(t); };
  }, []);

  const shown = filter ? alerts.filter(a => a.priority === filter) : alerts;

  return (
    <div className="border border-slate-800 rounded-md bg-slate-900" data-testid="alert-feed">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Real-time feed</div>
          <div className="font-display font-bold text-sm mt-0.5 flex items-center gap-2">
            Live Alerts
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          </div>
        </div>
        <div className="flex gap-1">
          {["", "Critical", "High", "Medium", "Low"].map(p => (
            <button key={p||"all"} onClick={() => setFilter(p)} data-testid={`filter-${p||"all"}`}
              className={`text-[10px] px-2 py-1 rounded uppercase tracking-wider transition-colors ${filter===p ? "bg-slate-700 text-white" : "text-slate-500 hover:text-white hover:bg-slate-800"}`}>
              {p || "All"}
            </button>
          ))}
        </div>
      </div>
      <div className="max-h-[520px] overflow-y-auto">
        {shown.length === 0 && <div className="p-6 text-center text-xs text-slate-500">No alerts yet</div>}
        {shown.map((a) => {
          const Icon = priorityIcon[a.priority] || Bell;
          return (
            <div key={a.id} data-testid={`alert-item-${a.priority.toLowerCase()}`}
              className={`alert-enter px-4 py-3 border-b border-slate-800 border-l-2 ${priorityStyles[a.priority]||priorityStyles.Low} last:border-b-0`}>
              <div className="flex items-start gap-3">
                <Icon size={14} className="mt-1 shrink-0" weight="bold" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] uppercase font-bold tracking-widest">{a.priority}</span>
                    <span className="text-[10px] text-slate-500 font-mono">#{a.investigation_id.slice(0,8)}</span>
                    <span className="text-[10px] text-slate-500 ml-auto">{relTime(a.timestamp)}</span>
                  </div>
                  <div className="text-xs font-medium text-white truncate">{eventLabel(a.event_type)}</div>
                  <div className="text-xs text-slate-400 mt-1 leading-relaxed">{a.description}</div>
                  {a.action_required && (
                    <div className="text-[10px] text-slate-500 mt-1.5 font-mono uppercase tracking-wider">→ {a.action_required}</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
