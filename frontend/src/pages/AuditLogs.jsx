import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { toast } from "sonner";

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      const r = await api.get("/admin/audit-logs");
      setLogs(r.data);
    } catch (err) {
      toast.error("Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6 space-y-6" data-testid="audit-logs-page">
      <div>
        <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Compliance & Logs</div>
        <h1 className="font-display text-3xl font-black tracking-tighter mt-1">Audit Trails</h1>
      </div>

      <div className="border border-slate-800 rounded-md bg-slate-900 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-xs">Loading audit trials…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-950 text-[10px] uppercase tracking-[0.15em] text-slate-500">
              <tr>
                <th className="text-left px-4 py-3">Timestamp</th>
                <th className="text-left px-4 py-3">User Email</th>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-left px-4 py-3">Action</th>
                <th className="text-left px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-t border-slate-800 hover:bg-slate-800/40 transition">
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">
                    {new Date(l.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-slate-300 font-mono text-xs">{l.email}</td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-slate-700 bg-slate-800 text-slate-300">
                      {l.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold text-xs text-cyan-400">{l.action}</td>
                  <td className="px-4 py-3 text-slate-300 text-xs">{l.details}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan="5" className="text-center py-10 text-slate-500 text-xs">
                    No activities logged yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
