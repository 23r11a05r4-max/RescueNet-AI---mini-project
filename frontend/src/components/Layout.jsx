import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Shield, GridFour, FileMagnifyingGlass, FileText, SignOut, Users, Receipt, Gear, BookOpen, Microphone, Bell, Check, Trash, MapPin, HandHeart } from "@phosphor-icons/react";
import AIChat from "./AIChat";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { toast } from "sonner";

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const nav_ = useNavigate();
  
  const [alerts, setAlerts] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const fetchAlerts = async () => {
    try {
      const r = await api.get("/alerts?limit=30");
      setAlerts(r.data);
    } catch (err) {
      console.error("Failed to load alerts:", err);
    }
  };

  const matchesPreferences = (alert) => {
    if (!user?.preferences) return true;
    const { notify_cities, notify_districts, notify_min_priority } = user.preferences;
    
    const priorityWeight = { Low: 1, Medium: 2, High: 3, Critical: 4 };
    const alertWeight = priorityWeight[alert.priority] || 1;
    const minWeight = priorityWeight[notify_min_priority] || 1;
    if (alertWeight < minWeight) return false;
    
    if (notify_cities && notify_cities.length > 0) {
      const descLower = alert.description.toLowerCase();
      const matchesCity = notify_cities.some(c => descLower.includes(c.toLowerCase()));
      if (!matchesCity) return false;
    }
    if (notify_districts && notify_districts.length > 0) {
      const descLower = alert.description.toLowerCase();
      const matchesDistrict = notify_districts.some(d => descLower.includes(d.toLowerCase()));
      if (!matchesDistrict) return false;
    }
    return true;
  };

  useEffect(() => {
    if (!user) return;
    fetchAlerts();
    
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = "localhost:8000";
    const wsUrl = `${protocol}//${host}/api/ws`;
    const ws = new WebSocket(wsUrl);
    
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "NEW_ALERT") {
          const newAlert = msg.data;
          window.dispatchEvent(new CustomEvent("new-case-registered"));
          if (matchesPreferences(newAlert)) {
            // Play notification audio
            try {
              const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-84.wav");
              audio.volume = 0.4;
              audio.play();
            } catch (e) {
              console.log("Audio play blocked by browser policies");
            }
            // Trigger browser native push notification
            if (Notification.permission === "granted") {
              new Notification(`RescueNet Alert: ${newAlert.priority} Priority`, {
                body: newAlert.description,
                icon: "/logo190.png"
              });
            }
            toast.info(newAlert.description, {
              description: `Priority: ${newAlert.priority}`,
            });
          }
          setAlerts(prev => [newAlert, ...prev].slice(0, 30));
        }
      } catch (err) {
        console.error("Failed to parse alert payload:", err);
      }
    };
    
    return () => ws.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const markAlertRead = async (alertId) => {
    try {
      await api.post(`/alerts/${alertId}/read`);
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === alertId
            ? { ...a, read_by: [...(a.read_by || []), user.id] }
            : a
        )
      );
      toast.success("Alert marked as read");
    } catch (err) {
      console.error("Failed to mark alert as read:", err);
    }
  };

  const clearAllAlerts = async () => {
    try {
      const unreads = alerts.filter(a => !a.read_by?.includes(user.id));
      await Promise.all(unreads.map(a => api.post(`/alerts/${a.id}/read`)));
      setAlerts((prev) =>
        prev.map((a) => ({
          ...a,
          read_by: [...(a.read_by || []), user.id]
        }))
      );
      toast.success("All alerts marked as read");
    } catch (err) {
      console.error("Failed to clear alerts:", err);
    }
  };

  const formatTimeAgo = (isoString) => {
    if (!isoString) return "";
    const d = new Date(isoString);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return d.toLocaleDateString();
  };

  const unreadCount = alerts.filter(a => !a.read_by?.includes(user?.id)).length;

  const nav = [
    { to: "/", label: "Command", icon: GridFour, testid: "nav-dashboard" }
  ];

  if (user) {
    nav.push({ to: "/investigations", label: "Investigations", icon: FileMagnifyingGlass, testid: "nav-investigations" });
    nav.push({ to: "/maps", label: "Live Map", icon: MapPin, testid: "nav-maps" });
    nav.push({ to: "/community", label: "Community", icon: HandHeart, testid: "nav-community" });
    if (user.role === "admin" || user.role === "police") {
      nav.push({ to: "/reports", label: "Reports", icon: FileText, testid: "nav-reports" });
      nav.push({ to: "/admin/knowledge-base", label: "Knowledge Base", icon: BookOpen, testid: "nav-knowledge-base" });
    }
    if (user.role === "admin") {
      nav.push({ to: "/admin/panel", label: "Admin Panel", icon: Gear, testid: "nav-admin-panel" });
    }
    nav.push({ to: "/voice-history", label: "Voice History", icon: Microphone, testid: "nav-voice-history" });
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto max-w-[1600px] px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2" data-testid="brand-link">
              <div className="w-7 h-7 rounded-sm bg-blue-600 flex items-center justify-center">
                <Shield weight="fill" size={16} className="text-white" />
              </div>
              <div className="font-display font-black tracking-tight text-lg">SENTINEL<span className="text-blue-500">.</span></div>
              <div className="hidden md:block text-[10px] tracking-[0.2em] uppercase text-slate-500 border-l border-slate-800 pl-3 ml-1">Command Center</div>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {nav.map(n => {
                const active = loc.pathname === n.to || (n.to !== "/" && loc.pathname.startsWith(n.to));
                const Icon = n.icon;
                return (
                  <Link key={n.to} to={n.to} data-testid={n.testid}
                    className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors ${active ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-900 hover:text-white"}`}>
                    <Icon size={16} />{n.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-400 font-mono uppercase tracking-widest">Live</span>
            </div>
            
            {/* Notification Bell Dropdown */}
            {user && (
              <div className="relative">
                <button
                  data-testid="notification-bell"
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="p-2 rounded-md text-slate-400 hover:bg-slate-900 hover:text-white transition-colors relative"
                >
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white font-mono scale-90">
                      {unreadCount}
                    </span>
                  )}
                </button>
                
                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-800 rounded-md shadow-2xl z-50 text-xs flex flex-col max-h-96">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950 rounded-t-md">
                      <span className="font-semibold text-slate-200">Alert Center</span>
                      {unreadCount > 0 && (
                        <button
                          onClick={clearAllAlerts}
                          className="text-[10px] text-blue-400 hover:underline"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    
                    <div className="overflow-y-auto flex-1 divide-y divide-slate-800/50">
                      {alerts.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 italic">No alerts yet</div>
                      ) : (
                        alerts.map((a) => {
                          const isUnread = !a.read_by?.includes(user.id);
                          const pColor =
                            a.priority === "Critical"
                              ? "text-red-400 border-red-500/20 bg-red-500/5"
                              : a.priority === "High"
                              ? "text-orange-400 border-orange-500/20 bg-orange-500/5"
                              : a.priority === "Medium"
                              ? "text-amber-400 border-amber-500/20"
                              : "text-slate-400";
                              
                          return (
                            <div
                              key={a.id}
                              className={`p-3 transition-colors ${
                                isUnread ? "bg-slate-900/60" : "bg-slate-950/20"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border font-mono ${pColor}`}>
                                  {a.priority}
                                </span>
                                <span className="text-[9px] text-slate-500 font-mono">
                                  {formatTimeAgo(a.timestamp)}
                                </span>
                              </div>
                              <p className="text-slate-300 mt-1 text-[11px] leading-normal">{a.description}</p>
                              {isUnread && (
                                <button
                                  onClick={() => markAlertRead(a.id)}
                                  className="mt-1.5 text-[9px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition"
                                >
                                  <Check size={10} /> Mark as read
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="text-right hidden md:block">
              <div className="text-xs text-slate-300 font-medium" data-testid="user-name">{user?.name}</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500" data-testid="user-role">{user?.role}</div>
            </div>
            <button data-testid="logout-btn" onClick={() => { logout(); nav_("/login"); }}
              className="p-2 rounded-md text-slate-400 hover:bg-slate-900 hover:text-white transition-colors">
              <SignOut size={16} />
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      
      {/* Global AI Chat Drawer Copilot */}
      {user && <AIChat role={user.role} />}
    </div>
  );
}
