import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { BookOpen, Shield } from "lucide-react";

export default function Navbar() {
  const { user } = useAuth();

  return (
    <nav className="sticky top-0 z-50 bg-[#FFFDF7] border-b-2 border-[#1a1a1a] px-6 py-3" data-testid="navbar">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <Link to={user ? "/home" : "/"} className="flex items-center gap-2" data-testid="nav-logo">
          <span className="font-heading font-semibold text-xl text-[#1a1a1a] tracking-tight">RecommendME</span>
        </Link>
        <div className="flex items-center gap-2">
          {!user && (
            <>
              <Link to="/login" data-testid="nav-login-btn" className="bold-btn bold-btn-ghost px-4 py-2 text-sm">
                Log in
              </Link>
              <Link to="/register" data-testid="nav-register-btn" className="bold-btn bold-btn-primary px-4 py-2 text-sm">
                Sign up
              </Link>
            </>
          )}
          {user && user.is_admin && (
            <Link to="/admin" data-testid="nav-admin" className="bold-btn bold-btn-ghost px-3 py-2 text-sm flex items-center gap-1">
              <Shield size={16} /> Admin
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
