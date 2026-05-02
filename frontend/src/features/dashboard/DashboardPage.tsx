"use client";

import { useCallback } from "react";
import {
  Banknote,
  BusFront,
  CircleAlert,
  ReceiptText,
  TrendingUp,
  UsersRound
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { api } from "@/services/api";
import { useApiResource } from "@/hooks/useApiResource";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/ui/StatCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { ChartCard } from "@/components/charts/ChartCard";
import { AlertPanel } from "@/components/dashboard/AlertPanel";
import { DataTable } from "@/components/ui/DataTable";
import { formatNumber, formatPeso, relativeMinutes } from "@/utils/format";

const emptyStats = {
  totalRevenue: 0,
  totalExpenses: 0,
  netProfit: 0,
  activeBuses: 0,
  totalPassengers: 0,
  cashTotal: 0,
  gcashTotal: 0,
  totalTransactions: 0,
  emergencyCount: 0,
  lastUpdated: ""
};

export function DashboardPage() {
  const loadStats = useCallback(() => api.stats(), []);
  const loadFleet = useCallback(() => api.fleet(), []);
  const loadReports = useCallback(() => api.revenueReport(), []);
  const loadTransactions = useCallback(() => api.transactions({ limit: 8 }), []);
  const stats = useApiResource(loadStats);
  const fleet = useApiResource(loadFleet);
  const reports = useApiResource(loadReports);
  const transactions = useApiResource(loadTransactions);

  const dashboardStats = stats.data || emptyStats;
  const buses = fleet.data || [];
  const revenueRoutes = reports.data || [];
  const recentTransactions = transactions.data || [];

  const paymentData = [
    { name: "Cash", value: dashboardStats.cashTotal },
    { name: "GCash", value: dashboardStats.gcashTotal }
  ];

  return (
    <AppShell title="Dashboard Overview" kicker="Live ticketing and dispatch control">
      <section className="stats-grid">
        {stats.isLoading ? (
          Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="stat-skeleton" />)
        ) : (
          <>
            <StatCard
              label="Total Revenue"
              value={formatPeso(dashboardStats.totalRevenue)}
              detail={`${formatPeso(dashboardStats.netProfit)} net after expenses`}
              tone="green"
              icon={Banknote}
            />
            <StatCard
              label="Active Buses"
              value={formatNumber(dashboardStats.activeBuses)}
              detail={`${formatNumber(buses.length)} units tracked`}
              tone="blue"
              icon={BusFront}
            />
            <StatCard
              label="Passengers"
              value={formatNumber(dashboardStats.totalPassengers)}
              detail="Regular, student, senior"
              tone="violet"
              icon={UsersRound}
            />
            <StatCard
              label="Transactions"
              value={formatNumber(dashboardStats.totalTransactions)}
              detail="Realtime ticket records"
              tone="amber"
              icon={ReceiptText}
            />
            <StatCard
              label="SOS Alerts"
              value={formatNumber(dashboardStats.emergencyCount)}
              detail="Emergency checks"
              tone={dashboardStats.emergencyCount ? "red" : "blue"}
              icon={CircleAlert}
            />
          </>
        )}
      </section>

      <section className="dashboard-grid">
        <ChartCard title="Revenue Trend" eyebrow={stats.source === "demo" ? "Demo preview" : "Firebase live"}>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={revenueRoutes.slice(0, 6)}>
              <defs>
                <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0f7ad3" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#0f7ad3" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="route" hide />
              <YAxis tickFormatter={(value) => `${Number(value) / 1000}k`} />
              <Tooltip formatter={(value) => formatPeso(Number(value))} />
              <Area type="monotone" dataKey="revenue" stroke="#0f7ad3" fill="url(#revenueFill)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <AlertPanel buses={buses} />

        <ChartCard title="Payment Split" eyebrow="Cash and GCash">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={paymentData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(value) => `${Number(value) / 1000}k`} />
              <Tooltip formatter={(value) => formatPeso(Number(value))} />
              <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#13a46b" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <section className="command-card wide">
          <div className="section-heading compact">
            <div>
              <span>Recent tickets</span>
              <h2>Transaction pulse</h2>
            </div>
            <TrendingUp size={20} />
          </div>
          <DataTable
            rows={recentTransactions}
            getRowKey={(row) => row.id}
            columns={[
              { header: "Bus", cell: (row) => <strong>{row.busNumber}</strong> },
              { header: "Route", cell: (row) => row.route },
              { header: "Type", cell: (row) => row.passengerType },
              { header: "Amount", cell: (row) => formatPeso(row.amount) },
              { header: "Time", cell: (row) => relativeMinutes(Number(row.time || 0)) }
            ]}
          />
        </section>
      </section>
    </AppShell>
  );
}
