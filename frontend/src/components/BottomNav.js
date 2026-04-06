import { Link, useLocation } from "react-router-dom";
import { Home, List, Users, User } from "lucide-react";

const TABS = [
  { to: "/home", icon: Home, label: "Home" },
  { to: "/list", icon: List, label: "List" },
  { to: "/connections", icon: Users, label: "Connections" },
  { to: "/profile", icon: User, label: "Profile" },
];

export default function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-2 border-[#1a1a1a] px-4 py-2" data-testid="bottom-nav">
      <div className="max-w-lg mx-auto flex items-center justify-around">
        {TABS.map((tab) => {
          const active = pathname === tab.to || pathname.startsWith(tab.to + "/");
          return (
            <Link
              key={tab.to}
              to={tab.to}
              data-testid={`nav-${tab.label.toLowerCase()}`}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors ${
                active ? "text-[#1CB0F6]" : "text-[#6b6b6b] hover:text-[#1a1a1a]"
              }`}
            >
              <tab.icon size={22} strokeWidth={active ? 2.5 : 2} />
              <span className="text-[11px] font-bold">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
