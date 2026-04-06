import { useState, useEffect } from "react";
import API from "@/lib/api";
import { Users, UserX, Send, Loader2, Megaphone, Plus, X, Sparkles, Eye, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ConnectionsPage() {
  const [connections, setConnections] = useState([]);
  const [broadcasts, setBroadcasts] = useState([]);
  const [blends, setBlends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("connections");
  const [showSendRec, setShowSendRec] = useState(null); // connection id
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [showBroadcastResponse, setShowBroadcastResponse] = useState(null);

  // Send rec form
  const [sendTitle, setSendTitle] = useState("");
  const [sendAuthor, setSendAuthor] = useState("");
  const [sendGenre, setSendGenre] = useState("");
  const [sendWhy, setSendWhy] = useState("");
  const [sending, setSending] = useState(false);

  // Broadcast form
  const [broadcastCat, setBroadcastCat] = useState("read");
  const [broadcastText, setBroadcastText] = useState("");
  const [creatingBroadcast, setCreatingBroadcast] = useState(false);

  // Broadcast response form
  const [brTitle, setBrTitle] = useState("");
  const [brAuthor, setBrAuthor] = useState("");
  const [brGenre, setBrGenre] = useState("");
  const [brWhy, setBrWhy] = useState("");
  const [brSubmitting, setBrSubmitting] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [cRes, bRes, blRes] = await Promise.all([
        API.get("/connections"),
        API.get("/broadcasts"),
        API.get("/blends"),
      ]);
      setConnections(cRes.data);
      setBroadcasts(bRes.data);
      setBlends(blRes.data);
    } catch {} finally { setLoading(false); }
  };

  const handleDisconnect = async (id) => {
    if (!window.confirm("Disconnect?")) return;
    try { await API.post(`/connections/${id}/disconnect`); toast.success("Disconnected"); loadAll(); } catch {}
  };

  const handleSendRec = async (e) => {
    e.preventDefault();
    if (sendWhy.length < 20) { toast.error("Why-note must be at least 20 characters"); return; }
    setSending(true);
    try {
      await API.post("/connection-exchange", { connection_id: showSendRec, title: sendTitle, author: sendAuthor, genre: sendGenre, why_note: sendWhy });
      toast.success("Recommendation sent!");
      setShowSendRec(null);
      setSendTitle(""); setSendAuthor(""); setSendGenre(""); setSendWhy("");
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
    finally { setSending(false); }
  };

  const handleCreateBroadcast = async (e) => {
    e.preventDefault();
    setCreatingBroadcast(true);
    try {
      await API.post("/broadcasts", { category: broadcastCat, request_text: broadcastText });
      toast.success("Broadcast sent!");
      setShowBroadcast(false);
      setBroadcastText("");
      loadAll();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
    finally { setCreatingBroadcast(false); }
  };

  const handleBroadcastResponse = async (e) => {
    e.preventDefault();
    if (brWhy.length < 20) { toast.error("Why-note min 20 chars"); return; }
    setBrSubmitting(true);
    try {
      await API.post("/broadcasts/respond", { broadcast_id: showBroadcastResponse, title: brTitle, author: brAuthor, genre: brGenre, why_note: brWhy });
      toast.success("Response sent!");
      setShowBroadcastResponse(null);
      setBrTitle(""); setBrAuthor(""); setBrGenre(""); setBrWhy("");
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
    finally { setBrSubmitting(false); }
  };

  const handleCloseBroadcast = async (id) => {
    try { await API.post(`/broadcasts/${id}/close`); toast.success("Closed"); loadAll(); } catch {}
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#FFFDF7]"><Loader2 className="w-8 h-8 animate-spin text-[#1CB0F6]" /></div>;

  return (
    <div className="min-h-screen bg-[#FFFDF7] px-6 py-8 pb-safe" data-testid="connections-page">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-[#1a1a1a] tracking-tight mb-2" data-testid="connections-title">Connections</h1>
        <p className="text-[#6b6b6b] font-body mb-6 text-sm">People you've mutually followed + broadcasts</p>

        <Tabs value={tab} onValueChange={setTab} className="mb-6">
          <TabsList className="bg-white border-2 border-[#1a1a1a] rounded-xl p-1 h-auto w-full">
            <TabsTrigger value="connections" className="rounded-lg font-bold flex-1 data-[state=active]:bg-[#1a1a1a] data-[state=active]:text-white" data-testid="tab-connections">
              Connections ({connections.length})
            </TabsTrigger>
            <TabsTrigger value="broadcasts" className="rounded-lg font-bold flex-1 data-[state=active]:bg-[#1a1a1a] data-[state=active]:text-white" data-testid="tab-broadcasts">
              Broadcasts ({broadcasts.length})
            </TabsTrigger>
            <TabsTrigger value="blends" className="rounded-lg font-bold flex-1 data-[state=active]:bg-[#1a1a1a] data-[state=active]:text-white" data-testid="tab-blends">
              Blends ({blends.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Connections */}
        {tab === "connections" && (
          connections.length === 0 ? (
            <div className="bold-card p-10 text-center" data-testid="connections-empty">
              <Users size={40} className="mx-auto text-[#b0b0b0] mb-3" />
              <h3 className="font-heading text-lg font-semibold text-[#1a1a1a] mb-1">No connections yet</h3>
              <p className="text-[#6b6b6b] text-sm font-body">Mutual follows after exchanges form connections.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {connections.map((conn) => (
                <div key={conn.id} className="bold-card p-4 flex items-center justify-between" data-testid={`connection-${conn.id}`}>
                  <div className="flex items-center gap-3">
                    <div className="initials-circle bg-[#E3F2FD] text-[#1CB0F6]">
                      {(conn.other_user?.display_name || "?")[0].toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-heading font-semibold text-[#1a1a1a] text-sm">{conn.other_user?.display_name || "Anonymous"}</h3>
                      {conn.other_user?.city && <p className="text-xs text-[#6b6b6b]">{conn.other_user.city}</p>}
                      <p className="text-[10px] text-[#b0b0b0]">
                        {conn.exchange_count} exchanges{conn.blend_score != null ? ` · Blend: ${conn.blend_score}%` : ""}
                      </p>
                      {conn.their_social && (
                        <p className="text-xs text-[#1CB0F6] font-bold mt-0.5">{conn.their_social.platform}: @{conn.their_social.handle}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowSendRec(conn.id)} className="bold-btn bold-btn-primary px-3 py-2 text-xs" data-testid={`send-rec-${conn.id}`}>
                      <Send size={14} />
                    </button>
                    <button onClick={() => handleDisconnect(conn.id)} className="bold-btn bold-btn-ghost px-3 py-2 text-xs" data-testid={`disconnect-${conn.id}`}>
                      <UserX size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Broadcasts */}
        {tab === "broadcasts" && (
          <div>
            <button onClick={() => setShowBroadcast(true)} className="w-full bold-btn bold-btn-ghost py-3 mb-4 text-sm flex items-center justify-center gap-2" data-testid="create-broadcast-btn">
              <Plus size={16} /> New broadcast request
            </button>
            {broadcasts.length === 0 ? (
              <div className="bold-card p-10 text-center">
                <Megaphone size={40} className="mx-auto text-[#b0b0b0] mb-3" />
                <p className="text-[#6b6b6b] text-sm">No broadcasts from your network.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {broadcasts.map((b) => (
                  <div key={b.id} className="bold-card p-4" data-testid={`broadcast-${b.id}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="bold-badge text-[10px]" style={{ background: b.category === "read" ? "#FF9600" : b.category === "listen" ? "#FF4B4B" : "#FFC800", color: b.category === "watch" ? "#1a1a1a" : "#fff" }}>{b.category}</span>
                          <span className="text-xs font-bold text-[#1a1a1a]">{b.is_mine ? "You" : b.owner_name}</span>
                        </div>
                        <p className="text-sm text-[#1a1a1a] font-body">{b.request_text}</p>
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-[#b0b0b0]">
                          <span className="flex items-center gap-1"><MessageSquare size={10} /> {b.response_count} responses</span>
                          <span className="flex items-center gap-1"><Eye size={10} /> {b.view_count} views</span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {!b.is_mine && (
                          <button onClick={() => setShowBroadcastResponse(b.id)} className="bold-btn bold-btn-primary px-3 py-1.5 text-xs" data-testid={`respond-broadcast-${b.id}`}>
                            Respond
                          </button>
                        )}
                        {b.is_mine && (
                          <button onClick={() => handleCloseBroadcast(b.id)} className="bold-btn bold-btn-ghost px-3 py-1.5 text-xs">
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Blends */}
        {tab === "blends" && (
          blends.length === 0 ? (
            <div className="bold-card p-10 text-center">
              <Sparkles size={40} className="mx-auto text-[#b0b0b0] mb-3" />
              <p className="text-[#6b6b6b] text-sm">Blends appear when you form connections.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {blends.map((b) => (
                <div key={b.id} className="bold-card p-4" data-testid={`blend-${b.id}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bold-badge bg-[#E8E0FF] text-[#7C3AED] text-[10px]">{b.blend_type} blend</span>
                        <span className="text-xs font-bold text-[#1a1a1a]">{b.other_user?.display_name || "?"}</span>
                      </div>
                      {b.score != null ? (
                        <div>
                          <p className="font-heading text-2xl font-bold text-[#1a1a1a]">{b.score}%</p>
                          {b.descriptors && <p className="text-xs text-[#6b6b6b]">{b.descriptors.join(" · ")}</p>}
                          {b.score_summary && <p className="text-xs text-[#6b6b6b] italic mt-1">"{b.score_summary}"</p>}
                        </div>
                      ) : (
                        <p className="text-xs text-[#b0b0b0]">Score not yet computed</p>
                      )}
                    </div>
                    <button onClick={async () => { try { await API.post(`/blends/${b.id}/recompute`); toast.success("Recomputing..."); } catch (err) { toast.error(err.response?.data?.detail || "Wait"); } }}
                      className="bold-btn bold-btn-ghost px-3 py-2 text-xs" data-testid={`recompute-blend-${b.id}`}>Refresh</button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Send Rec Dialog */}
      <Dialog open={!!showSendRec} onOpenChange={(o) => { if (!o) setShowSendRec(null); }}>
        <DialogContent className="sm:max-w-lg bg-white border-2 border-[#1a1a1a] rounded-2xl shadow-[4px_4px_0_#1a1a1a]">
          <DialogHeader><DialogTitle className="font-heading text-xl font-semibold text-[#1a1a1a]">Send a recommendation</DialogTitle></DialogHeader>
          <form onSubmit={handleSendRec} className="space-y-3">
            <input value={sendTitle} onChange={(e) => setSendTitle(e.target.value)} required placeholder="Title" className="bold-input" />
            <div className="grid grid-cols-2 gap-3">
              <input value={sendAuthor} onChange={(e) => setSendAuthor(e.target.value)} placeholder="Author" className="bold-input" />
              <input value={sendGenre} onChange={(e) => setSendGenre(e.target.value)} placeholder="Genre" className="bold-input" />
            </div>
            <textarea value={sendWhy} onChange={(e) => setSendWhy(e.target.value)} required rows={3} className="bold-input resize-none" placeholder="Why this?" />
            <button type="submit" disabled={sending} className="w-full bold-btn bold-btn-primary py-3 text-base">{sending ? "Sending..." : "Send"}</button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Broadcast Dialog */}
      <Dialog open={showBroadcast} onOpenChange={setShowBroadcast}>
        <DialogContent className="sm:max-w-md bg-white border-2 border-[#1a1a1a] rounded-2xl shadow-[4px_4px_0_#1a1a1a]">
          <DialogHeader><DialogTitle className="font-heading text-xl font-semibold">New broadcast</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateBroadcast} className="space-y-3">
            <div className="flex gap-2">
              {["read", "listen", "watch"].map((c) => (
                <button key={c} type="button" onClick={() => setBroadcastCat(c)}
                  className={`bold-btn px-4 py-2 text-sm capitalize ${broadcastCat === c ? "bold-btn-primary" : "bold-btn-ghost"}`}>{c}</button>
              ))}
            </div>
            <textarea value={broadcastText} onChange={(e) => setBroadcastText(e.target.value)} required rows={3}
              className="bold-input resize-none" placeholder="What are you looking for?" />
            <button type="submit" disabled={creatingBroadcast} className="w-full bold-btn bold-btn-green py-3">{creatingBroadcast ? "Sending..." : "Send broadcast"}</button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Broadcast Response Dialog */}
      <Dialog open={!!showBroadcastResponse} onOpenChange={(o) => { if (!o) setShowBroadcastResponse(null); }}>
        <DialogContent className="sm:max-w-lg bg-white border-2 border-[#1a1a1a] rounded-2xl shadow-[4px_4px_0_#1a1a1a]">
          <DialogHeader><DialogTitle className="font-heading text-xl font-semibold">Respond to broadcast</DialogTitle></DialogHeader>
          <form onSubmit={handleBroadcastResponse} className="space-y-3">
            <input value={brTitle} onChange={(e) => setBrTitle(e.target.value)} required placeholder="Title" className="bold-input" />
            <div className="grid grid-cols-2 gap-3">
              <input value={brAuthor} onChange={(e) => setBrAuthor(e.target.value)} placeholder="Author" className="bold-input" />
              <input value={brGenre} onChange={(e) => setBrGenre(e.target.value)} placeholder="Genre" className="bold-input" />
            </div>
            <textarea value={brWhy} onChange={(e) => setBrWhy(e.target.value)} required rows={3} className="bold-input resize-none" placeholder="Why this?" />
            <button type="submit" disabled={brSubmitting} className="w-full bold-btn bold-btn-primary py-3">{brSubmitting ? "Sending..." : "Submit"}</button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
