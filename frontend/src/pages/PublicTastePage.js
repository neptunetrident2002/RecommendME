import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import API from "@/lib/api";
import { MapPin, Loader2 } from "lucide-react";

const CAT_COLOR = { read: "#FF9600", listen: "#FF4B4B", watch: "#FFC800" };

export default function PublicTastePage() {
  const { handle } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get(`/public/user/${handle}`).then(r => setProfile(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [handle]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#FFFDF7]"><Loader2 className="w-8 h-8 animate-spin text-[#1CB0F6]" /></div>;
  if (!profile) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FFFDF7]">
      <div className="text-center">
        <h1 className="font-heading text-2xl font-semibold text-[#1a1a1a]">Not found</h1>
        <p className="text-[#6b6b6b] text-sm mt-2">This profile doesn't exist or is private.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FFFDF7] px-6 py-8" data-testid="public-taste-page">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-semibold text-[#1a1a1a]" data-testid="public-name">{profile.display_name}'s list</h1>
          {profile.city && <p className="text-[#6b6b6b] flex items-center gap-1 mt-1 text-sm"><MapPin size={14} /> {profile.city}</p>}
        </div>

        {profile.entries.length === 0 ? (
          <div className="bold-card p-10 text-center"><p className="text-[#6b6b6b]">No public entries yet.</p></div>
        ) : (
          <div className="space-y-3">
            {profile.entries.map((entry, i) => {
              const rec = entry.recommendation;
              const color = CAT_COLOR[rec.category] || "#1CB0F6";
              return (
                <div key={i} className="bold-card p-4" data-testid={`public-entry-${i}`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="bold-badge text-[10px]" style={{ background: color, color: rec.category === "watch" ? "#1a1a1a" : "#fff" }}>{rec.category}</span>
                    {rec.genre && <span className="bold-badge bg-[#FFFDF7] text-[10px]">{rec.genre}</span>}
                    {entry.completion_status === "completed" && <span className="bold-badge bg-[#58CC02] text-white text-[10px]">Done</span>}
                  </div>
                  <h3 className="font-heading font-semibold text-[#1a1a1a] text-sm">{rec.title}</h3>
                  {rec.author && <p className="text-xs text-[#6b6b6b]">{rec.author}</p>}
                  {rec.why_note && <p className="text-xs text-[#6b6b6b] mt-1 italic line-clamp-2">"{rec.why_note}"</p>}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 text-center">
          <p className="text-sm text-[#6b6b6b]">
            Built with <a href="/" className="text-[#1CB0F6] font-bold hover:underline">RecommendME</a>
          </p>
        </div>
      </div>
    </div>
  );
}
