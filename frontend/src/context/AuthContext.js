import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem("spcs_token");
    if (!token) {
      setUser(false);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
      localStorage.setItem("spcs_user", JSON.stringify(data));
    } catch {
      localStorage.removeItem("spcs_token");
      localStorage.removeItem("spcs_user");
      setUser(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (nik, password) => {
    const { data } = await api.post("/auth/login", { nik, password });
    localStorage.setItem("spcs_token", data.access_token);
    localStorage.setItem("spcs_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch (e) { /* ignore */ }
    localStorage.removeItem("spcs_token");
    localStorage.removeItem("spcs_user");
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
