import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import API from "@/lib/api";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH

export default function AuthCallback() {
  const navigate = useNavigate();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace("#", ""));
    const sessionId = params.get("session_id");

    if (!sessionId) {
      navigate("/login", { replace: true });
      return;
    }

    const referralSource = localStorage.getItem("rmq_referral") || "";

    (async () => {
      try {
        const { data } = await API.post("/auth/google-callback", {
          session_id: sessionId,
          referral_source: referralSource,
        });
        if (data.access_token) {
          localStorage.setItem("access_token", data.access_token);
        }
        // Clean up hash
        window.history.replaceState(null, "", window.location.pathname);
        navigate("/home", { replace: true, state: { user: data } });
      } catch {
        navigate("/login", { replace: true });
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FFFDF7]">
      <div className="text-center">
        <div className="w-8 h-8 border-3 border-[#1a1a1a] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[#6b6b6b] font-body">Signing you in...</p>
      </div>
    </div>
  );
}
