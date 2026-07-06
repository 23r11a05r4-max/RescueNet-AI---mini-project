import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Shield } from "@phosphor-icons/react";
import { toast } from "sonner";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "citizen", department: "" });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try { await register(form); nav("/"); }
    catch (err) { toast.error(err.response?.data?.detail || "Registration failed"); }
    finally { setLoading(false); }
  };

  const upd = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="min-h-screen bg-slate-950 grid-bg flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-sm bg-blue-600 flex items-center justify-center">
            <Shield weight="fill" size={22} className="text-white" />
          </div>
          <div>
            <div className="font-display font-black text-2xl tracking-tight">SENTINEL<span className="text-blue-500">.</span></div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Register new account</div>
          </div>
        </div>

        <div className="border border-slate-800 rounded-md bg-slate-900 p-8">
          <h1 className="font-display text-2xl font-bold mb-6">Create your account</h1>
          <form onSubmit={submit} className="space-y-4">
            <input data-testid="reg-name" placeholder="Full name" value={form.name} onChange={upd("name")}
              className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
            <input data-testid="reg-email" type="email" placeholder="Email" value={form.email} onChange={upd("email")}
              className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
            <input data-testid="reg-password" type="password" placeholder="Password" value={form.password} onChange={upd("password")}
              className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
            <select data-testid="reg-role" value={form.role} onChange={upd("role")}
              className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="citizen">Citizen</option>
              <option value="police">Police Officer</option>
              <option value="ngo">NGO Representative</option>
              <option value="admin">Administrator</option>
            </select>
            {(form.role === "police" || form.role === "ngo") && (
              <input data-testid="reg-dept" placeholder={form.role === "police" ? "Station name" : "NGO name"} value={form.department} onChange={upd("department")}
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            )}
            <button data-testid="reg-submit" type="submit" disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium py-2.5 rounded-md transition-colors disabled:opacity-50">
              {loading ? "Creating…" : "Register"}
            </button>
          </form>
          <div className="mt-6 text-xs text-slate-500">
            Have an account? <Link to="/login" className="text-blue-400 hover:text-blue-300" data-testid="link-login">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
