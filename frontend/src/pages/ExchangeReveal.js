import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "@/lib/api";
import { MapPin, Clock, Heart, ThumbsDown, Flag, ArrowLeft, ExternalLink, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const CAT_COLOR = { read: "#FF9600", listen: "#FF4B4B", watch: "#FFC800" };

export default function ExchangeReveal() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const [exchange, setExchange] = useState(null);
  const [loading, setLoading] = useState(true);
  const [revealing, setRevealing] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetail, setReportDetail] = useState("");
  const [countdown, setCountdown] = useState("");
  const [showWriteRec, setShowWriteRec] = useState(false);
  const [recTitle, setRecTitle] = useState("");
  const [recAuthor, setRecAuthor] = useState("");
  const [recGenre, setRecGenre] = useState("");
  const [recUrl, setRecUrl] = useState("");
  const [recWhyNote, setRecWhyNote] = useState("");
  const [writingRec, setWritingRec] = useState(false);

  useEffect(() => { loadExchange(); }, [matchId]);

  const loadExchange = async () => {
    try {
      const { data } = await API.get(`/matching/exchange/${matchId}`);
      setExchange(data);
      if (data.needs_my_rec && data.match.status === "pending") setShowWriteRec(true);
    } catch { toast.error("Could not load exchange"); navigate("/home"); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!exchange?.match?.expires_at) return;
    const update = () => {
      const diff = new Date(exchange.match.expires_at) - new Date();
      if (diff <= 0) { setCountdown("Expired"); return; }
      setCountdown(`${Math.floor(diff / 3600000)}h ${Math.floor((diff % 3600000) / 60000)}m`);
    };
    update();
    const i = setInterval(update, 60000);
    return () => clearInterval(i);
  }, [exchange?.match?.expires_at]);

  const handleReveal = async () => {
    setRevealing(true);
    try {
      const { data } = await API.post(`/matching/reveal/${matchId}`);
      setExchange(data);
      toast.success("Exchange revealed!");
    } catch (err) { toast.error(err.response?.data?.detail || "Could not reveal"); }
    finally { setRevealing(false); }
  };

  const handleFollow = async () => {
    try {
      const { data } = await API.post("/follow", { match_id: matchId });
      toast.success(data.connection_formed ? "You're connected!" : "Followed! Waiting for them.");
      loadExchange();
    } catch (err) { toast.error(err.response?.data?.detail || "Could not follow"); }
  };

  const handleDownvote = async () => {
    try { await API.post("/downvote", { match_id: matchId }); toast("Noted. We'll improve your matches."); } catch {}
  };

  const handleWriteRec = async (e) => {
    e.preventDefault();
    if (recWhyNote.length < 20) { toast.error("Why-note must be at least 20 characters"); return; }
    setWritingRec(true);
    try {
      await API.post("/matching/write-rec", { match_id: matchId, title: recTitle, author: recAuthor, genre: recGenre, url: recUrl, why_note: recWhyNote });
      setShowWriteRec(false);
      toast.success("Recommendation submitted!");
      loadExchange();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
    finally { setWritingRec(false); }
  };

  const handleReport = async () => {
    if (!reportReason) { toast.error("Select a reason"); return; }
    try {
      await API.post("/reports", { reported_user_id: "unknown", match_id: matchId, reason: reportReason, detail: reportDetail });
      toast.success("Report submitted");
      setShowReport(false);
    } catch { toast.error("Could not submit report"); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#FFFDF7]"><Loader2 className="w-8 h-8 animate-spin text-[#1CB0F6]" /></div>;
  if (!exchange) return null;

  const { match: m, their_recommendation: theirRec, my_recommendation: myRec, their_city, i_followed, is_connected, is_llm_fallback } = exchange;
  const color = CAT_COLOR[m.category] || "#1CB0F6";
  const isRevealed = m.status === "active" || m.status === "completed";

  return (
    <div className="min-h-screen bg-[#FFFDF7] px-6 py-8 pb-safe" data-testid="exchange-screen">
      <div className="max-w-xl mx-auto">
        <button onClick={() => navigate("/home")} className="flex items-center gap-2 text-sm font-bold text-[#6b6b6b] hover:text-[#1a1a1a] mb-6" data-testid="exchange-back-btn">
          <ArrowLeft size={16} /> Back
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="bold-badge" style={{ background: color, color: color === "#FFC800" ? "#1a1a1a" : "#fff" }}>
            {m.category}
          </div>
          {is_llm_fallback && (
            <div className="bold-badge bg-[#E8E0FF] text-[#7C3AED]"><Sparkles size={12} /> Curated by RecommendME</div>
          )}
          {isRevealed && m.expires_at && (
            <span className="text-xs font-bold text-[#6b6b6b] flex items-center gap-1" data-testid="follow-window-countdown">
              <Clock size={12} /> {countdown}
            </span>
          )}
        </div>

        {/* Pending — need reveal */}
        {m.status === "pending" && !exchange.needs_my_rec && (
          <div className="bold-card p-8 text-center">
            <h2 className="font-heading text-2xl font-semibold text-[#1a1a1a] mb-3" data-testid="reveal-heading">Both recommendations are ready</h2>
            <p className="text-[#6b6b6b] font-body mb-6">Reveal to see what they recommended for you.</p>
            <button onClick={handleReveal} disabled={revealing} data-testid="reveal-btn"
              className="bold-btn bold-btn-primary px-8 py-4 text-base">
              {revealing ? "Revealing..." : "Reveal exchange"}
            </button>
          </div>
        )}

        {/* Revealed */}
        {isRevealed && theirRec && (
          <div className="space-y-5 animate-fade-in">
            {/* Their rec */}
            <div className="bold-card p-6" data-testid="their-rec-card">
              <p className="text-xs font-bold mb-3" style={{ color }}>Their recommendation for you</p>
              <h2 className="font-heading text-2xl font-semibold text-[#1a1a1a]">{theirRec.title}</h2>
              {theirRec.author && <p className="text-[#6b6b6b] font-body mt-1">{theirRec.author}</p>}
              {theirRec.genre && <span className="bold-badge bg-[#FFFDF7] mt-2">{theirRec.genre}</span>}
              <div className="mt-4 bg-[#FFFDF7] border-2 border-[#1a1a1a] rounded-xl p-4">
                <p className="text-[#1a1a1a] font-body italic leading-relaxed text-sm">"{theirRec.why_note}"</p>
              </div>
              {theirRec.url && (
                <a href={theirRec.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-3 text-sm font-bold text-[#1CB0F6] hover:underline" data-testid="their-rec-url">
                  <ExternalLink size={14} /> Open
                </a>
              )}
              {their_city && <p className="flex items-center gap-1 mt-3 text-xs text-[#b0b0b0]"><MapPin size={12} /> {their_city}</p>}
            </div>

            {/* My rec */}
            {myRec && (
              <div className="bold-card p-5 opacity-80" data-testid="my-rec-card">
                <p className="text-xs font-bold text-[#6b6b6b] mb-2">What you gave</p>
                <h3 className="font-heading text-base font-semibold text-[#1a1a1a]">{myRec.title}</h3>
                {myRec.author && <p className="text-xs text-[#6b6b6b]">{myRec.author}</p>}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              {!i_followed && !is_connected && countdown !== "Expired" && (
                <button onClick={handleFollow} data-testid="follow-btn" className="flex-1 bold-btn bold-btn-green py-3.5 text-base flex items-center justify-center gap-2">
                  <Heart size={18} /> Follow
                </button>
              )}
              {i_followed && !is_connected && (
                <div className="flex-1 bold-card p-3.5 text-center text-sm font-bold text-[#58CC02]" data-testid="followed-badge">Followed — waiting for them</div>
              )}
              {is_connected && (
                <div className="flex-1 bold-card p-3.5 text-center text-sm font-bold text-[#58CC02]" data-testid="connected-badge">Connected!</div>
              )}
              <button onClick={handleDownvote} className="bold-btn bold-btn-ghost px-4 py-3" data-testid="downvote-btn"><ThumbsDown size={18} /></button>
              <button onClick={() => setShowReport(true)} className="bold-btn bold-btn-ghost px-4 py-3" data-testid="report-btn"><Flag size={18} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Write Rec Dialog */}
      <Dialog open={showWriteRec} onOpenChange={setShowWriteRec}>
        <DialogContent className="sm:max-w-lg bg-white border-2 border-[#1a1a1a] rounded-2xl shadow-[4px_4px_0_#1a1a1a]">
          <DialogHeader><DialogTitle className="font-heading text-xl font-semibold text-[#1a1a1a]">Write your recommendation</DialogTitle></DialogHeader>
          <form onSubmit={handleWriteRec} className="space-y-3">
            <input value={recTitle} onChange={(e) => setRecTitle(e.target.value)} required placeholder="Title" className="bold-input" data-testid="write-rec-title" />
            <div className="grid grid-cols-2 gap-3">
              <input value={recAuthor} onChange={(e) => setRecAuthor(e.target.value)} placeholder="Author" className="bold-input" data-testid="write-rec-author" />
              <input value={recGenre} onChange={(e) => setRecGenre(e.target.value)} placeholder="Genre" className="bold-input" data-testid="write-rec-genre" />
            </div>
            <input value={recUrl} onChange={(e) => setRecUrl(e.target.value)} placeholder="URL (optional)" className="bold-input" data-testid="write-rec-url" />
            <textarea value={recWhyNote} onChange={(e) => setRecWhyNote(e.target.value)} required rows={3}
              className="bold-input resize-none" placeholder="What did this change for you?" data-testid="write-rec-whynote" />
            <p className="text-xs text-[#b0b0b0]">{recWhyNote.length}/20</p>
            <button type="submit" disabled={writingRec} data-testid="write-rec-submit" className="w-full bold-btn bold-btn-primary py-3 text-base">
              {writingRec ? "Submitting..." : "Submit recommendation"}
            </button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Report Dialog */}
      <Dialog open={showReport} onOpenChange={setShowReport}>
        <DialogContent className="sm:max-w-md bg-white border-2 border-[#1a1a1a] rounded-2xl shadow-[4px_4px_0_#1a1a1a]">
          <DialogHeader><DialogTitle className="font-heading text-xl font-semibold">Report</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {["Inappropriate content", "Spam", "Offensive note", "Other"].map((r) => (
              <button key={r} onClick={() => setReportReason(r)} data-testid={`report-reason-${r.toLowerCase().replace(/\s/g, '-')}`}
                className={`w-full text-left bold-btn px-4 py-3 text-sm ${reportReason === r ? "bold-btn-red" : "bold-btn-ghost"}`}>{r}</button>
            ))}
            <textarea value={reportDetail} onChange={(e) => setReportDetail(e.target.value)} rows={2} placeholder="Details (optional)" className="bold-input resize-none" data-testid="report-detail" />
            <button onClick={handleReport} data-testid="report-submit-btn" className="w-full bold-btn bold-btn-red py-3 text-base">Submit report</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
