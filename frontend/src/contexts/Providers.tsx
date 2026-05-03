"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AuthProvider } from "./AuthContext";
import { ThemeProvider } from "./ThemeContext";
import { LoadingScreen } from "@/components/loading/LoadingScreen";
import { CriticalAlertProvider } from "@/components/critical-alerts/CriticalAlertProvider";
import { ChatWidget } from "@/components/messages/ChatWidget";

export function Providers({ children }: { children: ReactNode }) {
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const timeout = window.setTimeout(() => setBooting(false), 950);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <CriticalAlertProvider>
          {booting ? <LoadingScreen /> : null}
          {children}
          <ChatWidget />
        </CriticalAlertProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
