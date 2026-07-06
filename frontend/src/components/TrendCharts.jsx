import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

export default function TrendCharts({ data }) {
  if (!data) return <div className="border border-slate-800 rounded-md bg-slate-900 p-6 text-xs text-slate-500 h-64">Loading trends…</div>;
  return (
    <div className="border border-slate-800 rounded-md bg-slate-900 p-4" data-testid="trend-charts">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Trend analysis</div>
          <h2 className="font-display font-bold text-lg">Reports vs recoveries · 60 days</h2>
        </div>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.daily}>
            <defs>
              <linearGradient id="rep" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.6} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="rec" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.6} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="date" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => v?.slice(5)} />
            <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ background:"#020617", border:"1px solid #334155", borderRadius:6, fontSize:12 }} labelStyle={{ color: "#94a3b8" }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="reported" stroke="#3b82f6" strokeWidth={2} fill="url(#rep)" />
            <Area type="monotone" dataKey="recovered" stroke="#10b981" strokeWidth={2} fill="url(#rec)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
