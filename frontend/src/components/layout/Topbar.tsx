"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Command, Menu, Search } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { SignalHealth } from "@/components/system/SignalHealth";
import { navItems } from "./navItems";

export function Topbar({ title, kicker, onMenuClick }: { title: string; kicker?: string; onMenuClick?: () => void }) {
  const [now, setNow] = useState(() => new Date());
  const [query, setQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
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
  const resources = useMemo(() => navItems.filter((item) => !item.secondary), []);
  const filteredResources = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return resources;

    return resources.filter((item) => item.label.toLowerCase().includes(normalizedQuery));
  }, [query, resources]);
  const quickActions = useMemo(
    () =>
      ["Live Fleet Map", "Sales & Analytics", "Transaction Logs"]
        .map((label) => resources.find((item) => item.label === label))
        .filter(Boolean),
    [resources]
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <header className="topbar">
      <div className="topbar-title-block">
        {onMenuClick && (
          <button type="button" className="mobile-menu-button" onClick={onMenuClick} aria-label="Open navigation menu">
            <Menu size={24} />
          </button>
        )}
        <div className="topbar-title-content">
          <span className="topbar-kicker">{kicker || "Philippine bus operations"}</span>
          <h1>{title}</h1>
          <p>
            {date} <span className="topbar-time">/ {time}</span>
          </p>
        </div>
      </div>

      <div
        className="topbar-command-zone"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setIsSearchOpen(false);
          }
        }}
      >
        <label className="command-search">
          <Search size={17} />
          <input
            type="search"
            value={query}
            placeholder="Search modules, routes, logs..."
            aria-label="Search POS BUS resources"
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setIsSearchOpen(true)}
          />
          <Command size={15} />
        </label>

        {isSearchOpen ? (
          <div className="command-search-results" role="listbox">
            {filteredResources.length > 0 ? (
              filteredResources.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} onClick={() => setIsSearchOpen(false)}>
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </Link>
                );
              })
            ) : (
              <span className="command-search-empty">No matching module</span>
            )}
          </div>
        ) : null}

        <div className="quick-actions" aria-label="Quick actions">
          {quickActions.map((item) => {
            if (!item) return null;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <Icon size={15} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="topbar-actions">
        <SignalHealth />
        <NotificationCenter />
        <ThemeToggle />
      </div>
    </header>
  );
}
