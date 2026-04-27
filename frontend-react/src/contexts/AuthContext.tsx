/**
 * AuthContext — JWT token management with auto-refresh
 * =====================================================
 * Provides: currentUser, login(), register(), logout(), isAuthenticated
 * Stores access_token in memory (not localStorage) for XSS safety.
 * Refresh token is stored in httpOnly cookie (set by server) but we
 * also keep a copy in sessionStorage for tab persistence.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "analyst" | "viewer";
  tenant_id: string;
  created_at: string;
}

interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, totpCode?: string) => Promise<void>;
  register: (email: string, password: string, fullName: string, tenantName: string) => Promise<void>;
  logout: () => void;
  refreshTokens: () => Promise<boolean>;
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Token helpers ──────────────────────────────────────────────────────────

  const storeTokens = useCallback((access: string, refresh: string, expiresIn: number) => {
    setAccessToken(access);
    sessionStorage.setItem("refresh_token", refresh);

    // Schedule refresh 60 seconds before expiry
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const delay = Math.max(0, (expiresIn - 60) * 1000);
    refreshTimerRef.current = setTimeout(() => refreshTokens(), delay);
  }, []);

  const clearTokens = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    sessionStorage.removeItem("refresh_token");
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
  }, []);

  // ── Refresh ────────────────────────────────────────────────────────────────

  const refreshTokens = useCallback(async (): Promise<boolean> => {
    const refreshToken = sessionStorage.getItem("refresh_token");
    if (!refreshToken) {
      clearTokens();
      return false;
    }
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) {
        clearTokens();
        return false;
      }
      const data = await res.json();
      storeTokens(data.access_token, data.refresh_token, data.expires_in);
      return true;
    } catch {
      clearTokens();
      return false;
    }
  }, [clearTokens, storeTokens]);

  // ── Load user from /auth/me ────────────────────────────────────────────────

  const fetchMe = useCallback(async (token: string) => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return (await res.json()) as User;
    } catch {
      return null;
    }
  }, []);

  // ── Init: try to restore session from refresh token ───────────────────────

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      const ok = await refreshTokens();
      if (ok) {
        const token = sessionStorage.getItem("refresh_token");
        if (token) {
          // We need the access token — it's in state but the setter hasn't flushed yet
          // so we fetch it directly
          const res = await fetch(`${API_BASE}/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: token }),
          });
          if (res.ok) {
            const data = await res.json();
            storeTokens(data.access_token, data.refresh_token, data.expires_in);
            const userData = await fetchMe(data.access_token);
            if (userData) setUser(userData);
          }
        }
      }
      setIsLoading(false);
    };
    init();
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  // Update user whenever accessToken changes
  useEffect(() => {
    if (!accessToken) return;
    fetchMe(accessToken).then((u) => { if (u) setUser(u); });
  }, [accessToken, fetchMe]);

  // ── Login ──────────────────────────────────────────────────────────────────

  const login = useCallback(async (email: string, password: string, totpCode?: string) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.detail || "Login failed");
    }

    // Handle TOTP required
    if (data.totp_required) {
      if (!totpCode) throw new Error("TOTP_REQUIRED");
      const totpRes = await fetch(`${API_BASE}/api/2fa/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.access_token}`,
        },
        body: JSON.stringify({ code: totpCode }),
      });
      if (!totpRes.ok) {
        const e = await totpRes.json();
        throw new Error(e.detail || "Invalid 2FA code");
      }
    }

    storeTokens(data.access_token, data.refresh_token, data.expires_in);
  }, [storeTokens]);

  // ── Register ───────────────────────────────────────────────────────────────

  const register = useCallback(async (
    email: string,
    password: string,
    fullName: string,
    tenantName: string,
  ) => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, full_name: fullName, tenant_name: tenantName }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Registration failed");
    storeTokens(data.access_token, data.refresh_token, data.expires_in);
  }, [storeTokens]);

  // ── Logout ─────────────────────────────────────────────────────────────────

  const logout = useCallback(() => {
    clearTokens();
  }, [clearTokens]);

  return (
    <AuthContext.Provider value={{
      user,
      accessToken,
      isAuthenticated: !!accessToken && !!user,
      isLoading,
      login,
      register,
      logout,
      refreshTokens,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
