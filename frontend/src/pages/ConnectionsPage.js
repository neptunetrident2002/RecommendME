import { useState, useEffect } from "react";
import API from "@/lib/api";
import { Users, UserX, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ConnectionsPage() {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadConnections(); }, []);

  const loadConnections = async () => {
    try {
      const { data } = await API.get("/connections");
      setConnections(data);
    } catch {} finally { setLoading(false); }
  };

  const handleDisconnect = async (id) => {
    if (!window.confirm("Are you sure you want to disconnect?")) return;
    try {
      await API.post(`/connections/${id}/disconnect`);
      toast.success("Disconnected");
      loadConnections();
    } catch { toast.error("Could not disconnect"); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
      <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA] px-6 py-8" data-testid="connections-page">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-gray-900 tracking-tight mb-2" data-testid="connections-title">Connections</h1>
        <p className="text-gray-500 font-body mb-8">People you've mutually followed after an exchange.</p>

        {connections.length === 0 ? (
          <div className="text-center py-20 bg-white border-2 border-gray-200 rounded-3xl shadow-[0_8px_0_#e5e7eb]" data-testid="connections-empty">
            <Users size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="font-heading text-xl font-semibold text-gray-900 mb-2">No connections yet</h3>
            <p className="text-gray-500 font-body text-sm">When you and a stranger mutually follow after an exchange, a connection is formed.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {connections.map((conn) => (
              <div key={conn.id} className="bg-white border-2 border-gray-200 rounded-3xl p-5 shadow-[0_6px_0_#e5e7eb] flex items-center justify-between" data-testid={`connection-${conn.id}`}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#58CC02]/10 flex items-center justify-center">
                    <Users size={20} className="text-[#58CC02]" strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="font-heading font-semibold text-gray-900">
                      {conn.other_user?.display_name || "Anonymous"}
                    </h3>
                    {conn.other_user?.city && (
                      <p className="text-sm text-gray-400 font-body">{conn.other_user.city}</p>
                    )}
                    <p className="text-xs text-gray-300 font-body mt-1">
                      Connected {new Date(conn.formed_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <button onClick={() => handleDisconnect(conn.id)} data-testid={`disconnect-${conn.id}`}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex items-center gap-2">
                  <UserX size={16} /> Disconnect
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
