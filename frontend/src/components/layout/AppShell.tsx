"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { LoginPage } from "@/features/auth/LoginPage";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/Skeleton";

export function AppShell({
  title,
  kicker,
  children
}: {
  title: string;
  kicker?: string;
  children: ReactNode;
}) {
  const { session, isReady } = useAuth();

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
    <div className="app-frame">
      <Sidebar />
      <div className="app-main">
        <Topbar title={title} kicker={kicker} />
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
