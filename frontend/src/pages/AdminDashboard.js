import { useState, useEffect } from "react";
import API from "@/lib/api";
import { Users, BarChart3, Flag, Shield, Ban, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState(null);
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("metrics");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [mRes, rRes, uRes] = await Promise.all([
        API.get("/admin/metrics"),
        API.get("/admin/reports"),
        API.get("/admin/users"),
      ]);
      setMetrics(mRes.data);
      setReports(rRes.data);
      setUsers(uRes.data);
    } catch (err) {
      toast.error("Failed to load admin data");
    } finally { setLoading(false); }
  };

  const handleBan = async (userId) => {
    try {
      await API.post(`/admin/ban/${userId}`);
      toast.success("User banned");
      loadData();
    } catch { toast.error("Could not ban user"); }
  };

  const handleUnban = async (userId) => {
    try {
      await API.post(`/admin/unban/${userId}`);
      toast.success("User unbanned");
      loadData();
    } catch { toast.error("Could not unban"); }
  };

  const handleResolve = async (reportId) => {
    try {
      await API.post(`/admin/resolve-report/${reportId}`);
      toast.success("Report resolved");
      loadData();
    } catch { toast.error("Could not resolve"); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
      <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA] px-6 py-8" data-testid="admin-dashboard">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gray-900 flex items-center justify-center shadow-[0_4px_0_#374151]">
            <Shield size={24} className="text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="font-heading text-3xl font-semibold text-gray-900" data-testid="admin-title">Admin Dashboard</h1>
            <p className="text-gray-500 font-body text-sm">RecommendME Operations</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-8 bg-white border-2 border-gray-200 rounded-2xl p-1 h-auto">
            <TabsTrigger value="metrics" className="rounded-xl font-bold px-6 py-2.5 data-[state=active]:bg-brand-primary data-[state=active]:text-white" data-testid="admin-tab-metrics">
              <BarChart3 size={16} className="mr-2" /> Metrics
            </TabsTrigger>
            <TabsTrigger value="reports" className="rounded-xl font-bold px-6 py-2.5 data-[state=active]:bg-brand-primary data-[state=active]:text-white" data-testid="admin-tab-reports">
              <Flag size={16} className="mr-2" /> Reports ({metrics?.open_reports || 0})
            </TabsTrigger>
            <TabsTrigger value="users" className="rounded-xl font-bold px-6 py-2.5 data-[state=active]:bg-brand-primary data-[state=active]:text-white" data-testid="admin-tab-users">
              <Users size={16} className="mr-2" /> Users
            </TabsTrigger>
          </TabsList>

          {/* Metrics Tab */}
          <TabsContent value="metrics">
            {metrics && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="admin-metrics-grid">
                <MetricCard label="Total Users" value={metrics.total_users} color="#1CB0F6" />
                <MetricCard label="Pro Users" value={metrics.pro_users} color="#58CC02" />
                <MetricCard label="Total Matches" value={metrics.total_matches} color="#FF9600" />
                <MetricCard label="Active Matches" value={metrics.active_matches} color="#FF4B4B" />
                <MetricCard label="Connections" value={metrics.total_connections} color="#58CC02" />
                <MetricCard label="Follow Rate" value={`${metrics.follow_rate}%`} color="#FFC800" />
                <MetricCard label="Mutual Rate" value={`${metrics.mutual_follow_rate}%`} color="#1CB0F6" />
                <MetricCard label="In Pool Now" value={metrics.pool_count} color="#FF4B4B" />
                <MetricCard label="List Entries" value={metrics.total_list_entries} color="#FF9600" />
                <MetricCard label="Completions" value={metrics.total_completions} color="#58CC02" />
                <MetricCard label="Open Reports" value={metrics.open_reports} color="#FF4B4B" />
                <MetricCard label="Link Submissions" value={metrics.total_link_submissions} color="#1CB0F6" />
                <MetricCard label="Shareable Links" value={metrics.total_shareable_links} color="#FFC800" />
                <MetricCard label="Banned Users" value={metrics.banned_users} color="#FF4B4B" />
                <MetricCard label="Total Follows" value={metrics.total_follows} color="#58CC02" />
                <MetricCard label="Completed Matches" value={metrics.completed_matches} color="#FF9600" />
              </div>
            )}
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports">
            {reports.length === 0 ? (
              <div className="text-center py-12 bg-white border-2 border-gray-200 rounded-3xl" data-testid="reports-empty">
                <Flag size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="font-heading font-semibold text-gray-900">No reports yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reports.map((r) => (
                  <div key={r.id} className={`bg-white border-2 rounded-2xl p-4 ${r.resolved_at ? "border-gray-200 opacity-60" : "border-red-200"}`} data-testid={`report-${r.id}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-widest text-red-500">{r.reason}</span>
                        {r.detail && <p className="text-sm text-gray-600 mt-1">{r.detail}</p>}
                        <p className="text-xs text-gray-400 mt-2">{new Date(r.created_at).toLocaleString()}</p>
                      </div>
                      <div className="flex gap-2">
                        {!r.resolved_at && (
                          <>
                            <button onClick={() => handleBan(r.reported_user_id)} data-testid={`ban-from-report-${r.id}`}
                              className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-red-500 hover:bg-red-600">
                              <Ban size={12} className="inline mr-1" /> Ban
                            </button>
                            <button onClick={() => handleResolve(r.id)} data-testid={`resolve-report-${r.id}`}
                              className="px-3 py-1 rounded-lg text-xs font-bold text-[#58CC02] bg-green-50 hover:bg-green-100">
                              <CheckCircle size={12} className="inline mr-1" /> Resolve
                            </button>
                          </>
                        )}
                        {r.resolved_at && <span className="text-xs text-gray-400">Resolved</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <div className="bg-white border-2 border-gray-200 rounded-3xl overflow-hidden" data-testid="admin-users-table">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-100">
                      <th className="text-left px-4 py-3 font-bold text-xs uppercase tracking-widest text-gray-400">Email</th>
                      <th className="text-left px-4 py-3 font-bold text-xs uppercase tracking-widest text-gray-400">Name</th>
                      <th className="text-left px-4 py-3 font-bold text-xs uppercase tracking-widest text-gray-400">Status</th>
                      <th className="text-left px-4 py-3 font-bold text-xs uppercase tracking-widest text-gray-400">Matches</th>
                      <th className="text-right px-4 py-3 font-bold text-xs uppercase tracking-widest text-gray-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50" data-testid={`admin-user-${u.id}`}>
                        <td className="px-4 py-3 font-medium text-gray-700">{u.email}</td>
                        <td className="px-4 py-3 text-gray-500">{u.display_name || "-"}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {u.is_admin && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-900 text-white">Admin</span>}
                            {u.is_pro && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-brand-primary text-white">Pro</span>}
                            {u.is_banned && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white">Banned</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{u.matches_used || 0}</td>
                        <td className="px-4 py-3 text-right">
                          {!u.is_admin && (
                            u.is_banned ? (
                              <button onClick={() => handleUnban(u.id)} className="text-xs font-bold text-[#58CC02] hover:underline" data-testid={`unban-user-${u.id}`}>Unban</button>
                            ) : (
                              <button onClick={() => handleBan(u.id)} className="text-xs font-bold text-red-500 hover:underline" data-testid={`ban-user-${u.id}`}>Ban</button>
                            )
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

function MetricCard({ label, value, color }) {
  return (
    <div className="bg-white border-2 border-gray-200 rounded-2xl p-4 shadow-[0_4px_0_#e5e7eb]">
      <p className="text-xs font-bold uppercase tracking-widest text-gray-400">{label}</p>
      <p className="font-heading text-2xl font-bold mt-1" style={{ color }}>{value}</p>
    </div>
  );
}
