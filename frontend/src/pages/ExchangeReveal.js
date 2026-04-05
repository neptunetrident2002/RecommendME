import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "@/lib/api";
import { BookOpen, Headphones, Tv, MapPin, Clock, Heart, Flag, ArrowLeft, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const CAT_ICON = { read: BookOpen, listen: Headphones, watch: Tv };
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

  // Write rec form
  const [showWriteRec, setShowWriteRec] = useState(false);
  const [recTitle, setRecTitle] = useState("");
  const [recAuthor, setRecAuthor] = useState("");
  const [recUrl, setRecUrl] = useState("");
  const [recWhyNote, setRecWhyNote] = useState("");
  const [writingRec, setWritingRec] = useState(false);

  useEffect(() => {
    loadExchange();
  }, [matchId]);

  const loadExchange = async () => {
    try {
      const { data } = await API.get(`/matching/exchange/${matchId}`);
      setExchange(data);
      if (data.needs_my_rec && data.match.status === "pending") {
        setShowWriteRec(true);
      }
    } catch (err) {
      toast.error("Could not load exchange");
      navigate("/home");
    } finally {
      setLoading(false);
    }
  };

  // Countdown timer
  useEffect(() => {
    if (!exchange?.match?.expires_at) return;
    const update = () => {
      const expires = new Date(exchange.match.expires_at);
      const now = new Date();
      const diff = expires - now;
      if (diff <= 0) { setCountdown("Expired"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setCountdown(`${h}h ${m}m remaining`);
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
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not reveal");
    } finally {
      setRevealing(false);
    }
  };

  const handleFollow = async () => {
    try {
      const { data } = await API.post("/follow", { match_id: matchId });
      if (data.connection_formed) {
        toast.success("You're connected!");
      } else {
        toast.success("Followed! Waiting for them to follow back.");
      }
      loadExchange();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not follow");
    }
  };

  const handleWriteRec = async (e) => {
    e.preventDefault();
    if (recWhyNote.length < 20) { toast.error("Why-note must be at least 20 characters"); return; }
    setWritingRec(true);
    try {
      await API.post("/matching/write-rec", {
        match_id: matchId, title: recTitle, author: recAuthor, url: recUrl, why_note: recWhyNote,
      });
      setShowWriteRec(false);
      toast.success("Recommendation submitted!");
      loadExchange();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    } finally {
      setWritingRec(false);
    }
  };

  const handleReport = async () => {
    if (!reportReason) { toast.error("Select a reason"); return; }
    try {
      const otherId = exchange.match.user_a_id === exchange.match.user_b_id ? "" : 
        (exchange.their_recommendation?.user_id || "unknown");
      await API.post("/reports", { reported_user_id: otherId, match_id: matchId, reason: reportReason, detail: reportDetail });
      toast.success("Report submitted");
      setShowReport(false);
    } catch {
      toast.error("Could not submit report");
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
      <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
    </div>
  );

  if (!exchange) return null;
  const { match: m, their_recommendation: theirRec, my_recommendation: myRec, their_city, i_followed, is_connected } = exchange;
  const category = m.category || "read";
  const Icon = CAT_ICON[category] || BookOpen;
  const color = CAT_COLOR[category] || "#1CB0F6";
  const isRevealed = m.status === "active" || m.status === "completed";
  const isPending = m.status === "pending";

  return (
    <div className="min-h-screen bg-[#F8F9FA] px-6 py-8" data-testid="exchange-screen">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => navigate("/home")} className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-700 mb-6" data-testid="exchange-back-btn">
          <ArrowLeft size={16} /> Back to home
        </button>

        {/* Match status header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold" style={{ backgroundColor: `${color}15`, color }}>
            <Icon size={16} strokeWidth={2.5} />
            {category.charAt(0).toUpperCase() + category.slice(1)} exchange
          </div>
          {isRevealed && m.expires_at && (
            <p className="mt-3 flex items-center justify-center gap-2 text-sm font-bold text-gray-500" data-testid="follow-window-countdown">
              <Clock size={14} /> {countdown}
            </p>
          )}
        </div>

        {/* Pending state — need reveal */}
        {isPending && !exchange.needs_my_rec && (
          <div className="text-center">
            <div className="bg-white border-2 border-gray-200 rounded-3xl p-8 shadow-[0_8px_0_#e5e7eb] mb-6">
              <h2 className="font-heading text-2xl font-semibold text-gray-900 mb-3" data-testid="reveal-heading">Both recommendations are ready</h2>
              <p className="text-gray-500 font-body mb-6">Reveal to see what they recommended for you.</p>
              <button onClick={handleReveal} disabled={revealing} data-testid="reveal-btn"
                className="px-8 py-4 rounded-2xl text-base font-bold uppercase bg-brand-primary text-white border-2 border-brand-primary border-b-[5px] border-b-[#1899D6] hover:brightness-110 active:translate-y-[3px] active:border-b-2 transition-all disabled:opacity-50">
                {revealing ? "Revealing..." : "Reveal exchange"}
              </button>
            </div>
          </div>
        )}

        {/* Revealed exchange */}
        {isRevealed && theirRec && (
          <div className="space-y-6">
            {/* Their recommendation */}
            <div className="bg-white border-2 rounded-3xl p-6 shadow-[0_8px_0_#e5e7eb]" style={{ borderColor: `${color}40` }} data-testid="their-rec-card">
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color }}>Their recommendation for you</p>
              <h2 className="font-heading text-2xl font-semibold text-gray-900">{theirRec.title}</h2>
              {theirRec.author && <p className="text-gray-500 font-body mt-1">{theirRec.author}</p>}
              <div className="mt-4 bg-gray-50 rounded-2xl p-4">
                <p className="text-gray-700 font-body italic leading-relaxed">"{theirRec.why_note}"</p>
              </div>
              {theirRec.url && (
                <a href={theirRec.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-4 text-sm font-bold text-brand-primary hover:underline" data-testid="their-rec-url">
                  <ExternalLink size={14} /> Open link
                </a>
              )}
              {their_city && (
                <p className="flex items-center gap-1 mt-3 text-sm text-gray-400"><MapPin size={14} /> {their_city}</p>
              )}
            </div>

            {/* My recommendation */}
            {myRec && (
              <div className="bg-white border-2 border-gray-200 rounded-3xl p-6 shadow-[0_6px_0_#e5e7eb]" data-testid="my-rec-card">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">What you gave</p>
                <h3 className="font-heading text-lg font-semibold text-gray-900">{myRec.title}</h3>
                {myRec.author && <p className="text-sm text-gray-500">{myRec.author}</p>}
                <p className="text-sm text-gray-600 mt-2 italic">"{myRec.why_note}"</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              {!i_followed && !is_connected && countdown !== "Expired" && (
                <button onClick={handleFollow} data-testid="follow-btn"
                  className="flex-1 py-4 rounded-2xl text-base font-bold uppercase bg-[#58CC02] text-white border-2 border-[#58CC02] border-b-[5px] border-b-[#46A302] hover:brightness-110 active:translate-y-[3px] active:border-b-2 transition-all flex items-center justify-center gap-2">
                  <Heart size={18} /> Follow
                </button>
              )}
              {i_followed && !is_connected && (
                <div className="flex-1 py-4 rounded-2xl text-base font-bold uppercase text-center bg-green-50 text-[#58CC02] border-2 border-[#58CC02]" data-testid="followed-badge">
                  Followed — waiting for them
                </div>
              )}
              {is_connected && (
                <div className="flex-1 py-4 rounded-2xl text-base font-bold uppercase text-center bg-green-50 text-[#58CC02] border-2 border-[#58CC02]" data-testid="connected-badge">
                  You're connected!
                </div>
              )}
              <button onClick={() => setShowReport(true)} data-testid="report-btn"
                className="px-4 py-4 rounded-2xl text-sm font-bold text-gray-400 border-2 border-gray-200 hover:text-red-500 hover:border-red-200 transition-colors">
                <Flag size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Write Rec Dialog */}
      <Dialog open={showWriteRec} onOpenChange={setShowWriteRec}>
        <DialogContent className="sm:max-w-lg rounded-3xl border-2 border-gray-200">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-semibold">Write your recommendation</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500 font-body mb-4">You need to give before you can receive. Write a fresh recommendation now.</p>
          <form onSubmit={handleWriteRec} className="space-y-4">
            <input value={recTitle} onChange={(e) => setRecTitle(e.target.value)} required placeholder="Title"
              className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl p-3 text-base font-medium focus:border-brand-primary outline-none" data-testid="write-rec-title" />
            <input value={recAuthor} onChange={(e) => setRecAuthor(e.target.value)} placeholder="Author / Artist (optional)"
              className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl p-3 text-base font-medium focus:border-brand-primary outline-none" data-testid="write-rec-author" />
            <input value={recUrl} onChange={(e) => setRecUrl(e.target.value)} placeholder="URL (optional)"
              className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl p-3 text-base font-medium focus:border-brand-primary outline-none" data-testid="write-rec-url" />
            <textarea value={recWhyNote} onChange={(e) => setRecWhyNote(e.target.value)} required rows={3}
              className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl p-3 text-base font-medium focus:border-brand-primary outline-none resize-none"
              placeholder="What did this change for you?" data-testid="write-rec-whynote" />
            <p className="text-xs text-gray-400">{recWhyNote.length}/20 characters minimum</p>
            <button type="submit" disabled={writingRec} data-testid="write-rec-submit"
              className="w-full py-3 rounded-2xl font-bold uppercase bg-brand-primary text-white border-2 border-brand-primary border-b-4 border-b-[#1899D6] hover:brightness-110 active:translate-y-[2px] active:border-b-2 transition-all disabled:opacity-50">
              {writingRec ? "Submitting..." : "Submit recommendation"}
            </button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Report Dialog */}
      <Dialog open={showReport} onOpenChange={setShowReport}>
        <DialogContent className="sm:max-w-md rounded-3xl border-2 border-gray-200">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-semibold">Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {["Inappropriate content", "Spam", "Offensive note", "Other"].map((r) => (
              <button key={r} onClick={() => setReportReason(r)} data-testid={`report-reason-${r.toLowerCase().replace(/\s/g, '-')}`}
                className={`w-full text-left px-4 py-3 rounded-2xl text-sm font-bold border-2 transition-colors ${
                  reportReason === r ? "border-red-400 bg-red-50 text-red-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}>{r}</button>
            ))}
            <textarea value={reportDetail} onChange={(e) => setReportDetail(e.target.value)} rows={2} placeholder="Additional details (optional)"
              className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl p-3 text-sm focus:border-red-400 outline-none resize-none" data-testid="report-detail" />
            <button onClick={handleReport} data-testid="report-submit-btn"
              className="w-full py-3 rounded-2xl font-bold uppercase bg-red-500 text-white border-2 border-red-500 border-b-4 border-b-red-700 hover:brightness-110 active:translate-y-[2px] active:border-b-2 transition-all">
              Submit report
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
