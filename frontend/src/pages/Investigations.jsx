import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Plus, X } from "@phosphor-icons/react";

const priorityBadge = {
  Critical: "bg-red-500/10 text-red-400 border-red-500/30",
  High: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  Medium: "bg-amber-400/10 text-amber-400 border-amber-400/30",
  Low: "bg-slate-500/10 text-slate-300 border-slate-500/30",
};
const statusBadge = {
  open: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  in_progress: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  recovered: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  closed: "bg-slate-500/10 text-slate-300 border-slate-500/30",
};

function NewForm({ onClose, onDone }) {
  const [f, setF] = useState({
    person_name: "", age: 10, gender: "M",
    last_seen_location: "", district: "", city: "", state: "",
    lat: 19.076, lng: 72.877,
    description: "", priority: "High", reporter_contact: "",
  });
  const [loading, setLoading] = useState(false);
  const upd = (k) => (e) => setF({ ...f, [k]: e.target.name === "age" ? parseInt(e.target.value||0) : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...f, age: parseInt(f.age), lat: parseFloat(f.lat), lng: parseFloat(f.lng) };
      await api.post("/investigations", payload);
      toast.success("Missing person report submitted");
      onDone();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
    finally { setLoading(false); }
  };

  const inp = "w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6" data-testid="new-report-modal">
      <div className="w-full max-w-2xl border border-slate-800 rounded-md bg-slate-900 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 sticky top-0 bg-slate-900">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">New report</div>
            <h2 className="font-display font-bold text-lg">Missing Person Details</h2>
          </div>
          <button onClick={onClose} data-testid="close-modal" className="text-slate-400 hover:text-white p-1"><X size={20} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input data-testid="inp-name" required placeholder="Person name" value={f.person_name} onChange={upd("person_name")} className={inp} />
            <input data-testid="inp-age" required type="number" name="age" placeholder="Age" value={f.age} onChange={upd("age")} className={inp} />
            <select data-testid="inp-gender" value={f.gender} onChange={upd("gender")} className={inp}>
              <option value="M">Male</option><option value="F">Female</option><option value="O">Other</option>
            </select>
            <select data-testid="inp-priority" value={f.priority} onChange={upd("priority")} className={inp}>
              <option>Low</option><option>Medium</option><option>High</option><option>Critical</option>
            </select>
            <input data-testid="inp-location" required placeholder="Last seen location" value={f.last_seen_location} onChange={upd("last_seen_location")} className={`${inp} col-span-2`} />
            <input data-testid="inp-district" required placeholder="District" value={f.district} onChange={upd("district")} className={inp} />
            <input data-testid="inp-city" required placeholder="City" value={f.city} onChange={upd("city")} className={inp} />
            <input data-testid="inp-state" required placeholder="State" value={f.state} onChange={upd("state")} className={inp} />
            <input data-testid="inp-contact" placeholder="Reporter contact" value={f.reporter_contact} onChange={upd("reporter_contact")} className={inp} />
            <input data-testid="inp-lat" required type="number" step="0.001" placeholder="Latitude" value={f.lat} onChange={upd("lat")} className={inp} />
            <input data-testid="inp-lng" required type="number" step="0.001" placeholder="Longitude" value={f.lng} onChange={upd("lng")} className={inp} />
          </div>
          <textarea data-testid="inp-desc" placeholder="Description, clothing, distinguishing features…" value={f.description} onChange={upd("description")} rows={3} className={inp} required />
          <button data-testid="submit-report" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium py-2.5 rounded-md transition-colors disabled:opacity-50">
            {loading ? "Submitting…" : "Submit Report"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Investigations() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("");
  const [sp, setSp] = useSearchParams();
  const [showNew, setShowNew] = useState(sp.get("new") === "1");
  const navigate = useNavigate();

  const load = useCallback(async () => {
    const r = await api.get("/investigations", { params: status ? { status } : {} });
    setItems(r.data);
  }, [status]);
  useEffect(() => { load(); }, [load]);

  const done = () => { setShowNew(false); sp.delete("new"); setSp(sp); load(); };

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-6 space-y-6" data-testid="investigations-page">
      {showNew && <NewForm onClose={() => { setShowNew(false); sp.delete("new"); setSp(sp); }} onDone={done} />}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Case management</div>
          <h1 className="font-display text-3xl font-black tracking-tighter mt-1">Investigations</h1>
        </div>
        <button data-testid="open-new-report" onClick={() => setShowNew(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2">
          <Plus size={16} weight="bold" /> New Report
        </button>
      </div>

      <div className="flex gap-2">
        {["","open","in_progress","recovered","closed"].map(s => (
          <button key={s||"all"} data-testid={`status-filter-${s||"all"}`} onClick={() => setStatus(s)}
            className={`text-xs px-3 py-1.5 rounded-md uppercase tracking-wider transition-colors ${status===s ? "bg-blue-600 text-white" : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-white hover:bg-slate-800"}`}>
            {s.replace("_"," ") || "All"}
          </button>
        ))}
      </div>

      <div className="border border-slate-800 rounded-md bg-slate-900 overflow-hidden">
        <table className="w-full text-sm" data-testid="investigations-table">
          <thead className="bg-slate-950 text-[10px] uppercase tracking-[0.15em] text-slate-500">
            <tr>
              <th className="text-left px-4 py-3">Person</th>
              <th className="text-left px-4 py-3">Location</th>
              <th className="text-left px-4 py-3">Priority</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Reported</th>
              <th className="text-left px-4 py-3">ID</th>
            </tr>
          </thead>
          <tbody>
            {items.map(i => (
              <tr key={i.id} data-testid={`row-${i.id}`} onClick={() => navigate(`/investigations/${i.id}`)}
                className="border-t border-slate-800 hover:bg-slate-800/50 cursor-pointer transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-white">{i.person_name}</div>
                  <div className="text-xs text-slate-500">{i.age} · {i.gender}</div>
                </td>
                <td className="px-4 py-3 text-slate-300">
                  <div>{i.district}, {i.city}</div>
                  <div className="text-xs text-slate-500">{i.state}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${priorityBadge[i.priority]}`}>{i.priority}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${statusBadge[i.status]}`}>{i.status.replace("_"," ")}</span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400 font-mono">{new Date(i.reported_at).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-xs text-slate-500 font-mono">{i.id.slice(0,8)}</td>
              </tr>
            ))}
            {items.length===0 && <tr><td colSpan="6" className="text-center py-10 text-slate-500 text-xs">No investigations found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
