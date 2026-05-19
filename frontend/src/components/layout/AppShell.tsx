"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { LoginPage } from "@/features/auth/LoginPage";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/Skeleton";

const SIDEBAR_STORAGE_KEY = "pos-bus-sidebar-collapsed";

export function AppShell({
  title,
  kicker,
  mainClassName,
  children
}: {
  title: string;
  kicker?: string;
  mainClassName?: string;
  children: ReactNode;
}) {
  const { session, isReady } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored === "true" || stored === "false") {
      setIsSidebarCollapsed(stored === "true");
      return;
    }

    setIsSidebarCollapsed(window.matchMedia("(max-width: 1024px)").matches);
  }, []);

  const toggleSidebar = () => {
    setIsSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      return next;
    });
  };

  const collapseSidebar = () => {
    setIsSidebarCollapsed(true);
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "true");
  };

  if (!isReady) {
    return (
      <main className="auth-shell">
        <Skeleton className="auth-skeleton" />
      </main>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  return (
    <div className={`app-frame app-shell${isSidebarCollapsed ? " sidebar-collapsed" : ""}`}>
      <Sidebar collapsed={isSidebarCollapsed} onToggleCollapsed={toggleSidebar} />
      <button
        type="button"
        className="sidebar-backdrop"
        aria-label="Collapse navigation drawer"
        onClick={collapseSidebar}
      />
      <div className={`app-main${mainClassName ? ` ${mainClassName}` : ""}`}>
        <Topbar title={title} kicker={kicker} onMenuClick={() => setIsSidebarCollapsed(false)} />
        <motion.main
          className="page-surface"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}
