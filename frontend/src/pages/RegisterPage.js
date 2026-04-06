import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { formatApiError } from "@/lib/api";
import { Eye, EyeOff } from "lucide-react";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [city, setCity] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const from = searchParams.get("from");
    if (from) localStorage.setItem("rmq_referral", from);
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      const referral = localStorage.getItem("rmq_referral") || "";
      await register(email, password, displayName, city, referral);
      navigate("/home");
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-[#FFFDF7]">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-semibold text-[#1a1a1a]" data-testid="register-title">Join RecommendME</h1>
          <p className="text-[#6b6b6b] mt-2 font-body">Your list is waiting for its first recommendation.</p>
        </div>

        <div className="bold-card p-8" data-testid="register-form-container">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-[#FF4B4B]/10 border-2 border-[#FF4B4B] text-[#FF4B4B] text-sm font-bold" data-testid="register-error">
              {error}
            </div>
          )}

          <GoogleSignInButton label="Sign up with Google" />

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-0.5 bg-[#e0e0e0]" />
            <span className="text-sm text-[#6b6b6b] font-body">or</span>
            <div className="flex-1 h-0.5 bg-[#e0e0e0]" />
          </div>

          <form onSubmit={handleSubmit} data-testid="register-form">
            <div className="mb-4">
              <label className="block text-sm font-bold text-[#1a1a1a] mb-2">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="bold-input" placeholder="you@example.com" required data-testid="register-email-input" />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-bold text-[#1a1a1a] mb-2">Password</label>
              <div className="relative">
                <input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                  className="bold-input pr-12" placeholder="At least 6 characters" required data-testid="register-password-input" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6b6b6b]">
                  {showPw ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-bold text-[#1a1a1a] mb-2">Display name <span className="text-[#6b6b6b] font-normal">(optional)</span></label>
              <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                className="bold-input" placeholder="How you'd like to be known" data-testid="register-name-input" />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-bold text-[#1a1a1a] mb-2">City <span className="text-[#6b6b6b] font-normal">(optional)</span></label>
              <input type="text" value={city} onChange={(e) => setCity(e.target.value)}
                className="bold-input" placeholder="Your city" data-testid="register-city-input" />
            </div>
            <button type="submit" disabled={loading} data-testid="register-submit-btn"
              className="w-full bold-btn bold-btn-green py-3.5 text-base">
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="text-center mt-6 text-sm text-[#6b6b6b] font-body">
            Already have an account?{" "}
            <Link to="/login" className="text-[#1CB0F6] font-bold hover:underline" data-testid="register-to-login">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
