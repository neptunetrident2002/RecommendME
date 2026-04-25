import { useState, useEffect, useCallback } from "react";
import API from "@/lib/api";
import {
  Users, UserX, ShieldBan, Loader2, Megaphone, Plus, X,
  ChevronLeft, RefreshCw, Send
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ─── Shared: Recommendation Card ───────────────────────────────────────────
const CAT_COLOR = { read: "#FF9600", listen: "#FF4B4B", watch: "#FFC800" };
const CAT_TEXT  = { read: "#fff",    listen: "#fff",    watch: "#1a1a1a" };

function RecCard({ rec, side, otherName, myName }) {
  if (!rec) return null;
  const bg  = CAT_COLOR[rec.category] || "#1CB0F6";
  const txt = CAT_TEXT[rec.category]  || "#fff";
  const label = side === "a" ? (otherName || "Them") : (myName || "You");
  return (
    <div className="bold-card p-4 bg-white">
      <div className="flex items-center gap-2 mb-2">
        <span className="bold-badge text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: bg, color: txt }}>
          {rec.category}
        </span>
        <span className="text-[10px] text-[#b0b0b0] font-medium">{label}</span>
      </div>
      <p className="font-heading font-semibold text-[#1a1a1a] text-sm leading-snug">{rec.title}</p>
      {rec.author && <p className="text-xs text-[#6b6b6b] mt-0.5">{rec.author}</p>}
      {rec.why_note && (
        <p className="text-xs text-[#6b6b6b] italic mt-2 line-clamp-2">"{rec.why_note}"</p>
      )}
    </div>
  );
}

// ─── Blend Detail View ──────────────────────────────────────────────────────
function BlendDetailView({ connection, onBack }) {
  const [blend, setBlend]     = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const blendRes = await API.get("/blends");
      const myBlend  = blendRes.data.find(b => b.other_user?.id === connection.other_user?.id);
      setBlend(myBlend || null);
      if (myBlend?.public_token) {
        const detail = await API.get(`/blends/${myBlend.public_token}`);
        setEntries(detail.data.entries || []);
      }
    } catch { toast.error("Couldn't load blend"); }
    finally  { setLoading(false); }
  }, [connection.other_user?.id]);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = async () => {
    if (!blend) return;
    try {
      await API.post(`/blends/${blend.id}/recompute`);
      toast.success("Recalculating...");
    } catch (err) { toast.error(err.response?.data?.detail || "Try again later"); }
  };

  const myName    = "You";
  const otherName = connection.other_user?.display_name || "Them";

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="bold-btn bold-btn-ghost px-3 py-2 text-sm flex items-center gap-1">
          <ChevronLeft size={16} /> Back
        </button>
        <h2 className="font-heading text-xl font-semibold text-[#1a1a1a]">
          You × {otherName}
        </h2>
      </div>

      {/* Score Card */}
      {blend && (
        <div className="bold-card p-4 mb-5 flex items-start justify-between">
          <div>
            {blend.score != null ? (
              <>
                <p className="font-heading text-4xl font-bold text-[#1a1a1a]">{blend.score}%</p>
                {blend.descriptors?.length > 0 && (
                  <p className="text-xs text-[#6b6b6b] mt-1">{blend.descriptors.join(" · ")}</p>
                )}
                {blend.score_summary && (
                  <p className="text-xs text-[#6b6b6b] italic mt-1">"{blend.score_summary}"</p>
                )}
              </>
            ) : (
              <p className="text-sm text-[#b0b0b0]">Score not yet computed</p>
            )}
          </div>
          <button onClick={handleRefresh}
            className="bold-btn bold-btn-ghost px-3 py-2 text-xs flex items-center gap-1">
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      )}

      {/* Entries */}
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-[#1CB0F6]" />
        </div>
      ) : entries.length === 0 ? (
        <div className="bold-card p-8 text-center">
          <p className="text-[#b0b0b0] text-sm">No shared exchanges yet.</p>
          <p className="text-[#b0b0b0] text-xs mt-1">Exchanges you do with this person will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(e => (
            <RecCard
              key={e.id}
              rec={e.recommendation}
              side={e.user_side}
              otherName={otherName}
              myName={myName}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Exchange Modal ─────────────────────────────────────────────────────────
function ExchangeModal({ connectionId, onClose, onSent }) {
  const [step, setStep]         = useState("pick_category"); // pick_category → fill_rec
  const [category, setCategory] = useState(null);
  const [myRecs, setMyRecs]     = useState([]);
  const [listEntries, setListEntries] = useState([]);
  const [loadingRecs, setLoadingRecs] = useState(false);

  // form fields
  const [title,  setTitle]  = useState("");
  const [author, setAuthor] = useState("");
  const [genre,  setGenre]  = useState("");
  const [why,    setWhy]    = useState("");
  const [url,    setUrl]    = useState("");
  const [sending, setSending] = useState(false);

  const loadRecs = async (cat) => {
    setLoadingRecs(true);
    try {
      const [recRes, listRes] = await Promise.all([
        API.get("/recommendations/mine"),
        API.get(`/list?tab=my_list`),
      ]);
      setMyRecs(recRes.data.filter(r => r.category === cat));
      setListEntries(listRes.data.filter(e => e.recommendation?.category === cat));
    } catch { }
    finally { setLoadingRecs(false); }
  };

  const handleCategorySelect = (cat) => {
    setCategory(cat);
    setStep("fill_rec");
    loadRecs(cat);
  };

  const fillFromRec = (rec) => {
    setTitle(rec.title || "");
    setAuthor(rec.author || "");
    setGenre(rec.genre || "");
    setWhy(rec.why_note || "");
    setUrl(rec.url || "");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (why.length < 20) { toast.error("Why-note must be at least 20 characters"); return; }
    setSending(true);
    try {
      await API.post("/connection-exchange", {
        connection_id: connectionId,
        category,
        title, author, genre, url, why_note: why,
      });
      toast.success("Recommendation sent!");
      onSent();
      onClose();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to send"); }
    finally { setSending(false); }
  };

  const bgColor = category ? CAT_COLOR[category] : "#1a1a1a";
  const txtColor = category === "watch" ? "#1a1a1a" : "#fff";

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg bg-white border-2 border-[#1a1a1a] rounded-2xl shadow-[4px_4px_0_#1a1a1a]">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl font-semibold text-[#1a1a1a]">
            {step === "pick_category" ? "What are you recommending?" : (
              <span className="flex items-center gap-2">
                <span className="bold-badge px-2 py-0.5 rounded-full text-sm"
                  style={{ background: bgColor, color: txtColor }}>
                  {category}
                </span>
                Exchange
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {step === "pick_category" && (
          <div className="space-y-3 pt-2">
            <p className="text-sm text-[#6b6b6b]">Pick a category to recommend in.</p>
            <div className="grid grid-cols-3 gap-3">
              {["read", "listen", "watch"].map(cat => (
                <button key={cat} onClick={() => handleCategorySelect(cat)}
                  className="bold-card p-5 text-center hover:scale-[1.02] transition-transform cursor-pointer"
                  style={{ borderColor: CAT_COLOR[cat] }}>
                  <span className="font-heading font-bold text-base capitalize"
                    style={{ color: CAT_COLOR[cat] }}>{cat}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "fill_rec" && (
          <form onSubmit={handleSubmit} className="space-y-3 pt-1">
            {/* Import from existing */}
            {loadingRecs ? (
              <p className="text-xs text-[#b0b0b0]">Loading your recommendations...</p>
            ) : (myRecs.length > 0 || listEntries.length > 0) && (
              <div>
                <p className="text-xs font-bold text-[#6b6b6b] mb-1.5 uppercase tracking-wide">Import from your list</p>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {myRecs.map(r => (
                    <button key={r.id} type="button" onClick={() => fillFromRec(r)}
                      className="w-full text-left bold-card px-3 py-2 hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all">
                      <span className="text-xs font-semibold text-[#1a1a1a]">{r.title}</span>
                      {r.author && <span className="text-[10px] text-[#6b6b6b] ml-1">— {r.author}</span>}
                    </button>
                  ))}
                  {listEntries.filter(e => !myRecs.find(r => r.id === e.recommendation?.id)).map(e => (
                    <button key={e.id} type="button" onClick={() => fillFromRec(e.recommendation)}
                      className="w-full text-left bold-card px-3 py-2 hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all">
                      <span className="text-xs font-semibold text-[#1a1a1a]">{e.recommendation?.title}</span>
                      {e.recommendation?.author && <span className="text-[10px] text-[#6b6b6b] ml-1">— {e.recommendation.author}</span>}
                    </button>
                  ))}
                </div>
                <div className="border-t-2 border-dashed border-[#e0e0e0] my-3" />
              </div>
            )}

            <input value={title} onChange={e => setTitle(e.target.value)} required
              placeholder="Title" className="bold-input" />
            <div className="grid grid-cols-2 gap-3">
              <input value={author} onChange={e => setAuthor(e.target.value)}
                placeholder="Author / Artist / Director" className="bold-input" />
              <input value={genre} onChange={e => setGenre(e.target.value)}
                placeholder="Genre (optional)" className="bold-input" />
            </div>
            <input value={url} onChange={e => setUrl(e.target.value)}
              placeholder="Link (optional)" className="bold-input" />
            <textarea value={why} onChange={e => setWhy(e.target.value)} required rows={3}
              className="bold-input resize-none"
              placeholder="Why this? (min 20 chars)" />
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setStep("pick_category")}
                className="bold-btn bold-btn-ghost px-4 py-2.5 text-sm">← Back</button>
              <button type="submit" disabled={sending}
                className="flex-1 bold-btn py-2.5 text-sm font-bold text-white"
                style={{ background: bgColor, color: txtColor }}>
                {sending ? "Sending..." : "Send recommendation"}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Broadcast Responses View ───────────────────────────────────────────────
function BroadcastDetail({ broadcast, onBack }) {
  const [responses, setResponses] = useState([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    API.get(`/broadcasts/${broadcast.id}/responses`)
      .then(r => setResponses(r.data))
      .catch(() => toast.error("Couldn't load responses"))
      .finally(() => setLoading(false));
  }, [broadcast.id]);

  const bg  = CAT_COLOR[broadcast.category] || "#1CB0F6";
  const txt = broadcast.category === "watch" ? "#1a1a1a" : "#fff";

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="bold-btn bold-btn-ghost px-3 py-2 text-sm flex items-center gap-1">
          <ChevronLeft size={16} /> Back
        </button>
        <span className="bold-badge text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ background: bg, color: txt }}>{broadcast.category}</span>
        <span className="font-heading font-semibold text-[#1a1a1a] text-sm truncate">
          {broadcast.is_mine ? "Your broadcast" : `${broadcast.owner_name}'s request`}
        </span>
      </div>

      <div className="bold-card p-4 mb-5">
        <p className="text-sm text-[#1a1a1a] font-body">{broadcast.request_text}</p>
        <p className="text-[10px] text-[#b0b0b0] mt-2">{responses.length} responses</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-[#1CB0F6]" />
        </div>
      ) : responses.length === 0 ? (
        <div className="bold-card p-8 text-center">
          <p className="text-[#b0b0b0] text-sm">No responses yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {responses.map(r => (
            <div key={r.id} className="bold-card p-4">
              <p className="text-[10px] font-bold text-[#6b6b6b] mb-2 uppercase tracking-wide">
                {r.responder_name}
              </p>
              {r.recommendation && (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bold-badge text-[10px] px-2 py-0.5 rounded-full"
                      style={{
                        background: CAT_COLOR[r.recommendation.category] || "#1CB0F6",
                        color: r.recommendation.category === "watch" ? "#1a1a1a" : "#fff"
                      }}>
                      {r.recommendation.category}
                    </span>
                  </div>
                  <p className="font-heading font-semibold text-[#1a1a1a] text-sm">{r.recommendation.title}</p>
                  {r.recommendation.author && (
                    <p className="text-xs text-[#6b6b6b]">{r.recommendation.author}</p>
                  )}
                  {r.recommendation.why_note && (
                    <p className="text-xs text-[#6b6b6b] italic mt-2 line-clamp-3">
                      "{r.recommendation.why_note}"
                    </p>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function ConnectionsPage() {
  const [connections, setConnections]   = useState([]);
  const [broadcasts, setBroadcasts]     = useState([]);
  const [loading, setLoading]           = useState(true);
  const [tab, setTab]                   = useState("connections");

  // inner views
  const [selectedConn, setSelectedConn]           = useState(null); // blend view
  const [selectedBroadcast, setSelectedBroadcast] = useState(null); // broadcast detail
  const [exchangeConnId, setExchangeConnId]       = useState(null); // exchange modal

  // broadcast form
  const [showBroadcast, setShowBroadcast]         = useState(false);
  const [broadcastCat, setBroadcastCat]           = useState("read");
  const [broadcastText, setBroadcastText]         = useState("");
  const [creatingBroadcast, setCreatingBroadcast] = useState(false);

  // broadcast respond form
  const [respondingTo, setRespondingTo]           = useState(null);
  const [brTitle, setBrTitle]   = useState("");
  const [brAuthor, setBrAuthor] = useState("");
  const [brGenre, setBrGenre]   = useState("");
  const [brWhy, setBrWhy]       = useState("");
  const [brUrl, setBrUrl]       = useState("");
  const [brSubmitting, setBrSubmitting] = useState(false);

  const loadAll = async () => {
    try {
      const [cRes, bRes] = await Promise.all([
        API.get("/connections"),
        API.get("/broadcasts"),
      ]);
      setConnections(cRes.data);
      setBroadcasts(bRes.data);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { loadAll(); }, []);

  const handleDisconnect = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Disconnect from this person?")) return;
    try {
      await API.post(`/connections/${id}/disconnect`);
      toast.success("Disconnected");
      loadAll();
    } catch { toast.error("Failed"); }
  };

  const handleBlock = async (conn, e) => {
    e.stopPropagation();
    if (!window.confirm(`Block ${conn.other_user?.display_name || "this person"}? This will end your connection.`)) return;
    try {
      await API.post("/blocks", { user_id: conn.other_user?.id });
      toast.success("Blocked");
      loadAll();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
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
    if (brWhy.length < 20) { toast.error("Why-note must be at least 20 characters"); return; }
    setBrSubmitting(true);
    try {
      await API.post("/broadcasts/respond", {
        broadcast_id: respondingTo.id,
        title: brTitle, author: brAuthor, genre: brGenre, url: brUrl, why_note: brWhy,
      });
      toast.success("Response sent!");
      setRespondingTo(null);
      setBrTitle(""); setBrAuthor(""); setBrGenre(""); setBrWhy(""); setBrUrl("");
      loadAll();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
    finally { setBrSubmitting(false); }
  };

  const handleCloseBroadcast = async (id, e) => {
    e.stopPropagation();
    try {
      await API.post(`/broadcasts/${id}/close`);
      toast.success("Closed");
      loadAll();
    } catch { }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FFFDF7]">
      <Loader2 className="w-8 h-8 animate-spin text-[#1CB0F6]" />
    </div>
  );

  // ── Inner view: Blend ──
  if (selectedConn) return (
    <div className="min-h-screen bg-[#FFFDF7] px-6 py-8 pb-safe">
      <div className="max-w-2xl mx-auto">
        <BlendDetailView connection={selectedConn} onBack={() => setSelectedConn(null)} />
      </div>
    </div>
  );

  // ── Inner view: Broadcast detail ──
  if (selectedBroadcast) return (
    <div className="min-h-screen bg-[#FFFDF7] px-6 py-8 pb-safe">
      <div className="max-w-2xl mx-auto">
        <BroadcastDetail broadcast={selectedBroadcast} onBack={() => setSelectedBroadcast(null)} />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FFFDF7] px-6 py-8 pb-safe" data-testid="connections-page">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-[#1a1a1a] tracking-tight mb-2">
          Connections
        </h1>
        <p className="text-[#6b6b6b] font-body mb-6 text-sm">People you've mutually followed + broadcasts</p>

        <Tabs value={tab} onValueChange={t => { setTab(t); }} className="mb-6">
          <TabsList className="bg-white border-2 border-[#1a1a1a] rounded-xl p-1 h-auto w-full">
            <TabsTrigger value="connections"
              className="rounded-lg font-bold flex-1 data-[state=active]:bg-[#1a1a1a] data-[state=active]:text-white">
              Connections ({connections.length})
            </TabsTrigger>
            <TabsTrigger value="broadcasts"
              className="rounded-lg font-bold flex-1 data-[state=active]:bg-[#1a1a1a] data-[state=active]:text-white">
              Broadcasts ({broadcasts.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* ── Connections Tab ── */}
        {tab === "connections" && (
          connections.length === 0 ? (
            <div className="bold-card p-10 text-center">
              <Users size={40} className="mx-auto text-[#b0b0b0] mb-3" />
              <h3 className="font-heading text-lg font-semibold text-[#1a1a1a] mb-1">No connections yet</h3>
              <p className="text-[#6b6b6b] text-sm font-body">Mutual follows after exchanges form connections.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {connections.map(conn => (
                <div key={conn.id} className="bold-card p-4" data-testid={`connection-${conn.id}`}>
                  <div className="flex items-center justify-between">
                    {/* Clickable name area → blend view */}
                    <button
                      onClick={() => setSelectedConn(conn)}
                      className="flex items-center gap-3 flex-1 text-left min-w-0">
                      <div className="w-10 h-10 rounded-full border-2 border-[#1a1a1a] bg-[#E3F2FD] flex items-center justify-center font-bold text-[#1CB0F6] text-sm shrink-0">
                        {(conn.other_user?.display_name || "?")[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-heading font-semibold text-[#1a1a1a] text-sm hover:underline">
                          {conn.other_user?.display_name || "Anonymous"}
                        </h3>
                        {conn.other_user?.city && (
                          <p className="text-xs text-[#6b6b6b]">{conn.other_user.city}</p>
                        )}
                        <p className="text-[10px] text-[#b0b0b0]">
                          {conn.exchange_count} exchanges
                          {conn.blend_score != null ? ` · Blend: ${conn.blend_score}%` : ""}
                        </p>
                        {conn.their_social && (
                          <p className="text-xs text-[#1CB0F6] font-bold mt-0.5">
                            {conn.their_social.platform}: @{conn.their_social.handle}
                          </p>
                        )}
                      </div>
                    </button>

                    {/* Action buttons */}
                    <div className="flex gap-2 ml-3 shrink-0">
                      <button
                        onClick={e => { e.stopPropagation(); setExchangeConnId(conn.id); }}
                        className="bold-btn bold-btn-primary px-3 py-2 text-xs flex items-center gap-1"
                        title="Exchange recommendation">
                        <Send size={14} />
                      </button>
                      <button
                        onClick={e => handleBlock(conn, e)}
                        className="bold-btn bold-btn-ghost px-3 py-2 text-xs"
                        title="Block">
                        <ShieldBan size={14} />
                      </button>
                      <button
                        onClick={e => handleDisconnect(conn.id, e)}
                        className="bold-btn bold-btn-ghost px-3 py-2 text-xs"
                        title="Disconnect">
                        <UserX size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* ── Broadcasts Tab ── */}
        {tab === "broadcasts" && (
          <div>
            <button onClick={() => setShowBroadcast(true)}
              className="w-full bold-btn bold-btn-ghost py-3 mb-4 text-sm flex items-center justify-center gap-2">
              <Plus size={16} /> New broadcast request
            </button>
            {broadcasts.length === 0 ? (
              <div className="bold-card p-10 text-center">
                <Megaphone size={40} className="mx-auto text-[#b0b0b0] mb-3" />
                <p className="text-[#6b6b6b] text-sm">No broadcasts from your network.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {broadcasts.map(b => {
                  const bg  = CAT_COLOR[b.category] || "#1CB0F6";
                  const txt = b.category === "watch" ? "#1a1a1a" : "#fff";
                  return (
                    <div key={b.id}
                      onClick={() => setSelectedBroadcast(b)}
                      className="bold-card p-4 cursor-pointer hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
                      data-testid={`broadcast-${b.id}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="bold-badge text-[10px] px-2 py-0.5 rounded-full font-bold"
                              style={{ background: bg, color: txt }}>{b.category}</span>
                            <span className="text-xs font-bold text-[#1a1a1a]">
                              {b.is_mine ? "You" : b.owner_name}
                            </span>
                          </div>
                          <p className="text-sm text-[#1a1a1a] font-body line-clamp-2">{b.request_text}</p>
                          <p className="text-[10px] text-[#b0b0b0] mt-2">
                            {b.response_count} responses · {b.view_count} views · tap to view
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                          {!b.is_mine && (
                            <button
                              onClick={() => setRespondingTo(b)}
                              className="bold-btn bold-btn-primary px-3 py-1.5 text-xs">
                              Respond
                            </button>
                          )}
                          {b.is_mine && (
                            <button
                              onClick={e => handleCloseBroadcast(b.id, e)}
                              className="bold-btn bold-btn-ghost px-3 py-1.5 text-xs">
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Exchange Modal ── */}
      {exchangeConnId && (
        <ExchangeModal
          connectionId={exchangeConnId}
          onClose={() => setExchangeConnId(null)}
          onSent={loadAll}
        />
      )}

      {/* ── Create Broadcast Dialog ── */}
      <Dialog open={showBroadcast} onOpenChange={setShowBroadcast}>
        <DialogContent className="sm:max-w-md bg-white border-2 border-[#1a1a1a] rounded-2xl shadow-[4px_4px_0_#1a1a1a]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-semibold">New broadcast</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateBroadcast} className="space-y-3">
            <div className="flex gap-2">
              {["read", "listen", "watch"].map(c => (
                <button key={c} type="button" onClick={() => setBroadcastCat(c)}
                  className="bold-btn px-4 py-2 text-sm capitalize font-bold transition-all"
                  style={broadcastCat === c
                    ? { background: CAT_COLOR[c], color: c === "watch" ? "#1a1a1a" : "#fff", border: `2px solid ${CAT_COLOR[c]}` }
                    : {}}>
                  {c}
                </button>
              ))}
            </div>
            <textarea value={broadcastText} onChange={e => setBroadcastText(e.target.value)}
              required rows={3} className="bold-input resize-none"
              placeholder="What are you looking for?" />
            <button type="submit" disabled={creatingBroadcast}
              className="w-full bold-btn bold-btn-green py-3">
              {creatingBroadcast ? "Sending..." : "Send broadcast"}
            </button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Broadcast Response Dialog ── */}
      <Dialog open={!!respondingTo} onOpenChange={o => { if (!o) setRespondingTo(null); }}>
        <DialogContent className="sm:max-w-lg bg-white border-2 border-[#1a1a1a] rounded-2xl shadow-[4px_4px_0_#1a1a1a]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-semibold">
              Respond to {respondingTo?.owner_name || "broadcast"}
            </DialogTitle>
          </DialogHeader>
          {respondingTo && (
            <div className="bold-card p-3 mb-1 bg-[#f9f9f9]">
              <p className="text-xs text-[#6b6b6b] italic">"{respondingTo.request_text}"</p>
            </div>
          )}
          <form onSubmit={handleBroadcastResponse} className="space-y-3">
            <input value={brTitle} onChange={e => setBrTitle(e.target.value)} required
              placeholder="Title" className="bold-input" />
            <div className="grid grid-cols-2 gap-3">
              <input value={brAuthor} onChange={e => setBrAuthor(e.target.value)}
                placeholder="Author / Artist" className="bold-input" />
              <input value={brGenre} onChange={e => setBrGenre(e.target.value)}
                placeholder="Genre (optional)" className="bold-input" />
            </div>
            <input value={brUrl} onChange={e => setBrUrl(e.target.value)}
              placeholder="Link (optional)" className="bold-input" />
            <textarea value={brWhy} onChange={e => setBrWhy(e.target.value)} required rows={3}
              className="bold-input resize-none" placeholder="Why this? (min 20 chars)" />
            <button type="submit" disabled={brSubmitting}
              className="w-full bold-btn bold-btn-primary py-3">
              {brSubmitting ? "Sending..." : "Submit response"}
            </button>
          </form>
              
        </DialogContent>
      </Dialog>
    </div>
  );
}
