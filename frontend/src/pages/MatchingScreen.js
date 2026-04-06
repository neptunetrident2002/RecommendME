import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import API from "@/lib/api";
import { BookOpen, Headphones, Tv, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

const CAT_CONFIG = {
  read: { icon: BookOpen, color: "#FF9600", label: "readers" },
  listen: { icon: Headphones, color: "#FF4B4B", label: "listeners" },
  watch: { icon: Tv, color: "#FFC800", label: "watchers" },
};

export default function MatchingScreen() {
  const [searchParams] = useSearchParams();
  const category = searchParams.get("category") || "read";
  const navigate = useNavigate();
  const [status, setStatus] = useState("entering");
  const [match, setMatch] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const pollRef = useRef(null);
  const timerRef = useRef(null);

  const config = CAT_CONFIG[category] || CAT_CONFIG.read;
  const Icon = config.icon;

  const enterPool = useCallback(async () => {
    try {
      await API.post("/matching/enter", { category });
      setStatus("waiting");
    } catch (err) {
      const msg = err.response?.data?.detail || "Could not enter pool";
      toast.error(msg);
      navigate("/home");
    }
  }, [category, navigate]);

  useEffect(() => {
    enterPool();
    return () => { clearInterval(pollRef.current); clearInterval(timerRef.current); };
  }, [enterPool]);

  useEffect(() => {
    if (status === "waiting") {
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      pollRef.current = setInterval(async () => {
        try {
          const { data } = await API.get("/matching/check");
          if (data.status === "matched") {
            setMatch(data.match);
            setStatus("matched");
            clearInterval(pollRef.current);
            clearInterval(timerRef.current);
          }
        } catch {}
      }, 3000);
    }
    return () => { clearInterval(pollRef.current); clearInterval(timerRef.current); };
  }, [status]);

  const handleCancel = async () => {
    try { await API.post("/matching/cancel"); } catch {}
    navigate("/home");
  };

  useEffect(() => {
    if (status === "matched" && match) {
      setTimeout(() => navigate(`/exchange/${match.id}`), 1200);
    }
  }, [status, match, navigate]);

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="min-h-screen bg-[#FFFDF7] flex flex-col items-center justify-center px-6" data-testid="matching-screen">
      <div className="max-w-sm w-full text-center">
        {/* Ambient circle — no pool count shown */}
        <div className="relative w-36 h-36 mx-auto mb-10">
          <div className="absolute inset-0 rounded-full animate-pulse-slow border-2 border-[#1a1a1a]" style={{ backgroundColor: `${config.color}20` }} />
          <div className="absolute inset-6 rounded-full border-2 border-[#1a1a1a] flex items-center justify-center" style={{ backgroundColor: config.color }}>
            {status === "matched" ? (
              <span className="text-white font-heading text-3xl font-bold">!</span>
            ) : (
              <Icon className={`w-10 h-10 animate-float ${config.color === "#FFC800" ? "text-[#1a1a1a]" : "text-white"}`} strokeWidth={2} />
            )}
          </div>
        </div>

        {status === "waiting" && (
          <>
            <h1 className="font-heading text-2xl font-semibold text-[#1a1a1a] mb-2" data-testid="matching-headline">
              While someone finds you...
            </h1>
            <p className="text-[#6b6b6b] font-body mb-6 text-sm">Remember why you chose this.</p>
            <p className="text-[#b0b0b0] font-mono text-sm mb-8" data-testid="matching-timer">{formatTime(seconds)}</p>

            {seconds >= 60 && (
              <div className="bold-card p-4 mb-6 text-left" data-testid="async-match-notice">
                <p className="text-sm font-bold text-[#1CB0F6]">No one right now. We'll find you a match. You can close the app.</p>
              </div>
            )}

            <button onClick={handleCancel} data-testid="cancel-matching-btn"
              className="bold-btn bold-btn-ghost px-6 py-3 text-sm flex items-center gap-2 mx-auto">
              <X size={16} /> Cancel
            </button>
          </>
        )}

        {status === "matched" && (
          <div className="animate-fade-in">
            <h1 className="font-heading text-3xl font-semibold text-[#1a1a1a] mb-2" data-testid="match-found-headline">Match found!</h1>
            <Loader2 className="w-6 h-6 animate-spin text-[#1CB0F6] mx-auto mt-4" />
          </div>
        )}

        {status === "entering" && (
          <div>
            <Loader2 className="w-8 h-8 animate-spin text-[#1CB0F6] mx-auto mb-4" />
            <p className="text-[#6b6b6b] font-body">Entering the pool...</p>
          </div>
        )}
      </div>
    </div>
  );
}
