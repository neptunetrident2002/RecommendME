import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "sonner";
import Navbar from "@/components/Navbar";
import ProtectedRoute from "@/components/ProtectedRoute";
import LandingPage from "@/pages/LandingPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import HomePage from "@/pages/HomePage";
import MatchingScreen from "@/pages/MatchingScreen";
import ExchangeReveal from "@/pages/ExchangeReveal";
import MyList from "@/pages/MyList";
import ConnectionsPage from "@/pages/ConnectionsPage";
import AdminDashboard from "@/pages/AdminDashboard";
import ShareableLinkPage from "@/pages/ShareableLinkPage";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="App font-body">
          <Toaster position="top-center" richColors closeButton />
          <Routes>
            {/* Public */}
            <Route path="/" element={<><Navbar /><LandingPage /></>} />
            <Route path="/login" element={<><Navbar /><LoginPage /></>} />
            <Route path="/register" element={<><Navbar /><RegisterPage /></>} />
            <Route path="/r/:token" element={<ShareableLinkPage />} />

            {/* Protected */}
            <Route path="/home" element={<ProtectedRoute><Navbar /><HomePage /></ProtectedRoute>} />
            <Route path="/match" element={<ProtectedRoute><MatchingScreen /></ProtectedRoute>} />
            <Route path="/exchange/:matchId" element={<ProtectedRoute><Navbar /><ExchangeReveal /></ProtectedRoute>} />
            <Route path="/list" element={<ProtectedRoute><Navbar /><MyList /></ProtectedRoute>} />
            <Route path="/connections" element={<ProtectedRoute><Navbar /><ConnectionsPage /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute adminOnly><Navbar /><AdminDashboard /></ProtectedRoute>} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
