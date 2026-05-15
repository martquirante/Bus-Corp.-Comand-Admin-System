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
    try {
      const stored = window.localStorage.getItem(sessionStorageKey);
      if (stored) {
        setSession(JSON.parse(stored) as Session);
      }
    } catch {
      try {
        window.localStorage.removeItem(sessionStorageKey);
      } catch {
        // Storage can be unavailable in restricted browser contexts.
      }
    } finally {
      setIsReady(true);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isReady,
      async login(email: string, password: string) {
        const result = await api.login(email, password);
        setSession(result.data);
        try {
          window.localStorage.setItem(sessionStorageKey, JSON.stringify(result.data));
        } catch {
          // Keep the in-memory session even if browser storage is unavailable.
        }
      },
      logout() {
        setSession(null);
        try {
          window.localStorage.removeItem(sessionStorageKey);
        } catch {
          // Ignore storage cleanup failures in restricted browser contexts.
        }
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
