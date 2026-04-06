import { createContext, useContext, useState, useEffect, useCallback } from "react";
import API from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = checking, false = not auth'd
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const { data } = await API.get("/auth/me");
      setUser(data);
    } catch {
      setUser(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // CRITICAL: If returning from OAuth callback, skip the /me check.
    // AuthCallback will exchange the session_id and establish the session first.
    if (window.location.hash?.includes("session_id=")) {
      setLoading(false);
      return;
    }
    checkAuth();
  }, [checkAuth]);

  const login = async (email, password) => {
    const { data } = await API.post("/auth/login", { email, password });
    if (data.access_token) localStorage.setItem("access_token", data.access_token);
    setUser(data);
    return data;
  };

  const register = async (email, password, display_name, city, referral_source) => {
    const { data } = await API.post("/auth/register", { email, password, display_name, city, referral_source });
    if (data.access_token) localStorage.setItem("access_token", data.access_token);
    setUser(data);
    return data;
  };

  const loginAsGuest = async () => {
    // Capture referral source if present
    const referral = localStorage.getItem("rmq_referral") || "";
    const { data } = await API.post("/auth/guest", { referral_source: referral });
    if (data.access_token) localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("rmq_guest_id", data.guest_id);
    setUser(data.user);
    return data;
  };

  const convertGuest = async (guestId, email, password, display_name, city) => {
    const { data } = await API.post("/auth/convert-guest", {
      guest_id: guestId, email, password, display_name, city,
    });
    if (data.access_token) localStorage.setItem("access_token", data.access_token);
    localStorage.removeItem("rmq_guest_id");
    setUser(data);
    return data;
  };

  const googleLogin = async (sessionData) => {
    setUser(sessionData);
  };

  const logout = async () => {
    try { await API.post("/auth/logout"); } catch {}
    localStorage.removeItem("access_token");
    localStorage.removeItem("rmq_guest_id");
    setUser(false);
  };

  const updateProfile = async (updates) => {
    const { data } = await API.put("/auth/profile", updates);
    setUser(data);
    return data;
  };

  return (
    <AuthContext.Provider value={{
      user, loading, login, register, loginAsGuest, convertGuest,
      googleLogin, logout, updateProfile, checkAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
