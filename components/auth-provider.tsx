"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  type AuthUser,
  fetchCurrentUser,
  logoutSession,
  restoreSessionOnce,
  setAccessToken,
} from "@/lib/auth-client";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  acceptAccessToken: (token: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    let active = true;
    void restoreSessionOnce().then((session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setStatus(session ? "authenticated" : "unauthenticated");
    });
    return () => {
      active = false;
    };
  }, []);

  const acceptAccessToken = useCallback(async (token: string) => {
    setAccessToken(token);
    const currentUser = await fetchCurrentUser();
    setUser(currentUser);
    setStatus(currentUser ? "authenticated" : "unauthenticated");
    return Boolean(currentUser);
  }, []);

  const logout = useCallback(async () => {
    await logoutSession();
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const value = useMemo(
    () => ({ user, status, acceptAccessToken, logout }),
    [user, status, acceptAccessToken, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
