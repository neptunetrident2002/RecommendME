import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { BookOpen, Menu, X, LogOut, User, LayoutDashboard, List, Users } from "lucide-react";
import { useState } from "react";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b-2 border-gray-100 px-6 py-3" data-testid="navbar">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <Link to={user ? "/home" : "/"} className="flex items-center gap-2 group" data-testid="nav-logo">
          <div className="w-10 h-10 rounded-2xl bg-brand-primary flex items-center justify-center shadow-[0_4px_0_#1899D6] group-hover:translate-y-[1px] group-hover:shadow-[0_3px_0_#1899D6] transition-all">
            <BookOpen className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-heading font-semibold text-xl text-gray-900 tracking-tight">RecommendME</span>
        </Link>

        {user && (
          <>
            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-2">
              <NavLink to="/home" icon={<LayoutDashboard size={18} />} label="Home" />
              <NavLink to="/list" icon={<List size={18} />} label="My List" />
              <NavLink to="/connections" icon={<Users size={18} />} label="Connections" />
              {user.is_admin && <NavLink to="/admin" icon={<User size={18} />} label="Admin" />}
              <button onClick={handleLogout} data-testid="nav-logout-btn" className="ml-2 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-gray-500 hover:text-red-500 hover:bg-red-50 transition-colors">
                <LogOut size={18} /> Logout
              </button>
            </div>

            {/* Mobile hamburger */}
            <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)} data-testid="nav-mobile-toggle">
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </>
        )}

        {!user && (
          <div className="flex items-center gap-3">
            <Link to="/login" data-testid="nav-login-btn" className="px-4 py-2 rounded-xl text-sm font-bold text-brand-primary hover:bg-blue-50 transition-colors">
              Log in
            </Link>
            <Link to="/register" data-testid="nav-register-btn" className="px-5 py-2 rounded-xl text-sm font-bold bg-brand-primary text-white border-2 border-brand-primary border-b-4 border-b-[#1899D6] hover:brightness-110 active:translate-y-[2px] active:border-b-2 transition-all">
              Sign up
            </Link>
          </div>
        )}
      </div>

      {/* Mobile menu */}
      {user && mobileOpen && (
        <div className="md:hidden mt-3 pb-3 border-t border-gray-100 pt-3 flex flex-col gap-1">
          <MobileLink to="/home" label="Home" onClick={() => setMobileOpen(false)} />
          <MobileLink to="/list" label="My List" onClick={() => setMobileOpen(false)} />
          <MobileLink to="/connections" label="Connections" onClick={() => setMobileOpen(false)} />
          {user.is_admin && <MobileLink to="/admin" label="Admin" onClick={() => setMobileOpen(false)} />}
          <button onClick={handleLogout} className="text-left px-4 py-2 rounded-xl text-sm font-bold text-red-500 hover:bg-red-50">Logout</button>
        </div>
      )}
    </nav>
  );
}

function NavLink({ to, icon, label }) {
  return (
    <Link to={to} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-gray-600 hover:text-brand-primary hover:bg-blue-50 transition-colors" data-testid={`nav-${label.toLowerCase().replace(/\s/g, '-')}`}>
      {icon} {label}
    </Link>
  );
}

function MobileLink({ to, label, onClick }) {
  return (
    <Link to={to} onClick={onClick} className="px-4 py-2 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50">
      {label}
    </Link>
  );
}
