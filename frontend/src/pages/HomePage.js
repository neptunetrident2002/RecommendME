import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import API from "@/lib/api";
import { BookOpen, Headphones, Tv, ArrowRight, Plus, Check, Share2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const CATEGORIES = [
  { key: "read", label: "Read", desc: "Books, articles, essays", icon: BookOpen, color: "bg-[#FF9600]", shadow: "shadow-[0_6px_0_#CC7A00]", hoverShadow: "hover:shadow-[0_10px_0_#CC7A00]", border: "border-[#FF9600]", img: "https://images.unsplash.com/photo-1714146682506-d6f86fe8517a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjd8MHwxfHNlYXJjaHw0fHwzZCUyMGlsbHVzdHJhdGlvbiUyMG9yYW5nZSUyMGJvb2t8ZW58MHx8fHwxNzc0OTUyNTE2fDA&ixlib=rb-4.1.0&q=85&w=300" },
  { key: "listen", label: "Listen", desc: "Music, podcasts, albums", icon: Headphones, color: "bg-[#FF4B4B]", shadow: "shadow-[0_6px_0_#CC3C3C]", hoverShadow: "hover:shadow-[0_10px_0_#CC3C3C]", border: "border-[#FF4B4B]", img: "https://images.unsplash.com/photo-1613040809024-b4ef7ba99bc3?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAxODF8MHwxfHNlYXJjaHwyfHwzZCUyMGlsbHVzdHJhdGlvbiUyMGhlYWRwaG9uZXN8ZW58MHx8fHwxNzc0OTUyNTI5fDA&ixlib=rb-4.1.0&q=85&w=300" },
  { key: "watch", label: "Watch", desc: "Films, shows, videos", icon: Tv, color: "bg-[#FFC800]", shadow: "shadow-[0_6px_0_#CCA000]", hoverShadow: "hover:shadow-[0_10px_0_#CCA000]", border: "border-[#FFC800]", img: "https://images.pexels.com/photos/7991378/pexels-photo-7991378.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=300&w=300" },
];

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [defaultRec, setDefaultRec] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showRecForm, setShowRecForm] = useState(false);
  const [activeMatches, setActiveMatches] = useState([]);
  const [shareLink, setShareLink] = useState(null);

  // Rec form state
  const [recTitle, setRecTitle] = useState("");
  const [recAuthor, setRecAuthor] = useState("");
  const [recUrl, setRecUrl] = useState("");
  const [recWhyNote, setRecWhyNote] = useState("");
  const [recCategory, setRecCategory] = useState("read");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [defRes, matchRes, linkRes] = await Promise.all([
        API.get("/recommendations/default"),
        API.get("/matches/active"),
        API.get("/shareable-link/generate"),
      ]);
      setDefaultRec(defRes.data.recommendation);
      setActiveMatches(matchRes.data);
      setShareLink(linkRes.data);
    } catch {}
  };

  const handleCategoryClick = (cat) => {
    setSelectedCategory(cat);
  };

  const handleStartMatching = () => {
    if (!selectedCategory) { toast.error("Pick a category first"); return; }
    navigate(`/match?category=${selectedCategory}`);
  };

  const handleCreateRec = async (e) => {
    e.preventDefault();
    if (recWhyNote.length < 20) { toast.error("Why-note must be at least 20 characters"); return; }
    setSubmitting(true);
    try {
      const { data } = await API.post("/recommendations", {
        title: recTitle, author: recAuthor, category: recCategory, url: recUrl, why_note: recWhyNote,
      });
      await API.post("/recommendations/set-default", { recommendation_id: data.id });
      setDefaultRec(data);
      setShowRecForm(false);
      setRecTitle(""); setRecAuthor(""); setRecUrl(""); setRecWhyNote("");
      toast.success("Default recommendation set!");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create");
    } finally {
      setSubmitting(false);
    }
  };

  const copyShareLink = () => {
    if (shareLink?.token) {
      const url = `${window.location.origin}/r/${shareLink.token}`;
      navigator.clipboard.writeText(url);
      toast.success("Link copied!");
    }
  };

  const matchesLeft = user?.is_pro ? "Unlimited" : `${Math.max(0, (user?.max_matches || 3) - (user?.matches_used || 0))} of ${user?.max_matches || 3}`;

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Greeting */}
        <div className="mb-10">
          <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-gray-900 tracking-tight" data-testid="home-headline">
            What do you need today?
          </h1>
          <p className="text-gray-500 mt-2 font-body text-base">
            Matches left: <span className="font-bold text-gray-700">{matchesLeft}</span>
          </p>
        </div>

        {/* Active matches banner */}
        {activeMatches.length > 0 && (
          <div className="mb-8 bg-white border-2 border-brand-primary rounded-3xl p-5 shadow-[0_6px_0_#1899D6] cursor-pointer hover:-translate-y-1 hover:shadow-[0_10px_0_#1899D6] transition-all"
            onClick={() => navigate(`/exchange/${activeMatches[0].id}`)} data-testid="active-match-banner">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-widest text-brand-primary">Active Match</p>
                <p className="text-gray-700 font-body mt-1">You have a {activeMatches[0].category} exchange waiting</p>
              </div>
              <ArrowRight className="text-brand-primary" size={24} />
            </div>
          </div>
        )}

        {/* Category cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => handleCategoryClick(cat.key)}
              data-testid={`category-card-${cat.key}`}
              className={`relative flex flex-col items-center p-6 bg-white border-2 rounded-3xl cursor-pointer transition-all ${
                selectedCategory === cat.key
                  ? `${cat.border} ${cat.shadow} -translate-y-1`
                  : `border-gray-200 shadow-[0_6px_0_#e5e7eb] hover:-translate-y-1 ${cat.hoverShadow}`
              }`}
            >
              {selectedCategory === cat.key && (
                <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-[#58CC02] flex items-center justify-center shadow-[0_3px_0_#46A302]">
                  <Check className="w-4 h-4 text-white" strokeWidth={3} />
                </div>
              )}
              <div className="w-full h-32 rounded-2xl overflow-hidden mb-4">
                <img src={cat.img} alt={cat.label} className="w-full h-full object-cover" />
              </div>
              <div className={`w-12 h-12 rounded-2xl ${cat.color} flex items-center justify-center ${cat.shadow} mb-3`}>
                <cat.icon className="w-6 h-6 text-white" strokeWidth={2.5} />
              </div>
              <span className="font-heading text-xl font-semibold text-gray-900">{cat.label}</span>
              <span className="text-sm text-gray-400 font-body mt-1">{cat.desc}</span>
            </button>
          ))}
        </div>

        {/* Default rec & CTA */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          {/* Default Rec */}
          <div className="bg-white border-2 border-gray-200 rounded-3xl p-6 shadow-[0_8px_0_#e5e7eb]" data-testid="default-rec-card">
            <p className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-3">Your recommendation of the day</p>
            {defaultRec ? (
              <div>
                <h3 className="font-heading text-lg font-semibold text-gray-900">{defaultRec.title}</h3>
                {defaultRec.author && <p className="text-sm text-gray-500 font-body">{defaultRec.author}</p>}
                <p className="text-sm text-gray-600 font-body mt-2 line-clamp-3 italic">"{defaultRec.why_note}"</p>
                <span className={`inline-block mt-3 px-3 py-1 rounded-full text-xs font-bold uppercase ${
                  defaultRec.category === "read" ? "bg-[#FF9600]/10 text-[#FF9600]" :
                  defaultRec.category === "listen" ? "bg-[#FF4B4B]/10 text-[#FF4B4B]" :
                  "bg-[#FFC800]/10 text-[#CCA000]"
                }`}>{defaultRec.category}</span>
              </div>
            ) : (
              <p className="text-gray-400 font-body text-sm">No default set yet. Set one before matching.</p>
            )}
            <button onClick={() => { setShowRecForm(true); setRecCategory(selectedCategory || "read"); }}
              data-testid="set-default-rec-btn"
              className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-brand-primary hover:bg-blue-50 transition-colors">
              <Plus size={16} /> {defaultRec ? "Change" : "Set recommendation"}
            </button>
          </div>

          {/* Match CTA */}
          <div className="flex flex-col justify-between bg-white border-2 border-gray-200 rounded-3xl p-6 shadow-[0_8px_0_#e5e7eb]">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-3">Ready?</p>
              <p className="font-body text-gray-600 text-sm mb-4">
                You receive only after you give. Make sure you have a recommendation ready.
              </p>
            </div>
            <button onClick={handleStartMatching} data-testid="find-rec-btn"
              className={`w-full py-4 rounded-2xl text-base font-bold uppercase tracking-wide text-white border-2 transition-all ${
                selectedCategory
                  ? "bg-brand-primary border-brand-primary border-b-[5px] border-b-[#1899D6] hover:brightness-110 active:translate-y-[3px] active:border-b-2"
                  : "bg-gray-300 border-gray-300 border-b-[5px] border-b-gray-400 cursor-not-allowed"
              }`}>
              Find a recommendation <ArrowRight size={18} className="inline ml-2" />
            </button>
          </div>
        </div>

        {/* Share link */}
        <div className="bg-white border-2 border-gray-200 rounded-3xl p-6 shadow-[0_8px_0_#e5e7eb]" data-testid="share-link-section">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-1">Your shareable link</p>
              <p className="text-gray-600 font-body text-sm">Share this link and let anyone leave you a recommendation.</p>
            </div>
            <button onClick={copyShareLink} data-testid="copy-share-link-btn"
              className="flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold bg-white text-brand-primary border-2 border-gray-200 border-b-4 border-b-gray-300 hover:bg-gray-50 active:translate-y-[2px] active:border-b-2 transition-all">
              <Share2 size={16} /> Copy link
            </button>
          </div>
        </div>
      </div>

      {/* Create Recommendation Dialog */}
      <Dialog open={showRecForm} onOpenChange={setShowRecForm}>
        <DialogContent className="sm:max-w-lg rounded-3xl border-2 border-gray-200">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-semibold">Set your recommendation</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateRec} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-widest">Category</label>
              <div className="flex gap-2">
                {["read", "listen", "watch"].map((c) => (
                  <button key={c} type="button" onClick={() => setRecCategory(c)} data-testid={`rec-form-cat-${c}`}
                    className={`px-4 py-2 rounded-xl text-sm font-bold capitalize transition-all ${
                      recCategory === c ? "bg-brand-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}>{c}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-widest">Title</label>
              <input value={recTitle} onChange={(e) => setRecTitle(e.target.value)} required data-testid="rec-form-title"
                className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl p-3 text-base font-medium focus:border-brand-primary outline-none transition-colors"
                placeholder="What are you recommending?" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-widest">Author / Artist <span className="text-gray-300">(optional)</span></label>
              <input value={recAuthor} onChange={(e) => setRecAuthor(e.target.value)} data-testid="rec-form-author"
                className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl p-3 text-base font-medium focus:border-brand-primary outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-widest">URL <span className="text-gray-300">(optional)</span></label>
              <input value={recUrl} onChange={(e) => setRecUrl(e.target.value)} data-testid="rec-form-url"
                className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl p-3 text-base font-medium focus:border-brand-primary outline-none transition-colors"
                placeholder="https://..." />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-widest">
                Why-note <span className="text-gray-300">(min 20 chars)</span>
              </label>
              <textarea value={recWhyNote} onChange={(e) => setRecWhyNote(e.target.value)} required rows={3} data-testid="rec-form-whynote"
                className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl p-3 text-base font-medium focus:border-brand-primary outline-none transition-colors resize-none"
                placeholder="What did this change for you? When did you last think about it?" />
              <p className="text-xs text-gray-400 mt-1">{recWhyNote.length}/20 characters minimum</p>
            </div>
            <button type="submit" disabled={submitting} data-testid="rec-form-submit-btn"
              className="w-full py-3 rounded-2xl text-base font-bold uppercase tracking-wide bg-[#58CC02] text-white border-2 border-[#58CC02] border-b-4 border-b-[#46A302] hover:brightness-110 active:translate-y-[2px] active:border-b-2 transition-all disabled:opacity-50">
              {submitting ? "Saving..." : "Set as default"}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
