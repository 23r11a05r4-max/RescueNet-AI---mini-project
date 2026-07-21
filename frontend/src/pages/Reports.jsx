import { useEffect, useState } from "react";
import { api, API } from "../lib/api";
import { DownloadSimple, FileCsv, FilePdf, FileXls } from "@phosphor-icons/react";
import { toast } from "sonner";

export default function Reports() {
  const [summary, setSummary] = useState(null);
  const [invs, setInvs] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const r = await api.get("/reports/summary");
        setSummary(r.data);
      } catch (err) {
        console.error("Failed to load intelligence summary:", err);
        toast.error("Failed to load intelligence summary report. Please check API server.");
      }
      try {
        const r = await api.get("/investigations", { params: { limit: 100 } });
        setInvs(r.data || []);
      } catch (err) {
        console.error("Failed to load cases directory:", err);
        toast.error("Failed to load investigations directory.");
      }
    };
    fetchData();
  }, []);

  const download = (path, fname) => {
    const token = localStorage.getItem("sentinel_token");
    fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` }})
      .then(r => r.blob()).then(b => {
        const url = URL.createObjectURL(b);
        const a = document.createElement("a"); a.href = url; a.download = fname; a.click();
        toast.success(`Downloaded ${fname}`);
      });
  };

  const jsonDl = (data, fname) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = fname; a.click();
    toast.success(`Downloaded ${fname}`);
  };

  const printPdf = () => window.print();

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6 space-y-6" data-testid="reports-page">
      <div>
        <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Automated Reports</div>
        <h1 className="font-display text-3xl font-black tracking-tighter mt-1">Intelligence Reports</h1>
      </div>

      <div className="border border-slate-800 rounded-md bg-slate-900 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Global summary</div>
            <h2 className="font-display font-bold text-lg">Command Center Snapshot</h2>
          </div>
          <div className="flex gap-2">
            <button data-testid="dl-summary-csv" onClick={() => download("/reports/summary?fmt=csv", "summary.csv")} className="border border-slate-800 hover:bg-slate-800 text-slate-300 px-3 py-2 rounded-md text-sm flex items-center gap-2"><FileCsv size={14}/> CSV</button>
            <button data-testid="dl-summary-json" onClick={() => jsonDl(summary, "summary.json")} className="border border-slate-800 hover:bg-slate-800 text-slate-300 px-3 py-2 rounded-md text-sm flex items-center gap-2"><FileXls size={14}/> JSON</button>
            <button data-testid="dl-summary-pdf" onClick={printPdf} className="border border-slate-800 hover:bg-slate-800 text-slate-300 px-3 py-2 rounded-md text-sm flex items-center gap-2"><FilePdf size={14}/> PDF</button>
          </div>
        </div>
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries({...summary.overview, ...summary.executive}).map(([k,v]) => (
              <div key={k} className="border border-slate-800 rounded-md bg-slate-950 p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">{k.replaceAll("_"," ")}</div>
                <div className="text-xl font-mono font-bold text-white mt-1">{typeof v === "number" ? v : String(v)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border border-slate-800 rounded-md bg-slate-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Per-investigation reports</div>
          <h2 className="font-display font-bold text-lg">Case reports</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-950 text-[10px] uppercase tracking-[0.15em] text-slate-500">
            <tr><th className="text-left px-4 py-3">Case</th><th className="text-left px-4 py-3">Location</th><th className="text-left px-4 py-3">Status</th><th className="text-right px-4 py-3">Export</th></tr>
          </thead>
          <tbody>
            {invs.map(i => (
              <tr key={i.id} className="border-t border-slate-800">
                <td className="px-4 py-3">
                  <div className="font-medium text-white">{i.person_name}</div>
                  <div className="text-xs text-slate-500 font-mono">#{i.id.slice(0,8)}</div>
                </td>
                <td className="px-4 py-3 text-slate-300 text-xs">{i.district}, {i.city}</td>
                <td className="px-4 py-3 text-xs uppercase tracking-wider text-slate-400">{i.status.replace("_"," ")}</td>
                <td className="px-4 py-3 text-right">
                  <button data-testid={`dl-case-csv-${i.id}`} onClick={() => download(`/reports/investigation/${i.id}?fmt=csv`, `case_${i.id.slice(0,8)}.csv`)} className="text-xs text-blue-400 hover:text-blue-300 mr-3 inline-flex items-center gap-1"><DownloadSimple size={12}/> CSV</button>
                  <button data-testid={`dl-case-json-${i.id}`}
                    onClick={async () => {
                      try {
                        const r = await api.get(`/reports/investigation/${i.id}`);
                        jsonDl(r.data, `case_${i.id.slice(0,8)}.json`);
                      } catch (err) {
                        toast.error("Failed to export case report as JSON.");
                      }
                    }}
                    className="text-xs text-blue-400 hover:text-blue-300 inline-flex items-center gap-1">
                    <DownloadSimple size={12}/> JSON
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
