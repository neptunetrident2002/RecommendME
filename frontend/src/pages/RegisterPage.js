import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { formatApiError } from "@/lib/api";
import { BookOpen, Eye, EyeOff } from "lucide-react";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [city, setCity] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      await register(email, password, displayName, city);
      navigate("/home");
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-[#F8F9FA]">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-brand-primary flex items-center justify-center shadow-[0_4px_0_#1899D6]">
              <BookOpen className="w-6 h-6 text-white" strokeWidth={2.5} />
            </div>
          </Link>
          <h1 className="font-heading text-3xl font-semibold text-gray-900" data-testid="register-title">Join RecommendME</h1>
          <p className="text-gray-500 mt-2 font-body">Your list is waiting for its first recommendation.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border-2 border-gray-200 rounded-3xl p-8 shadow-[0_8px_0_#e5e7eb]" data-testid="register-form">
          {error && (
            <div className="mb-4 p-3 rounded-2xl bg-red-50 border-2 border-red-200 text-red-600 text-sm font-bold" data-testid="register-error">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-widest">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 text-base font-medium focus:border-brand-primary focus:ring-0 outline-none transition-colors"
              placeholder="you@example.com" required data-testid="register-email-input" />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-widest">Password</label>
            <div className="relative">
              <input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 pr-12 text-base font-medium focus:border-brand-primary focus:ring-0 outline-none transition-colors"
                placeholder="At least 6 characters" required data-testid="register-password-input" />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                {showPw ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-widest">Display Name <span className="text-gray-400 normal-case">(optional)</span></label>
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 text-base font-medium focus:border-brand-primary focus:ring-0 outline-none transition-colors"
              placeholder="How you'd like to be known" data-testid="register-name-input" />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-widest">City <span className="text-gray-400 normal-case">(optional)</span></label>
            <input type="text" value={city} onChange={(e) => setCity(e.target.value)}
              className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 text-base font-medium focus:border-brand-primary focus:ring-0 outline-none transition-colors"
              placeholder="Your city" data-testid="register-city-input" />
          </div>

          <button type="submit" disabled={loading} data-testid="register-submit-btn"
            className="w-full py-4 rounded-2xl text-base font-bold uppercase tracking-wide bg-[#58CC02] text-white border-2 border-[#58CC02] border-b-[5px] border-b-[#46A302] hover:brightness-110 active:translate-y-[3px] active:border-b-2 transition-all disabled:opacity-50">
            {loading ? "Creating account..." : "Create account"}
          </button>

          <p className="text-center mt-6 text-sm text-gray-500 font-body">
            Already have an account?{" "}
            <Link to="/login" className="text-brand-primary font-bold hover:underline" data-testid="register-to-login">Log in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
