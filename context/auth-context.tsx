"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { getProfile, login as loginService, logout as logoutService, type LoginPayload } from "@/services/auth";
import type { User } from "@/types";

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  authInitialized: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function restoreSavedUser(saved: string | null): User | null {
  if (!saved) return null;

  try {
    const parsed = JSON.parse(saved) as Partial<User>;
    if (!parsed || typeof parsed !== "object" || !parsed.id || !parsed.name || !parsed.role) {
      console.warn("[AuthProvider] saved user is malformed:", parsed);
      return null;
    }

    return parsed as User;
  } catch (error) {
    console.error("[AuthProvider] failed to parse saved user:", error);
    return null;
  }
}

function clearAuthentication() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("kindervale-user");
  window.localStorage.removeItem("kindervale-access-token");
  window.localStorage.removeItem("kindervale-refresh-token");
  // The legacy embedded script seeds its in-memory report-card cache straight from this key at
  // load time, before any server fetch happens -- on a shared/public device, the next person to
  // log in would briefly see whatever report-card data the previous session had cached if their
  // own first fetch 403s (e.g. a role with no report-cards access at all). Not scoped per-user,
  // so the only safe lifetime for it is "until logout".
  window.localStorage.removeItem("kv_reportCards");
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      if (typeof window === "undefined") {
        setAuthInitialized(true);
        return;
      }

      const refreshToken = window.localStorage.getItem("kindervale-refresh-token");
      const savedUser = restoreSavedUser(window.localStorage.getItem("kindervale-user"));

      if (!refreshToken) {
        clearAuthentication();
        setAuthInitialized(true);
        return;
      }

      if (savedUser) {
        setUser(savedUser);
      }

      try {
        const profile = await getProfile();
        setUser(profile);
        window.localStorage.setItem("kindervale-user", JSON.stringify(profile));
      } catch (error) {
        clearAuthentication();
        setUser(null);
        if (window.location.pathname !== "/login") {
          window.location.assign("/login");
        }
      } finally {
        setAuthInitialized(true);
      }
    };

    void initialize();
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const nextUser = await loginService(payload);
    setUser(nextUser);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("kindervale-user", JSON.stringify(nextUser));
    }
    toast.success(`Welcome, ${nextUser.name}`);
    window.location.assign("/dashboard");
  }, []);

  const logout = useCallback(async () => {
    await logoutService();
    clearAuthentication();
    setUser(null);
    window.location.assign("/");
  }, []);

  const value = useMemo(
    () => ({ user, isAuthenticated: Boolean(user), authInitialized, login, logout }),
    [authInitialized, login, logout, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
