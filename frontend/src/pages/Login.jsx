import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Shield } from "@phosphor-icons/react";
import { toast } from "sonner";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("admin@sentinel.gov");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try { await login(email, password); nav("/"); }
    catch (err) { toast.error(err.response?.data?.detail || "Login failed"); }
    finally { setLoading(false); }
  };

  const demos = [
    ["admin@sentinel.gov", "admin123", "Admin"],
    ["police@sentinel.gov", "police123", "Police"],
    ["ngo@sentinel.gov", "ngo123", "NGO"],
    ["citizen@sentinel.gov", "citizen123", "Citizen"],
  ];

  return (
    <div className="min-h-screen bg-slate-950 grid-bg flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-sm bg-blue-600 flex items-center justify-center">
            <Shield weight="fill" size={22} className="text-white" />
          </div>
          <div>
            <div className="font-display font-black text-2xl tracking-tight">SENTINEL<span className="text-blue-500">.</span></div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Command Center · Missing Persons</div>
          </div>
        </div>

        <div className="border border-slate-800 rounded-md bg-slate-900 p-8">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-1">Authorized personnel only</div>
          <h1 className="font-display text-2xl font-bold mb-6">Sign in to continue</h1>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-400 mb-1.5 block">Email</label>
              <input data-testid="login-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-400 mb-1.5 block">Password</label>
              <input data-testid="login-password" type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
            <button data-testid="login-submit" type="submit" disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium py-2.5 rounded-md transition-colors disabled:opacity-50">
              {loading ? "Authenticating…" : "Access Command"}
            </button>
          </form>
          <div className="mt-6 text-xs text-slate-500">
            No account? <Link to="/register" className="text-blue-400 hover:text-blue-300" data-testid="link-register">Register here</Link>
          </div>
        </div>

        <div className="mt-6 border border-slate-800 rounded-md bg-slate-900/50 p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-3">Demo Credentials — Click to use</div>
          <div className="grid grid-cols-2 gap-2">
            {demos.map(([e, p, r]) => (
              <button key={e} data-testid={`demo-${r.toLowerCase()}`} onClick={() => { setEmail(e); setPassword(p); }}
                className="text-left border border-slate-800 rounded-md p-2 hover:bg-slate-800 hover:border-slate-700 transition">
                <div className="text-xs font-medium">{r}</div>
                <div className="text-[10px] text-slate-500 font-mono truncate">{e}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
