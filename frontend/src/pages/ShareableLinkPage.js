import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import API from "@/lib/api";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ShareableLinkPage() {
  const { token } = useParams();
  const [linkInfo, setLinkInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [category, setCategory] = useState("read");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [whyNote, setWhyNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    API.get(`/shareable-link/${token}`).then(r => setLinkInfo(r.data)).catch(() => toast.error("Link not found")).finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (whyNote.length < 20) { toast.error("Why-note must be at least 20 characters"); return; }
    setSubmitting(true);
    try {
      await API.post(`/shareable-link/${token}/submit`, { category, title, author, why_note: whyNote });
      setSubmitted(true);
      toast.success("Sent!");
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#FFFDF7]"><Loader2 className="w-8 h-8 animate-spin text-[#1CB0F6]" /></div>;
  if (!linkInfo) return <div className="min-h-screen flex items-center justify-center bg-[#FFFDF7]"><p className="text-[#6b6b6b]">Link not found.</p></div>;

  return (
    <div className="min-h-screen bg-[#FFFDF7] flex items-center justify-center px-6 py-12" data-testid="shareable-link-page">
      <div className="w-full max-w-md">
        {!submitted ? (
          <>
            <h1 className="font-heading text-2xl font-semibold text-[#1a1a1a] mb-2" data-testid="share-page-title">
              {linkInfo.owner_display_name} wants a recommendation
            </h1>
            <p className="text-[#6b6b6b] font-body text-sm mb-6">Leave one. It goes straight to their list.</p>
            <form onSubmit={handleSubmit} className="bold-card p-6 space-y-4" data-testid="share-submit-form">
              <div className="flex gap-2">
                {["read", "listen", "watch"].map((c) => (
                  <button key={c} type="button" onClick={() => setCategory(c)}
                    className={`bold-btn flex-1 py-2.5 text-sm capitalize ${category === c ? "bold-btn-primary" : "bold-btn-ghost"}`}>{c}</button>
                ))}
              </div>
              <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Title" className="bold-input" data-testid="share-title-input" />
              <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Author (optional)" className="bold-input" data-testid="share-author-input" />
              <textarea value={whyNote} onChange={(e) => setWhyNote(e.target.value)} required rows={3}
                className="bold-input resize-none" placeholder="What did this change for you?" data-testid="share-whynote-input" />
              <p className="text-xs text-[#b0b0b0]">{whyNote.length}/20</p>
              <button type="submit" disabled={submitting} data-testid="share-submit-btn"
                className="w-full bold-btn bold-btn-primary py-3.5 text-base flex items-center justify-center gap-2">
                <Send size={16} /> {submitting ? "Sending..." : "Send recommendation"}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center animate-fade-in">
            <div className="w-16 h-16 mx-auto rounded-full border-2 border-[#1a1a1a] bg-[#58CC02] flex items-center justify-center mb-4">
              <Send size={28} className="text-white" />
            </div>
            <h1 className="font-heading text-2xl font-semibold text-[#1a1a1a] mb-2" data-testid="share-success-title">Recommendation sent!</h1>
            <p className="text-[#6b6b6b] font-body text-sm mt-4">
              Want your own list? <a href="/register" className="text-[#1CB0F6] font-bold hover:underline">Create an account</a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
