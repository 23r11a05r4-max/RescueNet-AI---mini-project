import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import AlertFeed from "../components/AlertFeed";
import StatsCards from "../components/StatsCards";
import DemographicCharts from "../components/DemographicCharts";
import GeoMap from "../components/GeoMap";
import AIInsights from "../components/AIInsights";
import TrendCharts from "../components/TrendCharts";
import ExecutivePanel from "../components/ExecutivePanel";
import { toast } from "sonner";
import { Plus } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [demo, setDemo] = useState(null);
  const [geo, setGeo] = useState(null);
  const [trends, setTrends] = useState(null);
  const [exec_, setExec] = useState(null);
  const nav = useNavigate();

  const fetchAll = useCallback(async () => {
    try {
      const [o, d, g, t, e] = await Promise.all([
        api.get("/analytics/overview"),
        api.get("/analytics/demographics"),
        api.get("/analytics/geographic"),
        api.get("/analytics/trends"),
        api.get("/analytics/executive"),
      ]);
      setOverview(o.data); setDemo(d.data); setGeo(g.data); setTrends(t.data); setExec(e.data);
    } catch (err) {
      console.error("Failed to load analytics:", err);
      toast.error("Failed to load analytics");
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const t = setInterval(fetchAll, 15000);
    return () => clearInterval(t);
  }, [fetchAll]);

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-6 space-y-6" data-testid="dashboard-root">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Real-time intelligence</div>
          <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tighter mt-1">Command Overview</h1>
        </div>
        <button data-testid="new-investigation-btn" onClick={() => nav("/investigations?new=1")}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors">
          <Plus size={16} weight="bold" /> New Report
        </button>
      </div>

      <StatsCards data={overview} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <GeoMap data={geo} />
          <TrendCharts data={trends} />
          <DemographicCharts data={demo} />
        </div>
        <div className="space-y-6">
          <AlertFeed />
          <AIInsights />
        </div>
      </div>

      <ExecutivePanel data={exec_} />
    </div>
  );
}
