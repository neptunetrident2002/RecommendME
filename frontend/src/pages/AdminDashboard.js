import { useState, useEffect } from "react";
import API from "@/lib/api";
import { Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState(null);
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("metrics");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [m, r, u] = await Promise.all([API.get("/admin/metrics"), API.get("/admin/reports"), API.get("/admin/users")]);
      setMetrics(m.data); setReports(r.data); setUsers(u.data);
    } catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  };

  const handleBan = async (id) => { try { await API.post(`/admin/ban/${id}`); toast.success("Banned"); loadData(); } catch {} };
  const handleUnban = async (id) => { try { await API.post(`/admin/unban/${id}`); toast.success("Unbanned"); loadData(); } catch {} };
  const handleResolve = async (id) => { try { await API.post(`/admin/resolve-report/${id}`); toast.success("Resolved"); loadData(); } catch {} };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#FFFDF7]"><Loader2 className="w-8 h-8 animate-spin text-[#1CB0F6]" /></div>;

  return (
    <div className="min-h-screen bg-[#FFFDF7] px-6 py-8" data-testid="admin-dashboard">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-lg border-2 border-[#1a1a1a] bg-[#1a1a1a] flex items-center justify-center">
            <Shield size={20} className="text-white" />
          </div>
          <h1 className="font-heading text-3xl font-semibold text-[#1a1a1a]" data-testid="admin-title">Admin</h1>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-white border-2 border-[#1a1a1a] rounded-xl p-1 h-auto mb-8">
            <TabsTrigger value="metrics" className="rounded-lg font-bold px-6 py-2.5 data-[state=active]:bg-[#1a1a1a] data-[state=active]:text-white" data-testid="admin-tab-metrics">Metrics</TabsTrigger>
            <TabsTrigger value="reports" className="rounded-lg font-bold px-6 py-2.5 data-[state=active]:bg-[#1a1a1a] data-[state=active]:text-white" data-testid="admin-tab-reports">Reports ({metrics?.open_reports || 0})</TabsTrigger>
            <TabsTrigger value="users" className="rounded-lg font-bold px-6 py-2.5 data-[state=active]:bg-[#1a1a1a] data-[state=active]:text-white" data-testid="admin-tab-users">Users</TabsTrigger>
          </TabsList>

          <TabsContent value="metrics">
            {metrics && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="admin-metrics-grid">
                <M label="Active today" value={metrics.active_today} color="#1CB0F6" />
                <M label="Connections" value={metrics.connections_formed} color="#58CC02" />
                <M label="Follow rate" value={`${metrics.mutual_follow_rate}%`} color="#FF9600" />
                <M label="LLM rate today" value={`${metrics.llm_fallback_rate_today}%`} color="#7C3AED" />
                <M label="Pro waitlist" value={metrics.pro_waitlist_count} color="#FFC800" />
                <M label="Open reports" value={metrics.open_reports} color="#FF4B4B" />
                <M label="Total users" value={metrics.total_users} color="#1a1a1a" />
                <M label="Total matches" value={metrics.total_matches} color="#6b6b6b" />
                <M label="Banned" value={metrics.banned_users} color="#FF4B4B" />
                <M label="In pool" value={metrics.pool_count} color="#1CB0F6" />
                <M label="Known blends" value={metrics.known_blends} color="#7C3AED" />
                <M label="Known signups" value={metrics.known_signups} color="#58CC02" />
              </div>
            )}
          </TabsContent>

          <TabsContent value="reports">
            {reports.length === 0 ? (
              <div className="bold-card p-10 text-center"><p className="text-[#6b6b6b]">No reports</p></div>
            ) : (
              <div className="space-y-3">
                {reports.map((r) => (
                  <div key={r.id} className={`bold-card p-4 ${r.resolved_at ? "opacity-50" : ""}`} data-testid={`report-${r.id}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="bold-badge bg-[#FF4B4B] text-white text-[10px]">{r.reason}</span>
                        {r.detail && <p className="text-sm text-[#6b6b6b] mt-1">{r.detail}</p>}
                        <p className="text-[10px] text-[#b0b0b0] mt-1">{new Date(r.created_at).toLocaleString()}</p>
                      </div>
                      {!r.resolved_at && (
                        <div className="flex gap-2">
                          <button onClick={() => handleBan(r.reported_user_id)} className="bold-btn bold-btn-red px-3 py-1 text-xs">Ban</button>
                          <button onClick={() => handleResolve(r.id)} className="bold-btn bold-btn-green px-3 py-1 text-xs">Resolve</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="users">
            <div className="bold-card overflow-hidden" data-testid="admin-users-table">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b-2 border-[#1a1a1a]">
                    <th className="text-left px-4 py-3 font-bold text-xs text-[#6b6b6b]">Email</th>
                    <th className="text-left px-4 py-3 font-bold text-xs text-[#6b6b6b]">Name</th>
                    <th className="text-left px-4 py-3 font-bold text-xs text-[#6b6b6b]">Status</th>
                    <th className="text-left px-4 py-3 font-bold text-xs text-[#6b6b6b]">Matches</th>
                    <th className="text-right px-4 py-3 font-bold text-xs text-[#6b6b6b]">Actions</th>
                  </tr></thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-[#f0f0f0] hover:bg-[#FFFDF7]" data-testid={`admin-user-${u.id}`}>
                        <td className="px-4 py-3 font-medium text-[#1a1a1a]">{u.email}</td>
                        <td className="px-4 py-3 text-[#6b6b6b]">{u.display_name || "-"}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {u.is_admin && <span className="bold-badge bg-[#1a1a1a] text-white text-[10px]">Admin</span>}
                            {u.is_pro && <span className="bold-badge bg-[#1CB0F6] text-white text-[10px]">Pro</span>}
                            {u.is_banned && <span className="bold-badge bg-[#FF4B4B] text-white text-[10px]">Banned</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#6b6b6b]">{u.match_count || 0}</td>
                        <td className="px-4 py-3 text-right">
                          {!u.is_admin && (u.is_banned
                            ? <button onClick={() => handleUnban(u.id)} className="text-xs font-bold text-[#58CC02] hover:underline">Unban</button>
                            : <button onClick={() => handleBan(u.id)} className="text-xs font-bold text-[#FF4B4B] hover:underline">Ban</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function M({ label, value, color }) {
  return (
    <div className="bold-card p-4">
      <p className="text-[10px] font-bold text-[#6b6b6b]">{label}</p>
      <p className="font-heading text-2xl font-bold mt-0.5" style={{ color }}>{value}</p>
    </div>
  );
}
