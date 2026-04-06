import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import API from "@/lib/api";
import { BookOpen, Headphones, Tv, ArrowRight, Plus, Check, Share2, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const CATEGORIES = [
  { key: "read", label: "Read", desc: "Books, articles, essays", icon: BookOpen, color: "#FF9600" },
  { key: "listen", label: "Listen", desc: "Music, podcasts, albums", icon: Headphones, color: "#FF4B4B" },
  { key: "watch", label: "Watch", desc: "Films, shows, videos", icon: Tv, color: "#FFC800" },
];

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [weeklyDefaults, setWeeklyDefaults] = useState({});
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showRecForm, setShowRecForm] = useState(false);
  const [activeMatches, setActiveMatches] = useState([]);

  // Rec form state
  const [recTitle, setRecTitle] = useState("");
  const [recAuthor, setRecAuthor] = useState("");
  const [recGenre, setRecGenre] = useState("");
  const [recUrl, setRecUrl] = useState("");
  const [recWhyNote, setRecWhyNote] = useState("");
  const [recCategory, setRecCategory] = useState("read");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [defRes, matchRes] = await Promise.all([
        API.get("/recommendations/weekly-defaults"),
        API.get("/matches/active"),
      ]);
      setWeeklyDefaults(defRes.data);
      setActiveMatches(matchRes.data);
    } catch {}
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
        title: recTitle, author: recAuthor, category: recCategory, genre: recGenre, url: recUrl, why_note: recWhyNote,
      });
      await API.post("/recommendations/set-weekly-default", { recommendation_id: data.id, category: recCategory });
      setShowRecForm(false);
      setRecTitle(""); setRecAuthor(""); setRecGenre(""); setRecUrl(""); setRecWhyNote("");
      toast.success("Weekly default set!");
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create");
    } finally {
      setSubmitting(false);
    }
  };

  const count = user?.match_count || 0;
  const max = user?.is_pro ? 10 : 3;

  return (
    <div className="min-h-screen bg-[#FFFDF7] pb-safe">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Headline */}
        <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-[#1a1a1a] tracking-tight mb-2" data-testid="home-headline">
          What do you need today?
        </h1>
        <p className="text-[#6b6b6b] font-body text-sm mb-8">
          Matches today: <span className="font-bold text-[#1a1a1a]">{count}/{max}</span>
        </p>

        {/* Active match banner */}
        {activeMatches.length > 0 && (
          <button onClick={() => navigate(`/exchange/${activeMatches[0].id}`)}
            className="w-full bold-card p-5 mb-6 text-left flex items-center justify-between cursor-pointer" data-testid="active-match-banner">
            <div>
              <p className="text-xs font-bold text-[#1CB0F6]">Active match</p>
              <p className="text-[#1a1a1a] font-body mt-0.5">You have a {activeMatches[0].category} exchange waiting</p>
            </div>
            <ArrowRight size={20} className="text-[#1a1a1a]" />
          </button>
        )}

        {/* Category buttons */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {CATEGORIES.map((cat) => {
            const def = weeklyDefaults[cat.key];
            const isSelected = selectedCategory === cat.key;
            return (
              <button key={cat.key} onClick={() => setSelectedCategory(cat.key)} data-testid={`category-card-${cat.key}`}
                className={`bold-card p-4 text-center relative transition-all ${isSelected ? "ring-2 ring-offset-2 ring-[#1a1a1a]" : ""}`}>
                {isSelected && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#58CC02] border-2 border-[#1a1a1a] flex items-center justify-center">
                    <Check size={14} className="text-white" strokeWidth={3} />
                  </div>
                )}
                <div className="w-10 h-10 mx-auto rounded-lg border-2 border-[#1a1a1a] flex items-center justify-center mb-2" style={{ background: cat.color }}>
                  <cat.icon size={20} className={cat.color === "#FFC800" ? "text-[#1a1a1a]" : "text-white"} strokeWidth={2.5} />
                </div>
                <p className="font-heading font-semibold text-[#1a1a1a] text-base">{cat.label}</p>
                <p className="text-[#6b6b6b] text-xs mt-0.5 font-body">{cat.desc}</p>
                {def?.valid && (
                  <div className="mt-2 flex items-center justify-center gap-1 text-[10px] font-bold text-[#58CC02]">
                    <Clock size={10} /> {Math.round(def.hours_left)}h left
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Weekly defaults */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-lg font-semibold text-[#1a1a1a]">Weekly defaults</h2>
            <button onClick={() => { setShowRecForm(true); setRecCategory(selectedCategory || "read"); }}
              data-testid="set-default-rec-btn" className="bold-btn bold-btn-ghost px-3 py-2 text-sm flex items-center gap-1">
              <Plus size={14} /> Set default
            </button>
          </div>
          <div className="space-y-3">
            {CATEGORIES.map((cat) => {
              const def = weeklyDefaults[cat.key];
              return (
                <div key={cat.key} className="bold-card p-4" data-testid={`weekly-default-${cat.key}`}>
                  <div className="flex items-start gap-3">
                    <div className="bold-badge" style={{ background: cat.color, color: cat.color === "#FFC800" ? "#1a1a1a" : "#fff" }}>
                      {cat.label}
                    </div>
                    <div className="flex-1 min-w-0">
                      {def?.valid && def.recommendation ? (
                        <>
                          <p className="font-heading font-semibold text-[#1a1a1a] text-sm">{def.recommendation.title}</p>
                          {def.recommendation.author && <p className="text-xs text-[#6b6b6b]">{def.recommendation.author}</p>}
                          <p className="text-xs text-[#6b6b6b] mt-1 italic line-clamp-2">"{def.recommendation.why_note}"</p>
                        </>
                      ) : (
                        <p className="text-xs text-[#6b6b6b]">Not set this week</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Match CTA */}
        <button onClick={handleStartMatching} data-testid="find-rec-btn"
          className={`w-full bold-btn py-4 text-base flex items-center justify-center gap-2 ${
            selectedCategory ? "bold-btn-primary" : "bold-btn-ghost opacity-60 cursor-not-allowed"
          }`}>
          Find a recommendation <ArrowRight size={18} />
        </button>
      </div>

      {/* Create Recommendation Dialog */}
      <Dialog open={showRecForm} onOpenChange={setShowRecForm}>
        <DialogContent className="sm:max-w-lg bg-white border-2 border-[#1a1a1a] rounded-2xl shadow-[4px_4px_0_#1a1a1a]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-semibold text-[#1a1a1a]">Set weekly default</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateRec} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#6b6b6b] mb-1">Category</label>
              <div className="flex gap-2">
                {["read", "listen", "watch"].map((c) => (
                  <button key={c} type="button" onClick={() => setRecCategory(c)} data-testid={`rec-form-cat-${c}`}
                    className={`bold-btn px-4 py-2 text-sm capitalize ${recCategory === c ? "bold-btn-primary" : "bold-btn-ghost"}`}>{c}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#6b6b6b] mb-1">Title</label>
              <input value={recTitle} onChange={(e) => setRecTitle(e.target.value)} required data-testid="rec-form-title"
                className="bold-input" placeholder="What are you recommending?" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#6b6b6b] mb-1">Author</label>
                <input value={recAuthor} onChange={(e) => setRecAuthor(e.target.value)} data-testid="rec-form-author" className="bold-input" />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#6b6b6b] mb-1">Genre</label>
                <input value={recGenre} onChange={(e) => setRecGenre(e.target.value)} data-testid="rec-form-genre" className="bold-input" placeholder="e.g. literary fiction" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#6b6b6b] mb-1">URL <span className="text-[#b0b0b0]">(optional)</span></label>
              <input value={recUrl} onChange={(e) => setRecUrl(e.target.value)} data-testid="rec-form-url" className="bold-input" placeholder="https://..." />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#6b6b6b] mb-1">Why-note <span className="text-[#b0b0b0]">(min 20 chars)</span></label>
              <textarea value={recWhyNote} onChange={(e) => setRecWhyNote(e.target.value)} required rows={3} data-testid="rec-form-whynote"
                className="bold-input resize-none" placeholder="What did this change for you?" />
              <p className="text-xs text-[#b0b0b0] mt-1">{recWhyNote.length}/20</p>
            </div>
            <button type="submit" disabled={submitting} data-testid="rec-form-submit-btn"
              className="w-full bold-btn bold-btn-green py-3 text-base">
              {submitting ? "Saving..." : "Set as default"}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
