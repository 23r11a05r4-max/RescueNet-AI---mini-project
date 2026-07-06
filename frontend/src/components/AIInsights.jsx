import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { Sparkle, ArrowClockwise } from "@phosphor-icons/react";

const sevColor = {
  critical: "text-red-400 border-red-500/40",
  warning: "text-amber-400 border-amber-500/40",
  info: "text-cyan-400 border-cyan-500/40",
};

export default function AIInsights() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const r = await api.get("/ai/insights", { params: force ? { t: Date.now() } : {} });
      setData(r.data);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="border border-cyan-500/30 rounded-md bg-slate-950 ai-glow" data-testid="ai-insights">
      <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-500/20">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-400 flex items-center gap-2">
            <Sparkle size={12} weight="fill" /> Claude Sonnet · Predictive Intel
          </div>
          <div className="font-display font-bold text-sm mt-0.5">AI Recommendations</div>
        </div>
        <button data-testid="refresh-insights" onClick={() => load(true)} disabled={loading}
          className="text-cyan-400 hover:text-cyan-300 p-1.5 rounded transition-colors disabled:opacity-50">
          <ArrowClockwise size={14} weight="bold" className={loading ? "animate-spin" : ""} />
        </button>
      </div>
      <div className="p-4 space-y-3 max-h-[440px] overflow-y-auto">
        {!data && <div className="text-xs text-slate-500">Analyzing case patterns…</div>}
        {data?.insights?.map((ins, i) => (
          <div key={i} data-testid={`ai-insight-${i}`}
            className={`border-l-2 ${sevColor[ins.severity]||sevColor.info} pl-3 py-1`}>
            <div className="text-xs font-semibold text-white leading-snug">{ins.title}</div>
            <div className="text-xs text-slate-400 mt-1 leading-relaxed">{ins.insight}</div>
          </div>
        ))}
        {data?.context_summary && (
          <div className="text-[10px] text-slate-600 font-mono mt-4 pt-3 border-t border-slate-800">
            Context: {data.context_summary.slice(0, 200)}…
          </div>
        )}
      </div>
    </div>
  );
}
