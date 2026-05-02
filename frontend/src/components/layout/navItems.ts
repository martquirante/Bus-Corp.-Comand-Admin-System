import {
  BarChart3,
  BusFront,
  LayoutDashboard,
  MapPinned,
  ReceiptText,
  Route,
  ShieldCheck
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const navItems: Array<{
  href: string;
  label: string;
  icon: LucideIcon;
  secondary?: boolean;
}> = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/fleet-map", label: "Live Fleet Map", icon: MapPinned },
  { href: "/sales-analytics", label: "Sales & Analytics", icon: BarChart3 },
  { href: "/transaction-logs", label: "Transaction Logs", icon: ReceiptText },
  { href: "/route-config", label: "Route Config", icon: Route },
  { href: "/admin-tools", label: "Admin Tools", icon: ShieldCheck },
  { href: "/dashboard", label: "Fleet Desk", icon: BusFront, secondary: true }
] as const;
