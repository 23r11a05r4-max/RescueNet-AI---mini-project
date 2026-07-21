import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Trash } from "@phosphor-icons/react";

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      const r = await api.get("/admin/users");
      setUsers(r.data);
    } catch (err) {
      toast.error("Failed to load users list");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const changeRole = async (userId, newRole) => {
    try {
      await api.patch(`/admin/users/${userId}/role`, { role: newRole });
      toast.success("Role updated successfully");
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update role");
    }
  };

  const deleteUser = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      toast.success("User deleted successfully");
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete user");
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6 space-y-6" data-testid="user-management-page">
      <div>
        <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Security Control</div>
        <h1 className="font-display text-3xl font-black tracking-tighter mt-1">User Management</h1>
      </div>

      <div className="border border-slate-800 rounded-md bg-slate-900 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-xs">Loading accounts…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-950 text-[10px] uppercase tracking-[0.15em] text-slate-500">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Department</th>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-slate-800 hover:bg-slate-800/40 transition">
                  <td className="px-4 py-3 text-white font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-slate-300 font-mono text-xs">{u.email}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{u.department || "N/A"}</td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      onChange={(e) => changeRole(u.id, e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white"
                    >
                      <option value="citizen">Citizen</option>
                      <option value="police">Police</option>
                      <option value="ngo">NGO</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => deleteUser(u.id)}
                      className="text-red-400 hover:text-red-300 p-1.5 rounded transition"
                      title="Delete User"
                    >
                      <Trash size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan="5" className="text-center py-10 text-slate-500 text-xs">
                    No users registered
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
