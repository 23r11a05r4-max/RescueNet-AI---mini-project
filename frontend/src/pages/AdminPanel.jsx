import { useEffect, useState, useCallback } from "react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { 
  Gauge, Users, Folder, Cpu, Megaphone, Receipt, Sliders, 
  Trash, Warning, Check, X, UserGear, 
  Gear, ArrowRight, ShieldCheck, Heartbeat, UserCheck, 
  UserMinus, Info, FloppyDisk, PaperPlaneTilt, FileMagnifyingGlass,
  ChatCircleText
} from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";

export default function AdminPanel() {
  const nav = useNavigate();
  const [activeTab, setActiveTab] = useState("dashboard");

  // Telemetry & DB States
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // User Manager States
  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [editingUser, setEditingUser] = useState(null);

  // Case Manager States
  const [casesList, setCasesList] = useState([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [caseSearch, setCaseSearch] = useState("");
  const [editingCase, setEditingCase] = useState(null);

  // AI Match States
  const [matchesList, setMatchesList] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(false);

  // Broadcast Notification States
  const [broadcastTarget, setBroadcastTarget] = useState("all");
  const [broadcastLocation, setBroadcastLocation] = useState("");
  const [broadcastUser, setBroadcastUser] = useState("");
  const [broadcastPriority, setBroadcastPriority] = useState("High");
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastText, setBroadcastText] = useState("");
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [notificationsHistory, setNotificationsHistory] = useState([]);

  // Audit Logs States
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudits, setLoadingAudits] = useState(false);
  const [auditSearch, setAuditSearch] = useState("");

  // Handoff Chats States
  const [activeHandoffs, setActiveHandoffs] = useState([]);
  const [loadingHandoffs, setLoadingHandoffs] = useState(false);
  const [selectedHandoff, setSelectedHandoff] = useState(null);
  const [humanReplyText, setHumanReplyText] = useState("");

  // Settings Configuration States
  const [settings, setSettings] = useState({
    ai_threshold: 0.85,
    max_upload_size_mb: 5,
    allowed_file_types: ["jpg", "jpeg", "png", "webp"],
    enable_push_notifications: true,
    enable_email_notifications: false
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Fetch Telemetry & Dashboard Stats
  const fetchDashboardStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const r = await api.get("/admin/monitoring");
      setStats(r.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to retrieve server telemetry metrics");
    } finally {
      setLoadingStats(false);
    }
  }, []);

  // Fetch Registered Users
  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const r = await api.get("/admin/users");
      setUsersList(r.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load user accounts list");
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  // Fetch Cases (Investigations)
  const fetchCases = useCallback(async () => {
    setLoadingCases(true);
    try {
      const r = await api.get("/investigations");
      setCasesList(r.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load investigation cases");
    } finally {
      setLoadingCases(false);
    }
  }, []);

  // Fetch AI Match Suggestions
  const fetchMatches = useCallback(async () => {
    setLoadingMatches(true);
    try {
      const r = await api.get("/admin/face-matches");
      setMatchesList(r.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load suggested face matches");
    } finally {
      setLoadingMatches(false);
    }
  }, []);

  // Fetch System settings
  const fetchSettings = useCallback(async () => {
    try {
      const r = await api.get("/admin/settings");
      setSettings(r.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  // Fetch Compliance Audit Logs
  const fetchAuditLogs = useCallback(async () => {
    setLoadingAudits(true);
    try {
      const r = await api.get("/admin/audit-logs");
      setAuditLogs(r.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to retrieve compliance audit trail");
    } finally {
      setLoadingAudits(false);
    }
  }, []);

  const fetchHandoffs = useCallback(async () => {
    setLoadingHandoffs(true);
    try {
      const r = await api.get("/chat/handoff/active");
      setActiveHandoffs(r.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to retrieve active handoffs queue");
    } finally {
      setLoadingHandoffs(false);
    }
  }, []);

  const handleSendHandoffReply = async (e) => {
    e.preventDefault();
    if (!selectedHandoff || !humanReplyText.trim()) return;
    try {
      await api.post("/chat/handoff/reply", {
        session_id: selectedHandoff.session_id,
        message: humanReplyText
      });
      toast.success("Handoff response dispatched successfully!");
      setHumanReplyText("");
      const hist = await api.get(`/chat/history/${selectedHandoff.session_id}`);
      setSelectedHandoff(prev => ({ ...prev, messages: hist.data }));
      fetchHandoffs();
    } catch (err) {
      toast.error("Failed to transmit human handoff reply");
    }
  };

  // Fetch Alerts History
  const fetchNotificationLogs = useCallback(async () => {
    try {
      const r = await api.get("/alerts?limit=100");
      setNotificationsHistory(r.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  // Trigger correct fetches when active tab changes
  useEffect(() => {
    if (activeTab === "dashboard") fetchDashboardStats();
    if (activeTab === "users") fetchUsers();
    if (activeTab === "cases") fetchCases();
    if (activeTab === "matches") fetchMatches();
    if (activeTab === "notifications") {
      fetchNotificationLogs();
      fetchUsers();
    }
    if (activeTab === "audit") fetchAuditLogs();
    if (activeTab === "settings") fetchSettings();
    if (activeTab === "handoff_chats") fetchHandoffs();
  }, [activeTab, fetchDashboardStats, fetchUsers, fetchCases, fetchMatches, fetchNotificationLogs, fetchAuditLogs, fetchSettings, fetchHandoffs]);

  // --- USER CONTROLS ---
  const handleUpdateUserRole = async (userId, newRole) => {
    try {
      await api.patch(`/admin/users/${userId}/role`, { role: newRole });
      toast.success("User role updated successfully");
      fetchUsers();
    } catch (err) {
      toast.error("Failed to update user role");
    }
  };

  const handleToggleSuspension = async (userId, isSuspended) => {
    try {
      await api.patch(`/admin/users/${userId}/suspend`, { suspended: !isSuspended });
      toast.success(isSuspended ? "Account reactivated successfully!" : "Account suspended successfully!");
      fetchUsers();
    } catch (err) {
      toast.error("Failed to toggle suspension state");
    }
  };

  const handleUpdateUserDetails = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/admin/users/${editingUser.id}`, {
        name: editingUser.name,
        email: editingUser.email,
        role: editingUser.role,
        department: editingUser.department || ""
      });
      toast.success("User details updated!");
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      toast.error("Failed to update details");
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("GDPR RIGHT TO BE FORGOTTEN: Delete this user permanently? This is irreversible.")) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      toast.success("User deleted complying with GDPR Regulation");
      fetchUsers();
    } catch (err) {
      toast.error("Failed to delete user");
    }
  };

  // --- CASE CONTROLS ---
  const handleUpdateCaseStatus = async (caseId, newStatus) => {
    try {
      await api.patch(`/investigations/${caseId}/status`, { status: newStatus, notes: "Status modified by administrator" });
      toast.success("Investigation status updated");
      fetchCases();
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  const handleUpdateCaseDetails = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/investigations/${editingCase.id}`, {
        person_name: editingCase.person_name,
        age: editingCase.age,
        gender: editingCase.gender,
        last_seen_location: editingCase.last_seen_location,
        priority: editingCase.priority,
        district: editingCase.district,
        city: editingCase.city,
        state: editingCase.state,
        clothes_worn: editingCase.clothes_worn,
        physical_description: editingCase.physical_description,
        identification_marks: editingCase.identification_marks
      });
      toast.success("Case folder updated!");
      setEditingCase(null);
      fetchCases();
    } catch (err) {
      toast.error("Failed to save changes");
    }
  };

  const handleDeleteCase = async (caseId) => {
    if (!window.confirm("DUPLICATE CLEANUP: Delete this investigation file permanently?")) return;
    try {
      await api.delete(`/admin/investigations/${caseId}`);
      toast.success("Investigation folder deleted");
      fetchCases();
    } catch (err) {
      toast.error("Failed to delete investigation");
    }
  };

  // --- AI MATCH CONTROLS ---
  const handleMatchAction = async (match, action) => {
    try {
      await api.post(`/admin/face-matches/${match.investigation_id}/matches/${match.match_index}/action`, { action });
      toast.success(`AI Face Match ${action.toUpperCase()}D successfully`);
      fetchMatches();
    } catch (err) {
      toast.error("Action execution failed");
    }
  };

  // --- BROADCAST CONTROLS ---
  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastTitle || !broadcastText) {
      toast.error("Title and description are required");
      return;
    }
    setSendingBroadcast(true);
    try {
      await api.post("/admin/notifications/broadcast", {
        target_type: broadcastTarget,
        target_location: broadcastTarget === "location" ? broadcastLocation : null,
        target_user_id: broadcastTarget === "individual" ? broadcastUser : null,
        priority: broadcastPriority,
        title: broadcastTitle,
        description: broadcastText
      });
      toast.success("Emergency announcement broadcast dispatched!");
      setBroadcastTitle("");
      setBroadcastText("");
      fetchNotificationLogs();
    } catch (err) {
      toast.error("Failed to broadcast announcement");
    } finally {
      setSendingBroadcast(false);
    }
  };

  // --- SETTINGS CONTROLS ---
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await api.post("/admin/settings", settings);
      toast.success("System configurations updated!");
    } catch (err) {
      toast.error("Failed to save settings");
    } finally {
      setSavingSettings(false);
    }
  };

  // --- DATABASE BACKUP & RESTORE ---
  const handleBackupDb = async () => {
    try {
      const r = await api.post("/admin/backup");
      if (r.data?.data) {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(r.data.data, null, 2));
        const downloadAnchor = document.createElement("a");
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `sentinel_backup_${new Date().toISOString().slice(0, 10)}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        toast.success("Database snapshot JSON exported and downloaded successfully!");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate database backup");
    }
  };

  const handleRestoreDb = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!window.confirm("WARNING: Restoring will completely delete and overwrite all current database records. Proceed?")) return;
    
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const payload = JSON.parse(evt.target.result);
        await api.post("/admin/restore", payload);
        toast.success("All database collections restored successfully!");
        fetchDashboardStats();
      } catch (err) {
        console.error(err);
        toast.error("Failed to parse or restore database snapshot file.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-6 font-sans text-white flex flex-col md:flex-row gap-6 min-h-[calc(100vh-6rem)]" data-testid="admin-panel-root">
      
      {/* Sidebar navigation */}
      <aside className="w-full md:w-64 bg-slate-900 border border-slate-800 rounded-md p-4 flex flex-col gap-1 shrink-0 h-fit">
        <div className="mb-4 px-2">
          <div className="text-[10px] uppercase tracking-[0.2em] text-blue-400 font-bold">Admin Console</div>
          <div className="text-sm font-black tracking-tight text-white mt-0.5">Control Terminal</div>
        </div>
        {[
          { id: "dashboard", label: "Overview Stats", icon: Gauge },
          { id: "users", label: "User Accounts", icon: Users },
          { id: "cases", label: "Case Folders", icon: Folder },
          { id: "matches", label: "AI Face Review", icon: Cpu },
          { id: "handoff_chats", label: "Handoff Queue", icon: ChatCircleText },
          { id: "notifications", label: "Broadcast Alerts", icon: Megaphone },
          { id: "audit", label: "Compliance Audit", icon: Receipt },
          { id: "settings", label: "System Config", icon: Sliders },
          { id: "disaster_recovery", label: "Disaster Recovery", icon: ShieldCheck }
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`w-full text-left px-3 py-2 rounded-md text-xs font-semibold flex items-center gap-2.5 transition ${
                activeTab === t.id ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-950 hover:text-white"
              }`}
            >
              <Icon size={16} />
              {t.label}
            </button>
          );
        })}
      </aside>

      {/* Primary display body */}
      <main className="flex-1 min-w-0">
        
        {/* OVERVIEW STATS TAB */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-xl font-bold tracking-tight">System Status Overview</h2>
                <p className="text-xs text-slate-400">Real-time command telemetry metrics & CPU utilization.</p>
              </div>
              <button onClick={fetchDashboardStats} className="bg-slate-900 hover:bg-slate-850 border border-slate-800 text-[10px] uppercase font-bold px-3 py-1.5 rounded transition">
                Refresh telemetry
              </button>
            </div>

            {loadingStats ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-pulse">
                {[1,2,3,4].map(n => <div key={n} className="h-24 bg-slate-900 border border-slate-800 rounded-md"></div>)}
              </div>
            ) : stats && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-md">
                    <div className="text-[9px] uppercase tracking-wider text-slate-500">Total Registered Users</div>
                    <div className="text-2xl font-bold font-mono mt-1 text-white">{stats.active_users}</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-md">
                    <div className="text-[9px] uppercase tracking-wider text-slate-500">Active Missing Files</div>
                    <div className="text-2xl font-bold font-mono mt-1 text-blue-400">{stats.active_investigations}</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-md">
                    <div className="text-[9px] uppercase tracking-wider text-slate-500">Found/Recovered Children</div>
                    <div className="text-2xl font-bold font-mono mt-1 text-emerald-400">{stats.resolved_cases}</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-md">
                    <div className="text-[9px] uppercase tracking-wider text-slate-500">Pending Approvals</div>
                    <div className="text-2xl font-bold font-mono mt-1 text-amber-500">{stats.pending_reports}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-900 border border-slate-800 p-5 rounded-md space-y-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5 border-b border-slate-800 pb-2">
                      <Cpu size={16} className="text-cyan-400" /> Host Machine Uptime & Diagnostics
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase">CPU Utilization</div>
                        <div className="text-sm font-bold text-white mt-0.5">{stats.system_health?.cpu_usage}%</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase">Memory Footprint</div>
                        <div className="text-sm font-bold text-white mt-0.5">{stats.system_health?.memory_usage}%</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase">Server Status</div>
                        <div className="text-sm font-bold text-emerald-400 mt-0.5">{stats.ai_usage?.api_status.toUpperCase()}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase">Uptime Ratio</div>
                        <div className="text-sm font-bold text-white mt-0.5">{stats.system_health?.uptime}</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-5 rounded-md space-y-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5 border-b border-slate-800 pb-2">
                      <Gear size={16} className="text-emerald-400" /> Database & Staffing
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase">Mongo Connection</div>
                        <div className="text-sm font-bold text-emerald-400 mt-0.5">{stats.ai_usage?.db_status.toUpperCase()}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase">Active Police Staff</div>
                        <div className="text-sm font-bold text-white mt-0.5">{stats.online_police} active</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase">Active NGO Agents</div>
                        <div className="text-sm font-bold text-white mt-0.5">{stats.online_ngos} active</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase">Active Telephony Calls</div>
                        <div className="text-sm font-bold text-white mt-0.5">{stats.live_calls} connected</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* USER MANAGER TAB */}
        {activeTab === "users" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-xl font-bold tracking-tight">User Accounts Control</h2>
                <p className="text-xs text-slate-400">Suspend accounts, change roles, or execute GDPR-compliant deletions.</p>
              </div>
              <div className="relative">
                <FileMagnifyingGlass size={14} className="absolute left-2.5 top-2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search user profile..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5 pl-8 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-52"
                />
              </div>
            </div>

            {loadingUsers ? (
              <div className="p-8 text-center text-slate-500 text-xs">Fetching registered accounts…</div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-md overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 text-slate-500 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3">User Profile</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList
                      .filter(u => u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase()))
                      .map((u) => (
                        <tr key={u.id} className="border-t border-slate-855 hover:bg-slate-955/20 transition">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-white">{u.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{u.email}</div>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={u.role}
                              onChange={(e) => handleUpdateUserRole(u.id, e.target.value)}
                              className="bg-slate-955 border border-slate-800 rounded px-2 py-1 text-xs text-white cursor-pointer"
                            >
                              <option value="citizen">Citizen</option>
                              <option value="police">Police</option>
                              <option value="ngo">NGO</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>
                          <td className="px-4 py-3 text-slate-400 font-mono">{u.department || "N/A"}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                              u.suspended ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            }`}>
                              {u.suspended ? "Suspended" : "Active"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right space-x-1.5">
                            <button
                              onClick={() => setEditingUser(u)}
                              className="text-blue-400 hover:text-blue-300 font-bold p-1"
                              title="Edit user details"
                            >
                              <UserGear size={16} />
                            </button>
                            <button
                              onClick={() => handleToggleSuspension(u.id, u.suspended)}
                              className={`p-1 font-bold ${u.suspended ? "text-emerald-400 hover:text-emerald-300" : "text-amber-400 hover:text-amber-300"}`}
                              title={u.suspended ? "Reactivate user" : "Suspend user"}
                            >
                              {u.suspended ? <UserCheck size={16} /> : <UserMinus size={16} />}
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u.id)}
                              className="text-red-400 hover:text-red-300 p-1"
                              title="GDPR permanently forget"
                            >
                              <Trash size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* EDIT USER DETAILS MODAL */}
            {editingUser && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                <form onSubmit={handleUpdateUserDetails} className="bg-slate-905 border border-slate-800 rounded-lg max-w-md w-full p-6 space-y-4 shadow-2xl relative">
                  <h3 className="text-md font-bold text-white font-display">Modify User Details</h3>
                  <div className="space-y-3 text-xs">
                    <div className="flex flex-col gap-1">
                      <label className="text-slate-400">Name</label>
                      <input
                        type="text"
                        value={editingUser.name}
                        onChange={(e) => setEditingUser({...editingUser, name: e.target.value})}
                        className="bg-slate-950 border border-slate-800 rounded p-2 text-white focus:outline-none"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-slate-400">Email Address</label>
                      <input
                        type="email"
                        value={editingUser.email}
                        onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                        className="bg-slate-950 border border-slate-800 rounded p-2 text-white focus:outline-none"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-slate-400">Department / NGO Unit</label>
                      <input
                        type="text"
                        value={editingUser.department || ""}
                        onChange={(e) => setEditingUser({...editingUser, department: e.target.value})}
                        placeholder="e.g. Bandra Police Station"
                        className="bg-slate-950 border border-slate-800 rounded p-2 text-white focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 text-xs pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingUser(null)}
                      className="bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-bold"
                    >
                      Save details
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* CASE MANAGER TAB */}
        {activeTab === "cases" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-xl font-bold tracking-tight">Active Case Directories</h2>
                <p className="text-xs text-slate-400">Moderate case information details or override current file statuses.</p>
              </div>
              <div className="relative">
                <FileMagnifyingGlass size={14} className="absolute left-2.5 top-2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search case file name..."
                  value={caseSearch}
                  onChange={(e) => setCaseSearch(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5 pl-8 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-52"
                />
              </div>
            </div>

            {loadingCases ? (
              <div className="p-8 text-center text-slate-500 text-xs">Loading case inventory…</div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-md overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 text-slate-500 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Missing Person</th>
                      <th className="px-4 py-3">Last Seen Info</th>
                      <th className="px-4 py-3">Priority</th>
                      <th className="px-4 py-3">Investigation Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {casesList
                      .filter(c => c.person_name.toLowerCase().includes(caseSearch.toLowerCase()))
                      .map((c) => (
                        <tr key={c.id} className="border-t border-slate-850 hover:bg-slate-955/20 transition">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-white">{c.person_name}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">Age {c.age} | {c.gender === "M" ? "Male" : "Female"}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-slate-300">{c.last_seen_location}</div>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">{c.city}, {c.state}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                              {c.priority}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={c.status}
                              onChange={(e) => handleUpdateCaseStatus(c.id, e.target.value)}
                              className="bg-slate-955 border border-slate-800 rounded px-2 py-1 text-xs text-white cursor-pointer"
                            >
                              <option value="open">Open (Missing)</option>
                              <option value="in_progress">Under Investigation</option>
                              <option value="ai_match_found">AI Match Found</option>
                              <option value="recovered">Recovered (Found)</option>
                              <option value="closed">Closed File</option>
                            </select>
                          </td>
                          <td className="px-4 py-3 text-right space-x-1">
                            <button
                              onClick={() => setEditingCase(c)}
                              className="text-blue-400 hover:text-blue-300 font-bold p-1.5"
                              title="Edit case metadata"
                            >
                              <Gear size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteCase(c.id)}
                              className="text-red-400 hover:text-red-300 p-1.5"
                              title="Delete duplicate case file"
                            >
                              <Trash size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* EDIT CASE DETAILS MODAL */}
            {editingCase && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                <form onSubmit={handleUpdateCaseDetails} className="bg-slate-900 border border-slate-800 rounded-lg max-w-lg w-full p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
                  <h3 className="text-md font-bold text-white font-display">Modify Case Directory Metadata</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="flex flex-col gap-1">
                      <label className="text-slate-400">Full Name</label>
                      <input
                        type="text"
                        value={editingCase.person_name}
                        onChange={(e) => setEditingCase({...editingCase, person_name: e.target.value})}
                        className="bg-slate-950 border border-slate-800 rounded p-2 text-white focus:outline-none"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-slate-400">Age</label>
                      <input
                        type="number"
                        value={editingCase.age}
                        onChange={(e) => setEditingCase({...editingCase, age: parseInt(e.target.value)})}
                        className="bg-slate-950 border border-slate-800 rounded p-2 text-white focus:outline-none"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-slate-400">Gender</label>
                      <select
                        value={editingCase.gender}
                        onChange={(e) => setEditingCase({...editingCase, gender: e.target.value})}
                        className="bg-slate-950 border border-slate-800 rounded p-2 text-white focus:outline-none"
                      >
                        <option value="M">Male</option>
                        <option value="F">Female</option>
                        <option value="O">Other</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-slate-400">Priority Level</label>
                      <select
                        value={editingCase.priority}
                        onChange={(e) => setEditingCase({...editingCase, priority: e.target.value})}
                        className="bg-slate-950 border border-slate-800 rounded p-2 text-white focus:outline-none"
                      >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                        <option value="Critical">Critical</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1 sm:col-span-2">
                      <label className="text-slate-400">Last Seen Specific Location</label>
                      <input
                        type="text"
                        value={editingCase.last_seen_location}
                        onChange={(e) => setEditingCase({...editingCase, last_seen_location: e.target.value})}
                        className="bg-slate-950 border border-slate-800 rounded p-2 text-white focus:outline-none"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-slate-400">City</label>
                      <input
                        type="text"
                        value={editingCase.city}
                        onChange={(e) => setEditingCase({...editingCase, city: e.target.value})}
                        className="bg-slate-950 border border-slate-800 rounded p-2 text-white focus:outline-none"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-slate-400">District</label>
                      <input
                        type="text"
                        value={editingCase.district}
                        onChange={(e) => setEditingCase({...editingCase, district: e.target.value})}
                        className="bg-slate-950 border border-slate-800 rounded p-2 text-white focus:outline-none"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-slate-400">State</label>
                      <input
                        type="text"
                        value={editingCase.state}
                        onChange={(e) => setEditingCase({...editingCase, state: e.target.value})}
                        className="bg-slate-950 border border-slate-800 rounded p-2 text-white focus:outline-none"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-slate-400">Clothes Worn</label>
                      <input
                        type="text"
                        value={editingCase.clothes_worn || ""}
                        onChange={(e) => setEditingCase({...editingCase, clothes_worn: e.target.value})}
                        className="bg-slate-950 border border-slate-800 rounded p-2 text-white focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1 sm:col-span-2">
                      <label className="text-slate-400">Physical Description</label>
                      <textarea
                        value={editingCase.physical_description || ""}
                        onChange={(e) => setEditingCase({...editingCase, physical_description: e.target.value})}
                        className="bg-slate-950 border border-slate-800 rounded p-2 text-white focus:outline-none h-14"
                      />
                    </div>
                    <div className="flex flex-col gap-1 sm:col-span-2">
                      <label className="text-slate-400">Special Identification Marks</label>
                      <textarea
                        value={editingCase.identification_marks || ""}
                        onChange={(e) => setEditingCase({...editingCase, identification_marks: e.target.value})}
                        className="bg-slate-950 border border-slate-800 rounded p-2 text-white focus:outline-none h-14"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 text-xs pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingCase(null)}
                      className="bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded font-semibold text-slate-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-bold"
                    >
                      Save Case details
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* AI FACE MATCH REVIEW TAB */}
        {activeTab === "matches" && (
          <div className="space-y-6">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-xl font-bold tracking-tight">AI Generated Face Matches</h2>
              <p className="text-xs text-slate-400">Review facial matches detected by AI cameras and approve to confirm location.</p>
            </div>

            {loadingMatches ? (
              <div className="p-8 text-center text-slate-500 text-xs">Analyzing camera matching indexes…</div>
            ) : matchesList.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-850 rounded bg-slate-900 text-xs text-slate-500">
                No potential AI face matches logged in the system.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {matchesList.map((m) => (
                  <div key={`${m.investigation_id}-${m.match_index}`} className="border border-slate-800 rounded-md bg-slate-900 overflow-hidden flex flex-col justify-between">
                    <div className="p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] bg-blue-600/10 text-blue-400 border border-blue-600/30 px-2 py-0.5 rounded font-bold font-mono">
                          Confidence Index: {Math.round(m.score * 100)}%
                        </span>
                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                          m.status === "approved" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                          m.status === "rejected" ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-slate-800 text-slate-400"
                        }`}>{m.status}</span>
                      </div>
                      
                      {/* Photo side-by-side */}
                      <div className="grid grid-cols-2 gap-2 bg-slate-950 p-2 rounded">
                        <div className="space-y-1 text-center">
                          <div className="text-[8px] uppercase tracking-wider text-slate-500">Original Case Photo</div>
                          <img
                            src={m.photo_url || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150"}
                            alt="Reference"
                            className="h-24 w-full object-cover rounded"
                          />
                        </div>
                        <div className="space-y-1 text-center">
                          <div className="text-[8px] uppercase tracking-wider text-slate-500">AI Cam Snapshot</div>
                          <img
                            src={m.matched_photo_url}
                            alt="CCTV Match"
                            className="h-24 w-full object-cover rounded"
                          />
                        </div>
                      </div>

                      <div className="text-xs space-y-1 font-mono">
                        <div><span className="text-slate-500">Subject:</span> <span className="text-white font-bold">{m.person_name}</span> (Age {m.age})</div>
                        <div><span className="text-slate-500">Detected at:</span> <span className="text-cyan-400">{m.cam}</span></div>
                      </div>
                    </div>

                    {m.status === "pending" && (
                      <div className="grid grid-cols-2 border-t border-slate-850">
                        <button
                          onClick={() => handleMatchAction(m, "reject")}
                          className="py-2.5 bg-red-650/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold flex items-center justify-center gap-1.5 border-r border-slate-855 transition"
                        >
                          <X size={14} /> Reject Match
                        </button>
                        <button
                          onClick={() => handleMatchAction(m, "approve")}
                          className="py-2.5 bg-emerald-650/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                        >
                          <Check size={14} /> Approve & Locate
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* BROADCAST ALERTS TAB */}
        {activeTab === "notifications" && (
          <div className="space-y-6">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-xl font-bold tracking-tight">Broadcast Emergency Alerts</h2>
              <p className="text-xs text-slate-400">Send custom push warnings and notifications targeting specific users or regions.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Dispatch Form */}
              <form onSubmit={handleSendBroadcast} className="lg:col-span-1 bg-slate-900 border border-slate-800 p-5 rounded-md space-y-4">
                <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2">Dispatch Control</h3>
                
                <div className="space-y-3 text-xs">
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-400">Target Audience</label>
                    <select
                      value={broadcastTarget}
                      onChange={(e) => setBroadcastTarget(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded p-2 text-white focus:outline-none"
                    >
                      <option value="all">All Registered Users</option>
                      <option value="location">Select Location (City)</option>
                      <option value="individual">Single Individual Agent</option>
                    </select>
                  </div>

                  {broadcastTarget === "location" && (
                    <div className="flex flex-col gap-1">
                      <label className="text-slate-400">Target City</label>
                      <input
                        type="text"
                        placeholder="e.g. Mumbai"
                        value={broadcastLocation}
                        onChange={(e) => setBroadcastLocation(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded p-2 text-white focus:outline-none"
                        required
                      />
                    </div>
                  )}

                  {broadcastTarget === "individual" && (
                    <div className="flex flex-col gap-1">
                      <label className="text-slate-400">Select Individual</label>
                      <select
                        value={broadcastUser}
                        onChange={(e) => setBroadcastUser(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded p-2 text-white focus:outline-none"
                        required
                      >
                        <option value="">-- Choose User --</option>
                        {usersList.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                      </select>
                    </div>
                  )}

                  <div className="flex flex-col gap-1">
                    <label className="text-slate-400">Priority Level</label>
                    <select
                      value={broadcastPriority}
                      onChange={(e) => setBroadcastPriority(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded p-2 text-white focus:outline-none"
                    >
                      <option value="Low">Low (Info)</option>
                      <option value="Medium">Medium (Attention)</option>
                      <option value="High">High (Urgent)</option>
                      <option value="Critical">Critical (Immediate action)</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-slate-400">Alert Title</label>
                    <input
                      type="text"
                      placeholder="e.g. AMBER ALERT: Mumbai West"
                      value={broadcastTitle}
                      onChange={(e) => setBroadcastTitle(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded p-2 text-white focus:outline-none"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-slate-400">Alert Message Body</label>
                    <textarea
                      placeholder="Type details to transmit..."
                      value={broadcastText}
                      onChange={(e) => setBroadcastText(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded p-2 text-white focus:outline-none h-20"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={sendingBroadcast}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white py-2 rounded text-xs font-bold flex items-center justify-center gap-1.5 transition"
                >
                  <PaperPlaneTilt size={14} /> {sendingBroadcast ? "Sending..." : "Transmit Announcement"}
                </button>
              </form>

              {/* History Timeline */}
              <div className="lg:col-span-2 bg-slate-900 border border-slate-800 p-5 rounded-md space-y-4">
                <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2">Announcement Transmission Log</h3>
                
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {notificationsHistory.map((n) => (
                    <div key={n.id} className="border border-slate-850 bg-slate-955/20 p-3 rounded text-xs space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-mono uppercase ${
                          n.priority === "Critical" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                          n.priority === "High" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-slate-800 text-slate-400"
                        }`}>{n.priority}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(n.timestamp).toLocaleDateString()} {new Date(n.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                      <p className="text-slate-350">{n.description}</p>
                    </div>
                  ))}
                  {notificationsHistory.length === 0 && (
                    <div className="text-center py-10 text-slate-500 text-xs">No alerts history recorded</div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* COMPLIANCE AUDIT TRAIL TAB */}
        {activeTab === "audit" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-xl font-bold tracking-tight">Compliance Action Audit Log</h2>
                <p className="text-xs text-slate-400">Verifiable logging of administrator modifications and GDPR forgotten events.</p>
              </div>
              <div className="relative">
                <FileMagnifyingGlass size={14} className="absolute left-2.5 top-2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter log actions..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5 pl-8 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-52"
                />
              </div>
            </div>

            {loadingAudits ? (
              <div className="p-8 text-center text-slate-500 text-xs">Extracting compliance registers…</div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-md overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 text-slate-500 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3">Executor</th>
                      <th className="px-4 py-3">Action Type</th>
                      <th className="px-4 py-3">Details summary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs
                      .filter(l => l.action.toLowerCase().includes(auditSearch.toLowerCase()) || l.description.toLowerCase().includes(auditSearch.toLowerCase()) || l.email.toLowerCase().includes(auditSearch.toLowerCase()))
                      .map((log, idx) => (
                        <tr key={idx} className="border-t border-slate-850 hover:bg-slate-955/20 transition">
                          <td className="px-4 py-3 text-slate-400 font-mono text-[10px]">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-white">{log.email}</div>
                            <div className="text-[9px] uppercase tracking-wider text-slate-500">{log.role}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded bg-slate-950 text-blue-400 font-mono text-[10px]">
                              {log.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-350 font-medium">
                            {log.description}
                          </td>
                        </tr>
                      ))}
                    {auditLogs.length === 0 && (
                      <tr>
                        <td colSpan="4" className="text-center py-10 text-slate-500">No logs stored yet</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SYSTEM SETTINGS TAB */}
        {activeTab === "settings" && (
          <div className="space-y-6">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-xl font-bold tracking-tight">System Global Settings</h2>
              <p className="text-xs text-slate-400">Configure AI face matching thresholds, upload constraints, and communication alerts.</p>
            </div>

            <form onSubmit={handleSaveSettings} className="bg-slate-900 border border-slate-800 p-6 rounded-md space-y-6 max-w-xl">
              <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2 flex items-center gap-1.5">
                <Sliders size={16} className="text-blue-400" /> Threshold Parameters
              </h3>

              <div className="space-y-4 text-xs">
                {/* AI Matching Threshold */}
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <label className="text-slate-400 font-semibold">AI Face Match Similarity Threshold</label>
                    <span className="font-mono text-cyan-400 font-bold">{Math.round(settings.ai_threshold * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="0.99"
                    step="0.01"
                    value={settings.ai_threshold}
                    onChange={(e) => setSettings({...settings, ai_threshold: parseFloat(e.target.value)})}
                    className="w-full accent-blue-500 bg-slate-950 cursor-pointer h-1.5 rounded"
                  />
                  <div className="text-[10px] text-slate-500">Higher values reduce false positives but might miss potential face matches under low-light conditions.</div>
                </div>

                {/* Upload Size Limit */}
                <div className="space-y-1">
                  <label className="text-slate-400 font-semibold">Maximum File Upload Size (MB)</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={settings.max_upload_size_mb}
                    onChange={(e) => setSettings({...settings, max_upload_size_mb: parseInt(e.target.value)})}
                    className="w-full bg-slate-950 border border-slate-850 rounded p-2 text-white mt-1"
                    required
                  />
                  <div className="text-[10px] text-slate-500">Allowed upload size constraints for jpeg/png files to avoid server memory exhaust.</div>
                </div>

                {/* Allowed File Formats */}
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-semibold">Allowed Upload Extensions</label>
                  <div className="flex gap-4 items-center bg-slate-950 p-2.5 rounded border border-slate-850">
                    {["jpg", "jpeg", "png", "webp"].map((ext) => {
                      const active = settings.allowed_file_types.includes(ext);
                      return (
                        <label key={ext} className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={() => {
                              const newList = active 
                                ? settings.allowed_file_types.filter(t => t !== ext)
                                : [...settings.allowed_file_types, ext];
                              setSettings({...settings, allowed_file_types: newList});
                            }}
                            className="accent-blue-500"
                          />
                          <span className="uppercase text-[10px] font-mono font-semibold">{ext}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Notification Settings */}
                <h3 className="text-sm font-bold text-white border-b border-slate-850 pb-2 pt-2 flex items-center gap-1.5">
                  <Megaphone size={16} className="text-emerald-400" /> Notifications Channels
                </h3>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-350 hover:text-white">
                    <input
                      type="checkbox"
                      checked={settings.enable_push_notifications}
                      onChange={(e) => setSettings({...settings, enable_push_notifications: e.checked})}
                      className="accent-emerald-500 w-4 h-4"
                    />
                    <div>
                      <div className="font-semibold">Enable Browser Native Push Notifications</div>
                      <div className="text-[9px] text-slate-500">Notify active police stations immediately of AI matches.</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-350 hover:text-white">
                    <input
                      type="checkbox"
                      checked={settings.enable_email_notifications}
                      onChange={(e) => setSettings({...settings, enable_email_notifications: e.checked})}
                      className="accent-emerald-500 w-4 h-4"
                    />
                    <div>
                      <div className="font-semibold">Enable Automated Email Alerts (SMTP Relay)</div>
                      <div className="text-[9px] text-slate-500">Dispatch copies of emergency announcements to users.</div>
                    </div>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={savingSettings}
                className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded font-bold text-xs flex items-center gap-2 transition"
              >
                <FloppyDisk size={14} /> {savingSettings ? "Saving Settings..." : "Save Configurations"}
              </button>
            </form>
          </div>
        )}

        {/* DISASTER RECOVERY TAB */}
        {activeTab === "disaster_recovery" && (
          <div className="space-y-6">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-xl font-bold tracking-tight">Database Disaster Recovery</h2>
              <p className="text-xs text-slate-400">Export backups or restore all databases of RescueNet-AI.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border border-slate-800 rounded-md bg-slate-900 p-5 space-y-4">
                <div className="flex items-center gap-2 text-cyan-400">
                  <ShieldCheck size={20} />
                  <h3 className="font-display font-bold text-sm text-white">Export Database Backup</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Downloads a full JSON file snapshot of all MongoDB collections, including users registries, case folders, sightings, and active timeline parameters.
                </p>
                <button
                  onClick={handleBackupDb}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded transition"
                >
                  Download DB Snapshot
                </button>
              </div>

              <div className="border border-slate-800 rounded-md bg-slate-900 p-5 space-y-4">
                <div className="flex items-center gap-2 text-amber-500">
                  <Warning size={20} />
                  <h3 className="font-display font-bold text-sm text-white">Restore Database Snapshot</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Upload a previously exported database snapshot JSON file to overwrite all existing collections. Warning: This is irreversible and overwrites active data.
                </p>
                <div className="flex flex-col gap-2">
                  <input
                    type="file"
                    accept=".json"
                    id="restore-file-input"
                    onChange={handleRestoreDb}
                    className="hidden"
                  />
                  <button
                    onClick={() => document.getElementById("restore-file-input").click()}
                    className="border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold px-4 py-2 rounded transition self-start"
                  >
                    Select File & Restore
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* HANDOFF CHATS TAB */}
        {activeTab === "handoff_chats" && (
          <div className="space-y-6">
            <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold tracking-tight">Human Handoff queues</h2>
                <p className="text-xs text-slate-400">Respond directly to active citizen inquiries transferred to human assistance.</p>
              </div>
              <button 
                onClick={fetchHandoffs}
                className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] uppercase font-bold px-3 py-1.5 rounded transition"
              >
                Refresh Queue
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left pane: sessions list */}
              <div className="border border-slate-800 rounded-md bg-slate-900 p-4 h-[550px] flex flex-col">
                <h3 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">Active Transfers ({activeHandoffs.length})</h3>
                {loadingHandoffs ? (
                  <div className="text-center py-12 text-slate-500 text-xs">Loading active queue...</div>
                ) : activeHandoffs.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs">No active handoff requests.</div>
                ) : (
                  <div className="space-y-2 overflow-y-auto flex-1 pr-1">
                    {activeHandoffs.map((h, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={async () => {
                          const r = await api.get(`/chat/history/${h.session_id}`);
                          setSelectedHandoff({ ...h, messages: r.data });
                        }}
                        className={`w-full p-3 rounded-md border text-left transition flex flex-col gap-1 ${
                          selectedHandoff?.session_id === h.session_id
                            ? "bg-blue-600/20 border-blue-500 text-white"
                            : "bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900"
                        }`}
                      >
                        <div className="flex justify-between items-center w-full">
                          <span className="font-mono text-xs font-bold">Session ID: {h.session_id.slice(0, 8)}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 uppercase font-mono font-semibold">
                            {h.assigned_role}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500">
                          Requested: {new Date(h.handoff_requested_at).toLocaleTimeString()}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Right pane: message history & reply */}
              <div className="lg:col-span-2 border border-slate-800 rounded-md bg-slate-900 p-4 h-[550px] flex flex-col">
                {selectedHandoff ? (
                  <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="border-b border-slate-800 pb-3 mb-3 flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-white uppercase font-mono">Chat Session: {selectedHandoff.session_id}</h4>
                        <span className="text-[10px] text-slate-500">Role: {selectedHandoff.role}</span>
                      </div>
                      <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping"></span>
                    </div>

                    {/* Messages Scroll Feed */}
                    <div className="flex-1 overflow-y-auto space-y-3 bg-slate-950 p-4 rounded border border-slate-850 mb-4 text-xs">
                      {(selectedHandoff.messages || []).map((msg, i) => (
                        <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                          <div className={`p-2.5 rounded-lg max-w-[80%] leading-relaxed ${
                            msg.role === "user" 
                              ? "bg-cyan-600 text-white rounded-br-none" 
                              : "bg-slate-800 text-slate-200 rounded-bl-none border border-slate-750"
                          }`}>
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                            {msg.sender_name && (
                              <div className="text-[8px] text-cyan-400 mt-1 uppercase font-semibold">
                                Reply: {msg.sender_name} ({msg.sender_role})
                              </div>
                            )}
                          </div>
                          <span className="text-[8px] text-slate-500 mt-0.5 font-mono">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Reply box */}
                    <form onSubmit={handleSendHandoffReply} className="flex gap-2 shrink-0">
                      <textarea
                        value={humanReplyText}
                        onChange={e => setHumanReplyText(e.target.value)}
                        placeholder="Type human response to citizen..."
                        className="flex-1 bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white placeholder-slate-600 resize-none h-12 focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="submit"
                        className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 rounded transition self-stretch flex items-center justify-center gap-1.5"
                      >
                        <PaperPlaneTilt size={16} /> Send
                      </button>
                    </form>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs">
                    <ChatCircleText size={32} className="mb-2 text-slate-600" />
                    Select a handed off chat session from the queue to start responding.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
