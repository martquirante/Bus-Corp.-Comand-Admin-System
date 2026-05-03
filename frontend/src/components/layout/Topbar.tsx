"use client";

import { useEffect, useMemo, useState } from "react";
import { Command, Search } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { SignalHealth } from "@/components/system/SignalHealth";

export function Topbar({ title, kicker }: { title: string; kicker?: string }) {
  const [now, setNow] = useState(() => new Date());
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-PH", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
      }),
    []
  );
  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-PH", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
      }),
    []
  );
  const date = dateFormatter.format(now);
  const time = timeFormatter.format(now);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <header className="topbar">
      <div>
        <span className="topbar-kicker">{kicker || "Philippine bus operations"}</span>
        <h1>{title}</h1>
        <p>{date} <span className="topbar-time">• {time}</span></p>
      </div>
      <div className="topbar-actions">
        <label className="command-search">
          <Search size={16} />
          <input type="search" placeholder="Search bus, route, ticket" aria-label="Search command center" />
          <Command size={14} />
        </label>
        <SignalHealth />
        <NotificationCenter />
        <ThemeToggle />
      </div>
    </header>
  );
}
