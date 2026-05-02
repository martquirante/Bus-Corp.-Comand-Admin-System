"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { navItems } from "./navItems";
import { useAuth } from "@/contexts/AuthContext";

export function Sidebar() {
  const pathname = usePathname();
  const { session, logout } = useAuth();

  return (
    <aside className="sidebar">
      <Link href="/dashboard" className="brand-lockup" aria-label="POS Bus dashboard">
        <Image src="/assets/logos/pos-bus-logo.png" width={44} height={44} alt="POS Bus logo" />
        <div>
          <strong>POS BUS</strong>
          <span>Admin Command</span>
        </div>
      </Link>

      <nav className="sidebar-nav" aria-label="Main navigation">
        {navItems
          .filter((item) => !item.secondary)
          .map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (pathname === "/" && item.href === "/dashboard");

            return (
              <Link key={item.href} href={item.href} className={isActive ? "active" : ""}>
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
      </nav>

      <div className="sidebar-ticket">
        <span>Operator</span>
        <strong>{session?.user.fullName || "Admin User"}</strong>
        <small>{session?.user.role || "SuperAdmin"} online</small>
      </div>

      <button type="button" className="logout-button" onClick={logout}>
        <LogOut size={17} />
        Logout
      </button>
    </aside>
  );
}
