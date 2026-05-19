"use client";

import { createContext, useContext, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { ThemeMode } from "@pos-bus/shared";

type ThemeContextValue = {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "pos-bus-theme";
const LEGACY_STORAGE_KEY = "posBusTheme";

const isThemeMode = (value: string | null): value is ThemeMode => value === "light" || value === "dark";

const applyDocumentTheme = (theme: ThemeMode) => {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("dark");
  const [hasLoadedTheme, setHasLoadedTheme] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const legacyStored = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    const initialTheme = isThemeMode(stored) ? stored : isThemeMode(legacyStored) ? legacyStored : "dark";

    setThemeState(initialTheme);
    applyDocumentTheme(initialTheme);
    window.localStorage.setItem(STORAGE_KEY, initialTheme);
    if (legacyStored) window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    setHasLoadedTheme(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedTheme) return;
    applyDocumentTheme(theme);
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [hasLoadedTheme, theme]);

  const setTheme = useCallback((nextTheme: ThemeMode) => {
    setThemeState(nextTheme);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setThemeState((current) => (current === "dark" ? "light" : "dark"))
    }),
    [setTheme, theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider.");
  return context;
}
