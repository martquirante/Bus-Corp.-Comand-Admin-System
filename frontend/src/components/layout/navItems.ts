import {
  BarChart3,
  BusFront,
  IdCard,
  LayoutDashboard,
  MapPinned,
  ReceiptText,
  Route,
  ShieldCheck,
  UsersRound,
  PhilippinePeso,
  AlertTriangle,
  Fingerprint
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
  { href: "/bus-fleet", label: "Bus Fleet Management", icon: BusFront },
  { href: "/remittances", label: "Remittances", icon: PhilippinePeso },
  { href: "/employees", label: "Employees", icon: IdCard },
  { href: "/violations", label: "Violations", icon: AlertTriangle },
  { href: "/blockchain-security", label: "Security Ledger", icon: Fingerprint },
  { href: "/admin-tools", label: "Admin Tools", icon: ShieldCheck },
  { href: "/dashboard", label: "Fleet Desk", icon: UsersRound, secondary: true }
] as const;
