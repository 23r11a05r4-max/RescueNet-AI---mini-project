import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, API } from "../lib/api";
import { toast } from "sonner";
import { CaretLeft, DownloadSimple } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";

const priorityBadge = {
  Critical: "bg-red-500/10 text-red-400 border-red-500/30",
  High: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  Medium: "bg-amber-400/10 text-amber-400 border-amber-400/30",
  Low: "bg-slate-500/10 text-slate-300 border-slate-500/30",
};

export default function InvestigationDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [inv, setInv] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [newStatus, setNewStatus] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await api.get(`/investigations/${id}`);
      setInv(r.data);
      setNewStatus(r.data.status);
      const a = await api.get("/alerts", { params: { limit: 200 } });
      setAlerts(a.data.filter(x => x.investigation_id === id));
    } catch (err) {
      console.error("Failed to load investigation:", err);
      toast.error("Failed to load");
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const updateStatus = async () => {
    try {
      await api.patch(`/investigations/${id}/status`, { status: newStatus });
      toast.success("Status updated");
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const downloadCsv = () => {
    const token = localStorage.getItem("sentinel_token");
    // Use fetch with auth then blob
    fetch(`${API}/reports/investigation/${id}?fmt=csv`, { headers: { Authorization: `Bearer ${token}` }})
      .then(r => r.blob()).then(b => {
        const url = URL.createObjectURL(b);
        const a = document.createElement("a"); a.href = url; a.download = `report_${id}.csv`; a.click();
      });
  };

  if (!inv) return <div className="p-8 text-slate-500 text-sm">Loading…</div>;

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6 space-y-6" data-testid="investigation-detail">
      <button onClick={() => nav(-1)} className="text-slate-400 hover:text-white text-xs flex items-center gap-1"><CaretLeft size={14} /> Back</button>

      <div className="border border-slate-800 rounded-md bg-slate-900 p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Investigation #{inv.id.slice(0,8)}</div>
            <h1 className="font-display text-3xl font-black tracking-tighter mt-1">{inv.person_name}</h1>
            <div className="text-slate-400 text-sm mt-1">Age {inv.age} · {inv.gender === "M" ? "Male" : inv.gender === "F" ? "Female" : "Other"}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className={`text-xs px-2.5 py-1 rounded border ${priorityBadge[inv.priority]}`}>{inv.priority}</span>
              <span className="text-xs px-2.5 py-1 rounded border border-slate-700 bg-slate-800 text-slate-300 uppercase">{inv.status.replace("_"," ")}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select data-testid="status-select" value={newStatus} onChange={e => setNewStatus(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-sm">
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="recovered">Recovered</option>
              <option value="closed">Closed</option>
            </select>
            <button data-testid="update-status" onClick={updateStatus} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-md text-sm">Update</button>
            <button data-testid="download-csv" onClick={downloadCsv} className="border border-slate-800 hover:bg-slate-800 text-slate-300 px-3 py-2 rounded-md text-sm flex items-center gap-2"><DownloadSimple size={14} /> CSV</button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Location</div>
            <div className="text-sm text-white mt-1">{inv.last_seen_location}</div>
            <div className="text-xs text-slate-500">{inv.district}, {inv.city}, {inv.state}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Reported by</div>
            <div className="text-sm text-white mt-1">{inv.reporter_name}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Station</div>
            <div className="text-sm text-white mt-1">{inv.assigned_station || "Unassigned"}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">NGOs</div>
            <div className="text-sm text-white mt-1">{inv.assigned_ngos?.join(", ") || "None"}</div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-800">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Description</div>
          <div className="text-sm text-slate-300 leading-relaxed">{inv.description}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 border border-slate-800 rounded-md bg-slate-900 p-5">
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-1">Timeline</div>
          <h2 className="font-display font-bold text-lg mb-4">Event history</h2>
          <div className="space-y-3">
            {alerts.map(a => (
              <div key={a.id} data-testid={`timeline-${a.id}`} className="flex gap-4 pb-3 border-b border-slate-800 last:border-b-0">
                <div className="text-[10px] font-mono text-slate-500 pt-0.5 w-24 shrink-0">{new Date(a.timestamp).toLocaleString()}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${priorityBadge[a.priority]}`}>{a.priority}</span>
                    <span className="text-xs text-white font-medium">{a.event_type.replaceAll("_"," ")}</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">{a.description}</div>
                </div>
              </div>
            ))}
            {alerts.length===0 && <div className="text-xs text-slate-500">No events yet</div>}
          </div>
        </div>

        <div className="border border-slate-800 rounded-md bg-slate-900 p-5 space-y-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-1">AI Matches</div>
            <div className="space-y-2 mt-2">
              {inv.ai_matches?.length ? inv.ai_matches.map((m, i) => (
                <div key={`${m.cam}-${i}`} className="text-xs flex items-center justify-between border border-slate-800 rounded px-2 py-1.5">
                  <span className="font-mono text-slate-300">{m.cam}</span>
                  <span className="text-cyan-400 font-mono font-bold">{Math.round(m.score*100)}%</span>
                </div>
              )) : <div className="text-xs text-slate-500">No matches</div>}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-1">CCTV Hits</div>
            <div className="space-y-2 mt-2">
              {inv.cctv_hits?.length ? inv.cctv_hits.map((c, i) => (
                <div key={`${c.cam}-${c.time}-${i}`} className="text-xs border border-slate-800 rounded px-2 py-1.5 font-mono text-slate-300">
                  {c.cam} · {new Date(c.time).toLocaleString()}
                </div>
              )) : <div className="text-xs text-slate-500">No CCTV hits</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
