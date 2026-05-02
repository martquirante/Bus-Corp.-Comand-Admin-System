"use client";

import { Bell, Command, RadioTower, Search } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export function Topbar({ title, kicker }: { title: string; kicker?: string }) {
  const date = new Intl.DateTimeFormat("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(new Date());

  return (
    <header className="topbar">
      <div>
        <span className="topbar-kicker">{kicker || "Philippine bus operations"}</span>
        <h1>{title}</h1>
        <p>{date}</p>
      </div>
      <div className="topbar-actions">
        <label className="command-search">
          <Search size={16} />
          <input type="search" placeholder="Search bus, route, ticket" aria-label="Search command center" />
          <Command size={14} />
        </label>
        <button type="button" className="icon-button" aria-label="Signal health">
          <RadioTower size={18} />
        </button>
        <button type="button" className="icon-button" aria-label="Notifications">
          <Bell size={18} />
          <span className="notification-dot" />
        </button>
        <ThemeToggle />
      </div>
    </header>
  );
}
