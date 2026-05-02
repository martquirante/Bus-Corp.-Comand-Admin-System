"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { AdminAccount } from "@pos-bus/shared";
import { api, sessionStorageKey } from "@/services/api";

type Session = {
  token: string;
  user: AdminAccount;
};

type AuthContextValue = {
  session: Session | null;
  isReady: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(sessionStorageKey);
    if (stored) {
      try {
        setSession(JSON.parse(stored) as Session);
      } catch {
        window.localStorage.removeItem(sessionStorageKey);
      }
    }
    setIsReady(true);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isReady,
      async login(email: string, password: string) {
        const result = await api.login(email, password);
        setSession(result.data);
        window.localStorage.setItem(sessionStorageKey, JSON.stringify(result.data));
      },
      logout() {
        setSession(null);
        window.localStorage.removeItem(sessionStorageKey);
      }
    }),
    [session, isReady]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
