"use client";

import { useCallback } from "react";
import Image from "next/image";
import {
  Banknote,
  BusFront,
  CircleAlert,
  Clock3,
  LifeBuoy,
  MessageSquareText,
  ReceiptText,
  RefreshCw,
  Route as RouteIcon,
  TrendingUp,
  UsersRound
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { api } from "@/services/api";
import { useLiveApiResource } from "@/hooks/useLiveApiResource";
import { useRealtimeDashboard } from "@/hooks/useRealtimeDashboard";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/ui/StatCard";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Skeleton } from "@/components/ui/Skeleton";
import { ChartCard } from "@/components/charts/ChartCard";
import { CommandChartTooltip } from "@/components/charts/CommandChartTooltip";
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
  const summary = useRealtimeDashboard();
  const stats = useLiveApiResource(loadStats, { intervalMs: 7000 });
  const fleet = useLiveApiResource(loadFleet, { intervalMs: 5000 });
  const reports = useLiveApiResource(loadReports, { intervalMs: 9000 });
  const transactions = useLiveApiResource(loadTransactions, { intervalMs: 5000 });

  const dashboardSummary = summary.data;
  const dashboardStats = dashboardSummary?.stats || stats.data || emptyStats;
  const buses = dashboardSummary?.deviceHealth || fleet.data || [];
  const revenueRoutes = reports.data || [];
  const recentTransactions = transactions.data || [];
  const recentMessages = dashboardSummary?.recentMessages || [];
  const recentAssistance = dashboardSummary?.recentAssistanceRequests || [];

  const paymentData = [
    { name: "Cash", value: dashboardStats.cashTotal, color: "#13a46b", icon: "cash" },
    { name: "GCash", value: dashboardStats.gcashTotal, color: "#0f7ad3", icon: "gcash" }
  ];

  return (
    <AppShell title="Dashboard Overview" kicker="Live ticketing and dispatch control">
      {summary.error ? (
        <section className="command-card inline-error">
          <CircleAlert size={18} />
          <span>{summary.error}</span>
          <button type="button" className="soft-button compact-button" onClick={summary.refresh}>
            <RefreshCw size={14} /> Retry
          </button>
        </section>
      ) : null}

      <section className="stats-grid">
        {summary.isLoading && stats.isLoading ? (
          Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="stat-skeleton" />)
        ) : (
          <>
            <StatCard
              label="Total Revenue"
              value={<AnimatedNumber value={dashboardStats.totalRevenue} formatter={formatPeso} />}
              detail={`${formatPeso(dashboardStats.netProfit)} net after Supabase expenses`}
              tone="green"
              icon={Banknote}
            />
            <StatCard
              label="Active Buses"
              value={<AnimatedNumber value={dashboardStats.activeBuses} formatter={formatNumber} />}
              detail={`${formatNumber(buses.length)} units tracked`}
              tone="blue"
              icon={BusFront}
            />
            <StatCard
              label="POS Devices"
              value={<AnimatedNumber value={dashboardSummary?.totalPosDevices || buses.length} formatter={formatNumber} />}
              detail={`${formatNumber(dashboardSummary?.onlinePosDevices || 0)} online / ${formatNumber(dashboardSummary?.offlinePosDevices || 0)} offline`}
              tone="blue"
              icon={Clock3}
            />
            <StatCard
              label="Passengers"
              value={<AnimatedNumber value={dashboardStats.totalPassengers} formatter={formatNumber} />}
              detail="Regular, student, senior"
              tone="violet"
              icon={UsersRound}
            />
            <StatCard
              label="Transactions"
              value={<AnimatedNumber value={dashboardStats.totalTransactions} formatter={formatNumber} />}
              detail="Realtime ticket records"
              tone="amber"
              icon={ReceiptText}
            />
            <StatCard
              label="SOS Alerts"
              value={<AnimatedNumber value={dashboardStats.emergencyCount} formatter={formatNumber} />}
              detail="Emergency checks"
              tone={dashboardStats.emergencyCount ? "red" : "blue"}
              icon={CircleAlert}
            />
            <StatCard
              label="Assistance"
              value={<AnimatedNumber value={dashboardSummary?.assistanceRequestCount || 0} formatter={formatNumber} />}
              detail={`${formatNumber(dashboardSummary?.pendingAssistanceRequestCount || 0)} pending requests`}
              tone={(dashboardSummary?.pendingAssistanceRequestCount || 0) ? "red" : "green"}
              icon={LifeBuoy}
            />
            <StatCard
              label="Messages"
              value={<AnimatedNumber value={dashboardSummary?.totalMessages || 0} formatter={formatNumber} />}
              detail={`${formatNumber(dashboardSummary?.notificationSummary.unread || 0)} unread alerts`}
              tone="violet"
              icon={MessageSquareText}
            />
            <StatCard
              label="Routes"
              value={<AnimatedNumber value={dashboardSummary?.routeCount || revenueRoutes.length} formatter={formatNumber} />}
              detail={dashboardSummary?.liveRouteMapStatus.message || "Route preview ready"}
              tone="amber"
              icon={RouteIcon}
            />
          </>
        )}
      </section>

      <section className="command-card data-source-card">
        <div>
          <span>{summary.source === "demo" ? "Demo fallback" : "Firebase Realtime Database"}</span>
          <strong>
            Last updated {dashboardSummary?.lastUpdated ? new Date(dashboardSummary.lastUpdated).toLocaleTimeString("en-PH") : "after login"}
            {summary.isRefreshing ? " syncing..." : ""}
          </strong>
          <small>
            Firebase: {dashboardSummary?.databaseStatus?.firebase || summary.source} / Supabase:{" "}
            {dashboardSummary?.databaseStatus?.supabase || "checking"}
          </small>
        </div>
        <button type="button" className="soft-button compact-button" onClick={summary.refresh}>
          <RefreshCw size={14} /> Refresh
        </button>
      </section>

      <section className="dashboard-grid">
        <ChartCard title="Revenue Trend" eyebrow="Supabase SQL official records">
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
              <Tooltip content={<CommandChartTooltip />} cursor={false} />
              <Area type="monotone" dataKey="revenue" stroke="#0f7ad3" fill="url(#revenueFill)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <AlertPanel buses={buses} />

        <ChartCard title="Payment Split" eyebrow="Official Supabase payments">
          <div className="payment-legend">
            {paymentData.map((item) => (
              <span key={item.name}>
                {item.icon === "gcash" ? (
                  <Image src="/assets/logos/gcash-logo.png" width={54} height={18} alt="" />
                ) : (
                  <Banknote size={17} />
                )}
                {item.name}
              </span>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={paymentData} barCategoryGap="28%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(value) => `${Number(value) / 1000}k`} />
              <Tooltip content={<CommandChartTooltip />} cursor={false} />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {paymentData.map((item) => (
                  <Cell key={item.name} fill={item.color} />
                ))}
              </Bar>
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

        <section className="command-card">
          <div className="section-heading compact">
            <div>
              <span>Messages</span>
              <h2>Dispatch notes</h2>
            </div>
            <MessageSquareText size={20} />
          </div>
          <div className="stack-list">
            {recentMessages.length ? (
              recentMessages.slice(0, 5).map((message) => (
                <article key={message.id} className="stack-list-item">
                  <strong>{message.title}</strong>
                  <p>{message.body}</p>
                  <span>{message.sender || "Command center"}</span>
                </article>
              ))
            ) : (
              <p className="empty-note">No messages in the legacy path yet.</p>
            )}
          </div>
        </section>

        <section className="command-card">
          <div className="section-heading compact">
            <div>
              <span>Assistance</span>
              <h2>Request queue</h2>
            </div>
            <LifeBuoy size={20} />
          </div>
          <div className="stack-list">
            {recentAssistance.length ? (
              recentAssistance.slice(0, 5).map((request) => (
                <article key={request.id} className="stack-list-item">
                  <strong>{request.busNumber || request.requester}</strong>
                  <p>{request.reason}</p>
                  <span>{request.status}</span>
                </article>
              ))
            ) : (
              <p className="empty-note">No assistance requests in Firebase yet.</p>
            )}
          </div>
        </section>
      </section>
    </AppShell>
  );
}
