import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import API from "@/lib/api";
import { BookOpen, Headphones, Tv, Send, Gift, Loader2 } from "lucide-react";
import { toast } from "sonner";

const CAT_CONFIG = {
  read: { icon: BookOpen, color: "#FF9600", label: "Read" },
  listen: { icon: Headphones, color: "#FF4B4B", label: "Listen" },
  watch: { icon: Tv, color: "#FFC800", label: "Watch" },
};

export default function ShareableLinkPage() {
  const { token } = useParams();
  const [linkInfo, setLinkInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [rewardRec, setRewardRec] = useState(null);

  // Form
  const [category, setCategory] = useState("read");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [whyNote, setWhyNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadLink();
  }, [token]);

  const loadLink = async () => {
    try {
      const { data } = await API.get(`/shareable-link/${token}`);
      setLinkInfo(data);
    } catch {
      toast.error("Link not found");
    } finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (whyNote.length < 20) { toast.error("Why-note must be at least 20 characters"); return; }
    setSubmitting(true);
    try {
      const { data } = await API.post(`/shareable-link/${token}/submit`, { category, title, author, why_note: whyNote });
      setSubmitted(true);
      setRewardRec(data.reward_recommendation);
      toast.success("Recommendation sent!");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to submit");
    } finally { setSubmitting(false); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
      <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
    </div>
  );

  if (!linkInfo) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
      <p className="text-gray-500 font-body">Link not found.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center px-6 py-12" data-testid="shareable-link-page">
      <div className="w-full max-w-md">
        {!submitted ? (
          <>
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-brand-primary flex items-center justify-center shadow-[0_6px_0_#1899D6] mx-auto mb-4">
                <Gift size={32} className="text-white" strokeWidth={2} />
              </div>
              <h1 className="font-heading text-2xl font-semibold text-gray-900" data-testid="share-page-title">
                {linkInfo.owner_display_name || "Someone"} wants a recommendation
              </h1>
              <p className="text-gray-500 font-body mt-2 text-sm">Leave a recommendation and get one back.</p>
            </div>

            <form onSubmit={handleSubmit} className="bg-white border-2 border-gray-200 rounded-3xl p-6 shadow-[0_8px_0_#e5e7eb]" data-testid="share-submit-form">
              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">Category</label>
                <div className="flex gap-2">
                  {Object.entries(CAT_CONFIG).map(([k, v]) => (
                    <button key={k} type="button" onClick={() => setCategory(k)} data-testid={`share-cat-${k}`}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold capitalize transition-all ${
                        category === k ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                      style={category === k ? { backgroundColor: v.color } : {}}>
                      <v.icon size={16} /> {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-widest">Title</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="What are you recommending?"
                  className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl p-3 text-base font-medium focus:border-brand-primary outline-none"
                  data-testid="share-title-input" />
              </div>

              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-widest">Author / Artist <span className="text-gray-300">(optional)</span></label>
                <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Who made this?"
                  className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl p-3 text-base font-medium focus:border-brand-primary outline-none"
                  data-testid="share-author-input" />
              </div>

              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-widest">Why-note <span className="text-gray-300">(min 20 chars)</span></label>
                <textarea value={whyNote} onChange={(e) => setWhyNote(e.target.value)} required rows={3}
                  placeholder="What did this change for you? When did you last think about it?"
                  className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl p-3 text-base font-medium focus:border-brand-primary outline-none resize-none"
                  data-testid="share-whynote-input" />
                <p className="text-xs text-gray-400 mt-1">{whyNote.length}/20 characters minimum</p>
              </div>

              <button type="submit" disabled={submitting} data-testid="share-submit-btn"
                className="w-full py-4 rounded-2xl text-base font-bold uppercase bg-brand-primary text-white border-2 border-brand-primary border-b-[5px] border-b-[#1899D6] hover:brightness-110 active:translate-y-[3px] active:border-b-2 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                <Send size={18} /> {submitting ? "Sending..." : "Send recommendation"}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-[#58CC02] flex items-center justify-center mx-auto mb-6 shadow-[0_6px_0_#46A302] animate-bounce-subtle">
              <Gift size={36} className="text-white" />
            </div>
            <h1 className="font-heading text-2xl font-semibold text-gray-900 mb-3" data-testid="share-success-title">Recommendation sent!</h1>

            {rewardRec ? (
              <div className="bg-white border-2 border-gray-200 rounded-3xl p-6 shadow-[0_8px_0_#e5e7eb] mt-6 text-left" data-testid="reward-rec-card">
                <p className="text-xs font-bold uppercase tracking-widest text-brand-primary mb-3">Here's a recommendation in return</p>
                <h3 className="font-heading text-lg font-semibold text-gray-900">{rewardRec.title}</h3>
                {rewardRec.author && <p className="text-sm text-gray-500">{rewardRec.author}</p>}
                <p className="text-sm text-gray-600 mt-2 italic">"{rewardRec.why_note}"</p>
                <span className={`inline-block mt-3 px-3 py-1 rounded-full text-xs font-bold uppercase ${
                  rewardRec.category === "read" ? "bg-[#FF9600]/10 text-[#FF9600]" :
                  rewardRec.category === "listen" ? "bg-[#FF4B4B]/10 text-[#FF4B4B]" :
                  "bg-[#FFC800]/10 text-[#CCA000]"
                }`}>{rewardRec.category}</span>
              </div>
            ) : (
              <p className="text-gray-500 font-body mt-2">Thank you for sharing.</p>
            )}

            <p className="text-sm text-gray-400 font-body mt-6">
              Want to build your own list?{" "}
              <a href="/register" className="text-brand-primary font-bold hover:underline">Create an account</a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
