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
  const [status, setStatus] = useState("entering"); // entering, waiting, matched
  const [poolCount, setPoolCount] = useState(0);
  const [match, setMatch] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const [defaultRec, setDefaultRec] = useState(null);
  const pollRef = useRef(null);
  const timerRef = useRef(null);

  const config = CAT_CONFIG[category] || CAT_CONFIG.read;
  const Icon = config.icon;

  const enterPool = useCallback(async () => {
    try {
      const defRes = await API.get("/recommendations/default");
      setDefaultRec(defRes.data.recommendation);
      const recId = defRes.data.recommendation?.id || null;
      await API.post("/matching/enter", { category, recommendation_id: recId });
      setStatus("waiting");
    } catch (err) {
      const msg = err.response?.data?.detail || "Could not enter pool";
      toast.error(msg);
      if (msg.includes("Match limit")) navigate("/home");
    }
  }, [category, navigate]);

  useEffect(() => {
    enterPool();
    return () => {
      clearInterval(pollRef.current);
      clearInterval(timerRef.current);
    };
  }, [enterPool]);

  useEffect(() => {
    if (status === "waiting") {
      // Timer
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      // Poll for match every 3 seconds
      pollRef.current = setInterval(async () => {
        try {
          const { data } = await API.get("/matching/check");
          if (data.status === "matched") {
            setMatch(data.match);
            setStatus("matched");
            clearInterval(pollRef.current);
            clearInterval(timerRef.current);
          }
          // Also get pool count
          const pcRes = await API.get(`/matching/pool-count/${category}`);
          setPoolCount(pcRes.data.count);
        } catch {}
      }, 3000);
      // Initial pool count
      API.get(`/matching/pool-count/${category}`).then(r => setPoolCount(r.data.count)).catch(() => {});
    }
    return () => {
      clearInterval(pollRef.current);
      clearInterval(timerRef.current);
    };
  }, [status, category]);

  const handleCancel = async () => {
    try { await API.post("/matching/cancel"); } catch {}
    navigate("/home");
  };

  useEffect(() => {
    if (status === "matched" && match) {
      setTimeout(() => navigate(`/exchange/${match.id}`), 1500);
    }
  }, [status, match, navigate]);

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center px-6" data-testid="matching-screen">
      <div className="max-w-md w-full text-center">
        {/* Ambient animation */}
        <div className="relative w-40 h-40 mx-auto mb-10">
          <div className="absolute inset-0 rounded-full animate-pulse-slow" style={{ backgroundColor: `${config.color}20` }} />
          <div className="absolute inset-4 rounded-full animate-pulse-slower" style={{ backgroundColor: `${config.color}30` }} />
          <div className="absolute inset-8 rounded-full flex items-center justify-center" style={{ backgroundColor: config.color }}>
            {status === "matched" ? (
              <div className="w-16 h-16 rounded-full bg-white/30 flex items-center justify-center animate-bounce-subtle">
                <span className="text-white font-heading text-2xl font-bold">!</span>
              </div>
            ) : (
              <Icon className="w-12 h-12 text-white animate-float" strokeWidth={2} />
            )}
          </div>
        </div>

        {status === "waiting" && (
          <>
            <h1 className="font-heading text-2xl sm:text-3xl font-semibold text-gray-900 mb-3" data-testid="matching-headline">
              While someone finds you...
            </h1>
            <p className="text-gray-500 font-body mb-8">Remember why you chose this.</p>

            {/* Your recommendation */}
            {defaultRec && (
              <div className="bg-white border-2 border-gray-200 rounded-3xl p-6 shadow-[0_6px_0_#e5e7eb] text-left mb-8" data-testid="matching-my-rec">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Your recommendation</p>
                <h3 className="font-heading text-lg font-semibold text-gray-900">{defaultRec.title}</h3>
                {defaultRec.author && <p className="text-sm text-gray-500">{defaultRec.author}</p>}
                <p className="text-sm text-gray-600 mt-2 italic">"{defaultRec.why_note}"</p>
              </div>
            )}

            {/* Pool info */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white border-2 border-gray-200">
                <div className="w-2 h-2 rounded-full bg-[#58CC02] animate-pulse" />
                <span className="text-sm font-bold text-gray-600" data-testid="pool-count">
                  {poolCount} {config.label} available now
                </span>
              </div>
              <span className="text-sm text-gray-400 font-mono" data-testid="matching-timer">{formatTime(seconds)}</span>
            </div>

            {seconds >= 60 && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 mb-6" data-testid="async-match-notice">
                <p className="text-sm font-bold text-blue-600">No one right now — we'll find you a match and let you know. You can close the app.</p>
              </div>
            )}

            <button onClick={handleCancel} data-testid="cancel-matching-btn"
              className="flex items-center gap-2 mx-auto px-6 py-3 rounded-2xl text-sm font-bold text-gray-500 border-2 border-gray-200 border-b-4 border-b-gray-300 hover:bg-white active:translate-y-[2px] active:border-b-2 transition-all">
              <X size={16} /> Cancel
            </button>
          </>
        )}

        {status === "matched" && (
          <div className="animate-fade-in">
            <h1 className="font-heading text-3xl font-semibold text-gray-900 mb-3" data-testid="match-found-headline">
              Match found!
            </h1>
            <p className="text-gray-500 font-body mb-4">Preparing your exchange...</p>
            <Loader2 className="w-6 h-6 animate-spin text-brand-primary mx-auto" />
          </div>
        )}

        {status === "entering" && (
          <div>
            <Loader2 className="w-8 h-8 animate-spin text-brand-primary mx-auto mb-4" />
            <p className="text-gray-500 font-body">Entering the pool...</p>
          </div>
        )}
      </div>
    </div>
  );
}
