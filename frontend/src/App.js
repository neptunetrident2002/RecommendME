import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "sonner";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import ProtectedRoute from "@/components/ProtectedRoute";
import LandingPage from "@/pages/LandingPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import AuthCallback from "@/pages/AuthCallback";
import HomePage from "@/pages/HomePage";
import MatchingScreen from "@/pages/MatchingScreen";
import ExchangeReveal from "@/pages/ExchangeReveal";
import MyList from "@/pages/MyList";
import ConnectionsPage from "@/pages/ConnectionsPage";
import ProfilePage from "@/pages/ProfilePage";
import AdminDashboard from "@/pages/AdminDashboard";
import ShareableLinkPage from "@/pages/ShareableLinkPage";
import RecExchangePage from "@/pages/RecExchangePage";
import PublicTastePage from "@/pages/PublicTastePage";
import KnownBlendInvitePage from "@/pages/KnownBlendInvitePage";

function AppLayout({ children, showNav = true }) {
  return (
    <>
      <Navbar />
      {children}
      {showNav && <BottomNav />}
    </>
  );
}

function AppRouter() {
  const location = useLocation();
  // Check URL fragment for session_id synchronously (Google OAuth callback)
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      {/* Public — no bottom nav */}
      <Route path="/" element={<><Navbar /><LandingPage /></>} />
      <Route path="/login" element={<><Navbar /><LoginPage /></>} />
      <Route path="/register" element={<><Navbar /><RegisterPage /></>} />
      <Route path="/r/:token" element={<ShareableLinkPage />} />
      <Route path="/x/:token" element={<RecExchangePage />} />
      <Route path="/u/:handle" element={<PublicTastePage />} />
      <Route path="/blend-invite/:token" element={<KnownBlendInvitePage />} />

      {/* Protected — with bottom nav */}
      <Route path="/home" element={<ProtectedRoute><AppLayout><HomePage /></AppLayout></ProtectedRoute>} />
      <Route path="/match" element={<ProtectedRoute><MatchingScreen /></ProtectedRoute>} />
      <Route path="/exchange/:matchId" element={<ProtectedRoute><AppLayout><ExchangeReveal /></AppLayout></ProtectedRoute>} />
      <Route path="/list" element={<ProtectedRoute><AppLayout><MyList /></AppLayout></ProtectedRoute>} />
      <Route path="/connections" element={<ProtectedRoute><AppLayout><ConnectionsPage /></AppLayout></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><AppLayout><ProfilePage /></AppLayout></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute adminOnly><AppLayout showNav={false}><AdminDashboard /></AppLayout></ProtectedRoute>} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="App font-body">
          <Toaster position="top-center" richColors closeButton toastOptions={{ className: "!border-2 !border-[#1a1a1a] !rounded-xl !shadow-[4px_4px_0_#1a1a1a] !font-body" }} />
          <AppRouter />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
