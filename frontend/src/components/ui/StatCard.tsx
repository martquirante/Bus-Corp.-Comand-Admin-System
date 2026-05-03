"use client";

import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

type StatCardProps = {
  label: string;
  value: ReactNode;
  detail: string;
  tone: "blue" | "green" | "amber" | "red" | "violet";
  icon: LucideIcon;
};

export function StatCard({ label, value, detail, tone, icon: Icon }: StatCardProps) {
  return (
    <motion.article
      className={`stat-card tone-${tone}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, rotateX: 1.5, rotateY: -1.5 }}
      transition={{ duration: 0.28 }}
    >
      <div className="stat-card-route" aria-hidden="true" />
      <div className="stat-icon">
        <Icon size={22} />
      </div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{detail}</span>
      </div>
    </motion.article>
  );
}
