import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, PieChart, Pie, Tooltip } from "recharts";

const COLORS = ["#3b82f6", "#22d3ee", "#f59e0b", "#10b981", "#a855f7", "#ef4444", "#6366f1"];
const BAR_RADIUS = [3, 3, 0, 0];
const SMALL_BAR_RADIUS = [2, 2, 0, 0];
const CHART_CURSOR = { fill: "rgba(59,130,246,0.08)" };

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs shadow-xl">
      <div className="text-slate-400 uppercase tracking-wider text-[10px]">{label}</div>
      <div className="text-white font-semibold font-mono">{payload[0].value}</div>
    </div>
  );
};

function ChartCard({ title, subtitle, children, testid }) {
  return (
    <div className="border border-slate-800 rounded-md bg-slate-900 p-4" data-testid={testid}>
      <div className="mb-3">
        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{subtitle}</div>
        <div className="font-display font-bold text-sm mt-0.5">{title}</div>
      </div>
      <div className="h-40">{children}</div>
    </div>
  );
}

export default function DemographicCharts({ data, onChartClick }) {
  if (!data) return <div className="border border-slate-800 rounded-md bg-slate-900 p-6 text-xs text-slate-500">Loading demographics…</div>;
  const genderLabel = { M: "Male", F: "Female", O: "Other" };
  const genderData = data.by_gender.map(g => ({ name: genderLabel[g.gender], count: g.count }));

  const handleBarClick = (type, key) => (clickedData) => {
    if (clickedData && clickedData[key] !== undefined && onChartClick) {
      onChartClick({ type, value: clickedData[key] });
    }
  };

  return (
    <div className="space-y-4" data-testid="demographic-charts">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Demographic Analysis</div>
          <h2 className="font-display font-bold text-lg">Missing person profile patterns (Click charts to drill down)</h2>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <ChartCard title="By Age Group" subtitle="Age distribution" testid="chart-age">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.by_age}>
              <XAxis dataKey="bucket" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={CHART_CURSOR} />
              <Bar dataKey="count" radius={BAR_RADIUS} onClick={handleBarClick("age", "bucket")} className="cursor-pointer">
                {data.by_age.map((d, i) => <Cell key={`age-${d.bucket}`} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="By Gender" subtitle="Gender split" testid="chart-gender">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={genderData} dataKey="count" nameKey="name" innerRadius={30} outerRadius={60} paddingAngle={2} onClick={(d) => onChartClick && onChartClick({ type: "gender", value: d.name })} className="cursor-pointer">
                {genderData.map((g, i) => <Cell key={`gender-${g.name}`} fill={COLORS[i]} stroke="#020617" strokeWidth={2} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="By Day of Week" subtitle="Weekly pattern" testid="chart-dow">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.by_dow}>
              <XAxis dataKey="day" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={CHART_CURSOR} />
              <Bar dataKey="count" fill="#22d3ee" radius={BAR_RADIUS} onClick={handleBarClick("dow", "day")} className="cursor-pointer" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="By Time of Day" subtitle="Hourly heat" testid="chart-hour">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.by_hour}>
              <XAxis dataKey="hour" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(59,130,246,0.08)" }} />
              <Bar dataKey="count" fill="#f59e0b" radius={[2,2,0,0]} onClick={handleBarClick("hour", "hour")} className="cursor-pointer" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="By Month" subtitle="Monthly reports" testid="chart-month">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.by_month}>
              <XAxis dataKey="month" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={CHART_CURSOR} />
              <Bar dataKey="count" fill="#10b981" radius={BAR_RADIUS} onClick={handleBarClick("month", "month")} className="cursor-pointer" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <div className="border border-slate-800 rounded-md bg-slate-900 p-4 flex flex-col justify-center" data-testid="chart-insight">
          <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-400 mb-2">Auto-generated insight</div>
          <div className="text-xs text-slate-300 leading-relaxed">
            The <span className="text-white font-semibold">{data.by_age.reduce((a,b) => a.count > b.count ? a : b, {bucket:"-",count:0}).bucket}</span> age bracket represents the highest number of reported cases, with a concentrated reporting spike around <span className="text-white font-semibold">{data.by_hour.reduce((a,b) => a.count > b.count ? a : b, {hour:0,count:0}).hour}:00</span>.
          </div>
        </div>
      </div>
    </div>
  );
}
