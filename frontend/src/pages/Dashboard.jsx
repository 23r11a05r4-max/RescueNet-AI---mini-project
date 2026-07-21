import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import AlertFeed from "../components/AlertFeed";
import StatsCards from "../components/StatsCards";
import DemographicCharts from "../components/DemographicCharts";
import GeoMap from "../components/GeoMap";
import AIInsights from "../components/AIInsights";
import TrendCharts from "../components/TrendCharts";
import ExecutivePanel from "../components/ExecutivePanel";
import { toast } from "sonner";
import { Plus, SpeakerHigh, BookOpen, Warning, ArrowRight, ShieldCheck, Heartbeat, Cpu, Database, UserGear, PhoneCall, FileText, DownloadSimple } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [demo, setDemo] = useState(null);
  const [geo, setGeo] = useState(null);
  const [trends, setTrends] = useState(null);
  const [exec_, setExec] = useState(null);
  
  // Enterprise States
  const [myCases, setMyCases] = useState([]);
  const [loadingCases, setLoadingCases] = useState(false);
  
  const [sysHealth, setSysHealth] = useState(null);
  const [callLogs, setCallLogs] = useState([]);
  const [fetchingSystem, setFetchingSystem] = useState(false);
  const [error, setError] = useState(null);

  const nav = useNavigate();

  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [state, setState] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [selectedChartFilter, setSelectedChartFilter] = useState(null);
  const [modalCases, setModalCases] = useState([]);
  const [loadingModal, setLoadingModal] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    try {
      setError(null);
      const params = {
        city: city || undefined,
        district: district || undefined,
        state: state || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined
      };
      const [o, d, g, t, e] = await Promise.all([
        api.get("/analytics/overview", { params }),
        api.get("/analytics/demographics", { params }),
        api.get("/analytics/geographic", { params }),
        api.get("/analytics/trends", { params }),
        api.get("/analytics/executive", { params }),
      ]);
      setOverview(o.data); 
      setDemo(d.data); 
      setGeo(g.data); 
      setTrends(t.data); 
      setExec(e.data);
    } catch (err) {
      console.error("Failed to load analytics:", err);
      setError("Unable to retrieve central dashboard intelligence. Please verify API gateway status.");
    }
  }, [city, district, state, startDate, endDate]);

  const handleChartClick = async (filter) => {
    setSelectedChartFilter(filter);
    setLoadingModal(true);
    setShowModal(true);
    try {
      const params = {};
      if (filter.type === "age") {
        const parts = String(filter.value).split("-");
        if (parts.length === 2) {
          params.min_age = parseInt(parts[0]);
          params.max_age = parseInt(parts[1]);
        } else if (String(filter.value).endsWith("+")) {
          params.min_age = parseInt(filter.value);
        } else {
          const match = String(filter.value).match(/(\d+)\-(\d+)/);
          if (match) {
            params.min_age = parseInt(match[1]);
            params.max_age = parseInt(match[2]);
          }
        }
      } else if (filter.type === "gender") {
        params.gender = filter.value === "Male" ? "M" : filter.value === "Female" ? "F" : "O";
      } else if (filter.type === "month") {
        params.start_date = `${filter.value}-01T00:00:00Z`;
        params.end_date = `${filter.value}-31T23:59:59Z`;
      }
      
      const r = await api.get("/investigations", { params });
      let results = r.data;
      if (filter.type === "dow") {
        const daysMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
        results = results.filter(c => {
          try {
            return new Date(c.reported_at).getDay() === daysMap[filter.value];
          } catch(e) { return false; }
        });
      } else if (filter.type === "hour") {
        results = results.filter(c => {
          try {
            return new Date(c.reported_at).getHours() === parseInt(filter.value);
          } catch(e) { return false; }
        });
      }
      setModalCases(results);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load details for chart group");
    } finally {
      setLoadingModal(false);
    }
  };

  const handleExport = (format) => {
    const token = localStorage.getItem("sentinel_token");
    const query = new URLSearchParams();
    query.append("fmt", format);
    if (city) query.append("city", city);
    if (district) query.append("district", district);
    if (state) query.append("state", state);
    if (startDate) query.append("start_date", startDate);
    if (endDate) query.append("end_date", endDate);
    
    const url = `http://localhost:8000/api/reports/export?${query.toString()}`;
    
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => {
        if (!r.ok) throw new Error("Export failed");
        return r.blob();
      })
      .then(blob => {
        const fileUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = fileUrl;
        a.download = `rescuenet_report_${new Date().toISOString().slice(0,10)}.${format === "xlsx" ? "xlsx" : format === "pdf" ? "pdf" : "csv"}`;
        a.click();
        toast.success(`Exported ${format.toUpperCase()} report successfully!`);
      })
      .catch(err => {
        console.error(err);
        toast.error("Export failed. Please try again.");
      });
  };

  const fetchSystemMonitoring = useCallback(async () => {
    if (user?.role !== "admin") return;
    setFetchingSystem(true);
    try {
      const r = await api.get("/admin/monitoring");
      setSysHealth(r.data);
      const c = await api.get("/telephony/calls");
      setCallLogs(c.data);
    } catch (err) {
      console.error("Failed to load system telemetry:", err);
    } finally {
      setFetchingSystem(false);
    }
  }, [user]);

  const fetchCases = useCallback(async () => {
    setLoadingCases(true);
    try {
      const r = await api.get("/investigations");
      setMyCases(r.data);
    } catch (err) {
      console.error("Failed to load cases:", err);
    } finally {
      setLoadingCases(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    
    if (user.role === "admin" || user.role === "police") {
      fetchAnalytics();
      const t = setInterval(fetchAnalytics, 20000);
      
      if (user.role === "admin") {
        fetchSystemMonitoring();
        const m = setInterval(fetchSystemMonitoring, 10000);
        return () => { clearInterval(t); clearInterval(m); };
      }
      
      return () => clearInterval(t);
    } else {
      fetchCases();
      const t = setInterval(fetchCases, 20000);
      return () => clearInterval(t);
    }
  }, [user, fetchAnalytics, fetchSystemMonitoring, fetchCases]);

  useEffect(() => {
    const handleRefetch = () => {
      if (!user) return;
      if (user.role === "admin" || user.role === "police") {
        fetchAnalytics();
        fetchSystemMonitoring();
      } else {
        fetchCases();
      }
    };
    window.addEventListener("new-case-registered", handleRefetch);
    return () => {
      window.removeEventListener("new-case-registered", handleRefetch);
    };
  }, [user, fetchAnalytics, fetchSystemMonitoring, fetchCases]);

  const downloadCallReport = (callId) => {
    const token = localStorage.getItem("sentinel_token");
    fetch(`${API.replace("/api", "")}/api/telephony/calls/${callId}/pdf`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.text())
      .then(txt => {
        const blob = new Blob([txt], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `call_report_${callId.slice(0,8)}.txt`;
        a.click();
        toast.success("Downloaded Telephony Call Summary Report");
      });
  };

  if (!user) return null;

  if (error && (user.role === "admin" || user.role === "police")) {
    return (
      <div className="mx-auto max-w-[1600px] px-6 py-12 text-center space-y-4 font-sans" data-testid="dashboard-root">
        <Warning size={48} className="text-red-500 mx-auto" />
        <h2 className="text-lg font-bold text-white">System Connectivity Issue</h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto">{error}</p>
        <button onClick={fetchAnalytics} className="bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-md hover:bg-blue-500 transition">
          Retry Connecting
        </button>
      </div>
    );
  }

  if (overview === null && (user.role === "admin" || user.role === "police")) {
    return (
      <div className="mx-auto max-w-[1600px] px-6 py-6 space-y-6" data-testid="dashboard-root">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Real-time intelligence</div>
          <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tighter mt-1">Command Overview</h1>
        </div>
        
        {/* Loading Skeletons */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-pulse">
          <div className="h-28 bg-slate-900 border border-slate-800 rounded-md"></div>
          <div className="h-28 bg-slate-900 border border-slate-800 rounded-md"></div>
          <div className="h-28 bg-slate-900 border border-slate-800 rounded-md"></div>
          <div className="h-28 bg-slate-900 border border-slate-800 rounded-md"></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="h-96 bg-slate-900 border border-slate-800 rounded-md animate-pulse"></div>
            <div className="h-64 bg-slate-900 border border-slate-800 rounded-md animate-pulse"></div>
          </div>
          <div className="h-96 bg-slate-900 border border-slate-800 rounded-md animate-pulse font-serif"></div>
        </div>
      </div>
    );
  }

  // ----------------- CITIZEN PORTAL DASHBOARD -----------------
  if (user.role === "citizen") {
    return (
      <div className="mx-auto max-w-[1400px] px-6 py-6 space-y-6" data-testid="dashboard-root">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Citizen Support Hub</div>
            <h1 className="font-display text-3xl font-black tracking-tighter mt-1">My Sentinel Space</h1>
          </div>
          <button data-testid="new-investigation-btn" onClick={() => nav("/investigations?new=1")}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors">
            <Plus size={16} weight="bold" /> Report Missing Child
          </button>
        </div>

        {/* Info Grid cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="border border-slate-800 rounded-md bg-slate-900 p-5 flex gap-4 items-start">
            <div className="p-3 bg-blue-500/10 rounded text-blue-400 shrink-0">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white mb-1">Track Case Progress</h2>
              <p className="text-xs text-slate-400 leading-relaxed mb-3">View timeline updates, CCTV face match hits, and investigation summaries in real-time.</p>
              <button onClick={() => nav("/investigations")} className="text-xs text-blue-400 hover:text-blue-300 font-semibold inline-flex items-center gap-1">
                View My Reports <ArrowRight size={12} />
              </button>
            </div>
          </div>
          <div className="border border-slate-800 rounded-md bg-slate-900 p-5 flex gap-4 items-start">
            <div className="p-3 bg-cyan-500/10 rounded text-cyan-400 shrink-0">
              <SpeakerHigh size={20} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white mb-1">Hands-Free voice AI</h2>
              <p className="text-xs text-slate-400 leading-relaxed mb-3">Ask questions by voice, listen to replies, or report detail changes with our built-in voice copilot assistant.</p>
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500">Click float button on bottom right</span>
            </div>
          </div>
          <div className="border border-slate-800 rounded-md bg-slate-900 p-5 flex gap-4 items-start">
            <div className="p-3 bg-amber-500/10 rounded text-amber-400 shrink-0">
              <BookOpen size={20} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white mb-1">Safety Guidelines</h2>
              <p className="text-xs text-slate-400 leading-relaxed mb-3">Access SOP guidelines, laws, and checklists. Type questions in the chatbot to get reference docs.</p>
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500">RAG Documents Search Enabled</span>
            </div>
          </div>
        </div>

        {/* My cases and alerts grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 border border-slate-800 rounded-md bg-slate-900 p-5 space-y-4">
            <h2 className="font-display font-bold text-lg text-white">Active Case Registrations</h2>
            {loadingCases ? (
              <div className="space-y-2 py-4 animate-pulse">
                <div className="h-7 bg-slate-800 rounded w-full"></div>
                <div className="h-7 bg-slate-800 rounded w-full font-sans"></div>
                <div className="h-7 bg-slate-800 rounded w-full font-serif"></div>
              </div>
            ) : myCases.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-800 rounded bg-slate-950/20 text-xs text-slate-500">
                You have not registered any reports. Click "Report Missing Child" above to submit a file.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 text-slate-500 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-3 py-2.5">Name</th>
                      <th className="px-3 py-2.5">Last Seen</th>
                      <th className="px-3 py-2.5">Priority</th>
                      <th className="px-3 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myCases.map(c => (
                      <tr key={c.id} onClick={() => nav(`/investigations/${c.id}`)} className="border-t border-slate-800 hover:bg-slate-800/40 cursor-pointer transition">
                        <td className="px-3 py-3 font-semibold text-white">{c.person_name} (Age {c.age})</td>
                        <td className="px-3 py-3 text-slate-400">{c.last_seen_location}</td>
                        <td className="px-3 py-3"><span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">{c.priority}</span></td>
                        <td className="px-3 py-3"><span className="px-2 py-0.5 rounded bg-blue-600/10 border border-blue-600/30 text-blue-400 uppercase font-mono text-[9px]">{c.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div>
            <AlertFeed />
          </div>
        </div>
      </div>
    );
  }

  // ----------------- NGO PORTAL DASHBOARD -----------------
  if (user.role === "ngo") {
    return (
      <div className="mx-auto max-w-[1400px] px-6 py-6 space-y-6" data-testid="dashboard-root">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">NGO Partner Desk</div>
          <h1 className="font-display text-3xl font-black tracking-tighter mt-1">{user.department || "Rescue & Rehabilitation Hub"}</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-slate-800 rounded-md bg-slate-900 p-5 flex gap-4 items-start">
            <div className="p-3 bg-emerald-500/10 rounded text-emerald-400 shrink-0">
              <Heartbeat size={20} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white mb-1">Rehabilitation Planning</h2>
              <p className="text-xs text-slate-400 leading-relaxed mb-3">Add recovery updates, document child health status, and upload counseling progress reports directly to police files.</p>
              <button onClick={() => nav("/investigations")} className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold inline-flex items-center gap-1">
                Access Assigned Cases <ArrowRight size={12} />
              </button>
            </div>
          </div>
          <div className="border border-slate-800 rounded-md bg-slate-900 p-5 flex gap-4 items-start">
            <div className="p-3 bg-red-500/10 rounded text-red-400 shrink-0">
              <Warning size={20} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white mb-1">Critical alerts broadcast</h2>
              <p className="text-xs text-slate-400 leading-relaxed mb-3">Get instant warnings when new children are recovered or if search teams request volunteer assistance.</p>
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500">Live feed connected</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 border border-slate-800 rounded-md bg-slate-900 p-5 space-y-4">
            <h2 className="font-display font-bold text-lg text-white">Assigned Rescue Operations</h2>
            {loadingCases ? (
              <div className="space-y-2 py-4 animate-pulse">
                <div className="h-7 bg-slate-800 rounded w-full"></div>
                <div className="h-7 bg-slate-800 rounded w-full font-sans"></div>
                <div className="h-7 bg-slate-800 rounded w-full font-serif"></div>
              </div>
            ) : myCases.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-800 rounded bg-slate-950/20 text-xs text-slate-500">
                No active rescue operations assigned to your NGO at this time.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 text-slate-500 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-3 py-2.5">Child Name</th>
                      <th className="px-3 py-2.5">Dist. Location</th>
                      <th className="px-3 py-2.5">Priority</th>
                      <th className="px-3 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myCases.map(c => (
                      <tr key={c.id} onClick={() => nav(`/investigations/${c.id}`)} className="border-t border-slate-800 hover:bg-slate-800/40 cursor-pointer transition">
                        <td className="px-3 py-3 font-semibold text-white">{c.person_name} (Age {c.age})</td>
                        <td className="px-3 py-3 text-slate-400">{c.district}, {c.city}</td>
                        <td className="px-3 py-3"><span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">{c.priority}</span></td>
                        <td className="px-3 py-3"><span className="px-2 py-0.5 rounded bg-amber-600/10 border border-amber-600/30 text-amber-400 uppercase font-mono text-[9px]">{c.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div>
            <AlertFeed />
          </div>
        </div>
      </div>
    );
  }

  // ----------------- POLICE / ADMIN INTEL DASHBOARD -----------------
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

      {/* Analytics Filters & Export Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-md p-4">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">State:</span>
            <input
              type="text"
              placeholder="e.g. Maharashtra"
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-white w-28 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">City:</span>
            <input
              type="text"
              placeholder="e.g. Mumbai"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-white w-28 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">District:</span>
            <input
              type="text"
              placeholder="e.g. Bandra"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-white w-28 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-1.5 border-l border-slate-800 pl-3">
            <span className="text-slate-500 font-medium">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          {(city || district || state || startDate || endDate) && (
            <button
              onClick={() => { setCity(""); setDistrict(""); setState(""); setStartDate(""); setEndDate(""); }}
              className="text-[10px] text-red-400 hover:text-red-300 font-semibold"
            >
              Clear Filters
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport("pdf")}
            className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs px-3 py-2 rounded-md font-medium flex items-center gap-1.5 transition"
          >
            <DownloadSimple size={14} className="text-red-400" /> Export PDF
          </button>
          <button
            onClick={() => handleExport("xlsx")}
            className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs px-3 py-2 rounded-md font-medium flex items-center gap-1.5 transition"
          >
            <DownloadSimple size={14} className="text-emerald-400" /> Export Excel
          </button>
          <button
            onClick={() => handleExport("csv")}
            className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs px-3 py-2 rounded-md font-medium flex items-center gap-1.5 transition"
          >
            <DownloadSimple size={14} className="text-blue-400" /> Export CSV
          </button>
        </div>
      </div>

      <StatsCards data={overview} />

      {/* Admin Real-Time Monitoring & Telemetry Health */}
      {user.role === "admin" && sysHealth && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 border border-slate-800 rounded-md bg-slate-900 p-5">
          <div className="flex items-center gap-3">
            <Cpu size={24} className="text-cyan-400" />
            <div>
              <div className="text-[9px] uppercase tracking-wider text-slate-500">CPU Usage</div>
              <div className="text-sm font-bold font-mono text-white">{sysHealth.system_health?.cpu_usage}%</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Database size={24} className="text-emerald-400" />
            <div>
              <div className="text-[9px] uppercase tracking-wider text-slate-500">DB Connections</div>
              <div className="text-sm font-bold font-mono text-white">{sysHealth.ai_usage?.db_status.toUpperCase()}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <UserGear size={24} className="text-amber-400" />
            <div>
              <div className="text-[9px] uppercase tracking-wider text-slate-500">Active Staff</div>
              <div className="text-sm font-bold font-mono text-white">
                {sysHealth.online_police} Police / {sysHealth.online_ngos} NGOs
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <PhoneCall size={24} className="text-red-400" />
            <div>
              <div className="text-[9px] uppercase tracking-wider text-slate-500">Emergency Hotline Logs</div>
              <div className="text-sm font-bold font-mono text-white">{sysHealth.live_calls} logged calls</div>
            </div>
          </div>
        </div>
      )}

      {/* Live Hotline Calls Analytics Panel */}
      {user.role === "admin" && callLogs.length > 0 && (
        <div className="border border-slate-800 rounded-md bg-slate-900 p-5 space-y-4">
          <h2 className="font-display font-bold text-md text-white">Emergency Hotline Calls Analytics</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950 text-slate-500 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-3 py-2.5">Caller</th>
                  <th className="px-3 py-2.5">Language</th>
                  <th className="px-3 py-2.5">Sentiment</th>
                  <th className="px-3 py-2.5">Urgency</th>
                  <th className="px-3 py-2.5">Risk Score</th>
                  <th className="px-3 py-2.5">Summary</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {callLogs.map(log => (
                  <tr key={log.id} className="border-t border-slate-800 hover:bg-slate-800/40 transition">
                    <td className="px-3 py-3 font-mono text-white">{log.caller_phone}</td>
                    <td className="px-3 py-3 text-slate-400">{log.caller_language}</td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                        log.sentiment === "Panic" || log.sentiment === "Fear" ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-slate-800 text-slate-300"
                      }`}>{log.sentiment}</span>
                    </td>
                    <td className="px-3 py-3 font-bold text-amber-500">{log.urgency_level}</td>
                    <td className="px-3 py-3 font-mono font-bold text-red-400">{log.risk_score}/100</td>
                    <td className="px-3 py-3 text-slate-300 max-w-[200px] truncate">{log.summary}</td>
                    <td className="px-3 py-3 text-right">
                      <button onClick={() => downloadCallReport(log.id)} className="text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 font-semibold">
                        <FileText size={14} /> PDF/TXT
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <GeoMap data={geo} />
          <TrendCharts data={trends} />
          <DemographicCharts data={demo} onChartClick={handleChartClick} />
        </div>
        <div className="space-y-6">
          <AlertFeed />
          <AIInsights />
        </div>
      </div>

      <ExecutivePanel data={exec_} />

      {/* Chart Detail drilldown modal */}
      {showModal && selectedChartFilter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-3xl w-full p-6 space-y-4 shadow-2xl relative font-sans">
            <button
              onClick={() => { setShowModal(false); setSelectedChartFilter(null); setModalCases([]); }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg font-bold"
            >
              ✕
            </button>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-blue-400">Demographic Drilldown</div>
              <h3 className="text-lg font-bold text-white mt-0.5">
                Cases matching: {selectedChartFilter.type.toUpperCase()} ({selectedChartFilter.value})
              </h3>
            </div>
            
            {loadingModal ? (
              <div className="space-y-3 py-10 animate-pulse">
                <div className="h-6 bg-slate-800 rounded w-full"></div>
                <div className="h-6 bg-slate-800 rounded w-full"></div>
                <div className="h-6 bg-slate-800 rounded w-full"></div>
              </div>
            ) : modalCases.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-500 border border-dashed border-slate-800 rounded bg-slate-950/20">
                No investigations registered matching this group.
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto border border-slate-800 rounded">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 text-slate-500 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Age</th>
                      <th className="px-4 py-3">Gender</th>
                      <th className="px-4 py-3">Last Seen Location</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalCases.map(c => (
                      <tr
                        key={c.id}
                        onClick={() => { setShowModal(false); nav(`/investigations/${c.id}`); }}
                        className="border-t border-slate-850 hover:bg-slate-800/60 cursor-pointer transition"
                      >
                        <td className="px-4 py-3 font-semibold text-white">{c.person_name}</td>
                        <td className="px-4 py-3 text-slate-350">{c.age}</td>
                        <td className="px-4 py-3 text-slate-350">{c.gender === "M" ? "Male" : c.gender === "F" ? "Female" : "Other"}</td>
                        <td className="px-4 py-3 text-slate-400">{c.last_seen_location}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded font-mono text-[9px] uppercase ${
                            c.status === "recovered" ? "bg-emerald-600/10 text-emerald-400 border border-emerald-600/20" : "bg-blue-600/10 text-blue-400 border border-blue-600/20"
                          }`}>{c.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            <div className="flex justify-end pt-2">
              <button
                onClick={() => { setShowModal(false); setSelectedChartFilter(null); setModalCases([]); }}
                className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-4 py-2 rounded transition"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
