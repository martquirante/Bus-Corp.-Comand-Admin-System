"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AuthProvider } from "./AuthContext";
import { ThemeProvider } from "./ThemeContext";
import { LoadingScreen } from "@/components/loading/LoadingScreen";

export function Providers({ children }: { children: ReactNode }) {
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const timeout = window.setTimeout(() => setBooting(false), 950);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        {booting ? <LoadingScreen /> : null}
        {children}
      </AuthProvider>
    </ThemeProvider>
  );
}
