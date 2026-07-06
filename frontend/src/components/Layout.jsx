import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Shield, GridFour, FileMagnifyingGlass, FileText, SignOut } from "@phosphor-icons/react";

const nav = [
  { to: "/", label: "Command", icon: GridFour, testid: "nav-dashboard" },
  { to: "/investigations", label: "Investigations", icon: FileMagnifyingGlass, testid: "nav-investigations" },
  { to: "/reports", label: "Reports", icon: FileText, testid: "nav-reports" },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const nav_ = useNavigate();

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
    </div>
  );
}
