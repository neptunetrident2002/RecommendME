import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { formatApiError } from "@/lib/api";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
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
          <h1 className="font-heading text-3xl font-semibold text-[#1a1a1a]" data-testid="login-title">Welcome back</h1>
          <p className="text-[#6b6b6b] mt-2 font-body">Your list is waiting for you.</p>
        </div>

        <form onSubmit={handleSubmit} className="bold-card p-8" data-testid="login-form">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-[#FF4B4B]/10 border-2 border-[#FF4B4B] text-[#FF4B4B] text-sm font-bold" data-testid="login-error">
              {error}
            </div>
          )}
          <div className="mb-4">
            <label className="block text-sm font-bold text-[#1a1a1a] mb-2">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="bold-input" placeholder="you@example.com" required data-testid="login-email-input" />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-bold text-[#1a1a1a] mb-2">Password</label>
            <div className="relative">
              <input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                className="bold-input pr-12" placeholder="Your password" required data-testid="login-password-input" />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6b6b6b]">
                {showPw ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading} data-testid="login-submit-btn"
            className="w-full bold-btn bold-btn-primary py-3.5 text-base">
            {loading ? "Signing in..." : "Log in"}
          </button>
          <p className="text-center mt-6 text-sm text-[#6b6b6b] font-body">
            Don't have an account?{" "}
            <Link to="/register" className="text-[#1CB0F6] font-bold hover:underline" data-testid="login-to-register">Sign up</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
