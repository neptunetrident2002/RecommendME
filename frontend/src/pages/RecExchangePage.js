import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import API from "@/lib/api";
import { Send, Loader2, Gift } from "lucide-react";
import { toast } from "sonner";

const CAT_COLOR = { read: "#FF9600", listen: "#FF4B4B", watch: "#FFC800" };

export default function RecExchangePage() {
  const { token } = useParams();
  const [linkInfo, setLinkInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [rewardRec, setRewardRec] = useState(null);
  const [category, setCategory] = useState("read");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [whyNote, setWhyNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    API.get(`/rec-exchange-link/${token}`).then(r => setLinkInfo(r.data)).catch(() => toast.error("Link not found or expired")).finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (whyNote.length < 20) { toast.error("Why-note must be at least 20 characters"); return; }
    setSubmitting(true);
    try {
      const { data } = await API.post(`/rec-exchange-link/${token}/submit`, { category, title, author, why_note: whyNote });
      setSubmitted(true);
      setRewardRec(data.reward_recommendation);
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#FFFDF7]"><Loader2 className="w-8 h-8 animate-spin text-[#1CB0F6]" /></div>;
  if (!linkInfo) return <div className="min-h-screen flex items-center justify-center bg-[#FFFDF7]"><p className="text-[#6b6b6b]">Link expired or not found.</p></div>;

  return (
    <div className="min-h-screen bg-[#FFFDF7] flex items-center justify-center px-6 py-12" data-testid="rec-exchange-page">
      <div className="w-full max-w-md">
        {!submitted ? (
          <>
            <h1 className="font-heading text-2xl font-semibold text-[#1a1a1a] mb-2" data-testid="rec-exchange-title">
              {linkInfo.owner_display_name} wants to exchange
            </h1>
            <p className="text-[#6b6b6b] font-body text-sm mb-6">Give a recommendation and receive theirs in return.</p>
            <form onSubmit={handleSubmit} className="bold-card p-6 space-y-4">
              <div className="flex gap-2">
                {["read", "listen", "watch"].map((c) => (
                  <button key={c} type="button" onClick={() => setCategory(c)}
                    className={`bold-btn flex-1 py-2.5 text-sm capitalize ${category === c ? "bold-btn-primary" : "bold-btn-ghost"}`}>{c}</button>
                ))}
              </div>
              <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Title" className="bold-input" />
              <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Author (optional)" className="bold-input" />
              <textarea value={whyNote} onChange={(e) => setWhyNote(e.target.value)} required rows={3} className="bold-input resize-none" placeholder="What did this change for you?" />
              <p className="text-xs text-[#b0b0b0]">{whyNote.length}/20</p>
              <button type="submit" disabled={submitting} className="w-full bold-btn bold-btn-primary py-3.5 text-base flex items-center justify-center gap-2">
                <Send size={16} /> {submitting ? "Sending..." : "Exchange"}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center animate-fade-in">
            <div className="w-16 h-16 mx-auto rounded-full border-2 border-[#1a1a1a] bg-[#58CC02] flex items-center justify-center mb-4">
              <Gift size={28} className="text-white" />
            </div>
            <h1 className="font-heading text-2xl font-semibold text-[#1a1a1a] mb-4">Here's your recommendation</h1>
            {rewardRec ? (
              <div className="bold-card p-6 text-left">
                <span className="bold-badge text-[10px]" style={{ background: CAT_COLOR[rewardRec.category] || "#1CB0F6", color: rewardRec.category === "watch" ? "#1a1a1a" : "#fff" }}>{rewardRec.category}</span>
                <h3 className="font-heading text-lg font-semibold text-[#1a1a1a] mt-2">{rewardRec.title}</h3>
                {rewardRec.author && <p className="text-sm text-[#6b6b6b]">{rewardRec.author}</p>}
                <div className="mt-3 bg-[#FFFDF7] border-2 border-[#1a1a1a] rounded-xl p-3">
                  <p className="text-sm text-[#1a1a1a] italic">"{rewardRec.why_note}"</p>
                </div>
              </div>
            ) : (
              <p className="text-[#6b6b6b]">Thanks for sharing!</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
