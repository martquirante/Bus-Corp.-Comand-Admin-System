"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      data-theme-mode={theme}
    >
      <span className="theme-toggle-track">
        <span className="theme-toggle-thumb" data-active={isDark}>
          {isDark ? <Moon size={16} /> : <Sun size={16} />}
        </span>
      </span>
    </button>
  );
}
