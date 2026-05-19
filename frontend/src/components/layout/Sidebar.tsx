"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { navItems } from "./navItems";
import { useAuth } from "@/contexts/AuthContext";

const navGroups = [
  {
    label: "Operations",
    items: ["Dashboard", "Live Fleet Map", "Sales & Analytics", "Transaction Logs"]
  },
  {
    label: "Configuration",
    items: ["Route Config", "Bus Fleet Management", "Remittances"]
  },
  {
    label: "People & Control",
    items: ["Employees", "Violations", "Admin Tools"]
  }
];

export function Sidebar({
  collapsed,
  onToggleCollapsed
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const pathname = usePathname();
  const { session, logout } = useAuth();
  const primaryNavItems = navItems.filter((item) => !item.secondary);
  const operatorName = session?.user.fullName || "Admin User";
  const operatorRole = session?.user.role === "SuperAdmin" ? "Owner/Admin" : session?.user.role || "Admin";

  return (
    <aside className="sidebar app-sidebar" data-collapsed={collapsed}>
      <div className="sidebar-top-row">
        <Link href="/dashboard" className="brand-lockup" aria-label="POS Bus dashboard">
          <Image src="/assets/logos/pos-bus-logo.png" width={44} height={44} alt="POS Bus logo" />
          <div className="brand-text">
            <strong>POS BUS</strong>
            <span>Command Center</span>
          </div>
        </Link>

        <button
          type="button"
          className="sidebar-collapse-button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
        </button>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        {navGroups.map((group) => {
          const items = group.items
            .map((label) => primaryNavItems.find((item) => item.label === label))
            .filter(Boolean);

          return (
            <div className="sidebar-nav-group" key={group.label}>
              <span className="sidebar-section-label sidebar-section-title">{group.label}</span>
              {items.map((item) => {
                if (!item) return null;
                const Icon = item.icon;
                const isActive = pathname === item.href || (pathname === "/" && item.href === "/dashboard");

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`sidebar-nav-item${isActive ? " active" : ""}`}
                    title={item.label}
                  >
                    <Icon size={18} />
                    <span className="nav-label">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-ticket" title={`${operatorName} - ${operatorRole} online`}>
        <span className="operator-details">Active operator</span>
        <strong className="operator-details">{operatorName}</strong>
        <small>
          <i aria-hidden="true" />
          <span className="operator-details">{operatorRole} online</span>
        </small>
      </div>

      <button type="button" className="logout-button" onClick={logout} title="Logout">
        <LogOut size={17} />
        <span className="logout-label">Logout</span>
      </button>
    </aside>
  );
}
