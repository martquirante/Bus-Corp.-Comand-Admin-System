"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { AuthProvider } from "./AuthContext";
import { ThemeProvider } from "./ThemeContext";
import { LoadingScreen } from "@/components/loading/LoadingScreen";
import { CriticalAlertProvider } from "@/components/critical-alerts/CriticalAlertProvider";
import { ChatWidget } from "@/components/messages/ChatWidget";
import { api, apiBaseUrl } from "@/services/api";

const BOOT_ANIMATION_MS = 950;
const BOOT_FALLBACK_MS = 10000;

export function Providers({ children }: { children: ReactNode }) {
  const [booting, setBooting] = useState(true);
  const [apiWarning, setApiWarning] = useState<string | null>(null);

  useEffect(() => {
    const readyTimer = window.setTimeout(() => setBooting(false), BOOT_ANIMATION_MS);
    const fallbackTimer = window.setTimeout(() => setBooting(false), BOOT_FALLBACK_MS);

    return () => {
      window.clearTimeout(readyTimer);
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  useEffect(() => {
    let active = true;

    api.health()
      .then(() => {
        if (active) setApiWarning(null);
      })
      .catch(() => {
        if (!active) return;
        setApiWarning(
          `Backend API is not reachable. Check NEXT_PUBLIC_API_BASE_URL and backend server. Current API: ${apiBaseUrl}`
        );
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <CriticalAlertProvider>
          {booting ? <LoadingScreen /> : null}
          {apiWarning ? (
            <div className="api-offline-banner" role="status">
              <AlertTriangle size={16} />
              <span>{apiWarning}</span>
            </div>
          ) : null}
          {children}
          <ChatWidget />
        </CriticalAlertProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
