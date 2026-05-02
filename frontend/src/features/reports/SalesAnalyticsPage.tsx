"use client";

import { useCallback } from "react";
import { Banknote, Coins, Landmark, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { api } from "@/services/api";
import { useApiResource } from "@/hooks/useApiResource";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/ui/StatCard";
import { ChartCard } from "@/components/charts/ChartCard";
import { DataTable } from "@/components/ui/DataTable";
import { formatNumber, formatPeso } from "@/utils/format";

export function SalesAnalyticsPage() {
  const loadStats = useCallback(() => api.stats(), []);
  const loadReport = useCallback(() => api.revenueReport(), []);
  const stats = useApiResource(loadStats);
  const report = useApiResource(loadReport);
  const dashboardStats = stats.data;
  const revenueRows = report.data || [];
  const paymentData = [
    { name: "Cash", value: dashboardStats?.cashTotal || 0, color: "#13a46b" },
    { name: "GCash", value: dashboardStats?.gcashTotal || 0, color: "#0f7ad3" }
  ];

  return (
    <AppShell title="Sales & Analytics" kicker="Fare revenue and route performance">
      <section className="stats-grid compact-grid">
        <StatCard label="Gross Revenue" value={formatPeso(dashboardStats?.totalRevenue || 0)} detail="All live buses" tone="green" icon={Banknote} />
        <StatCard label="Expenses" value={formatPeso(dashboardStats?.totalExpenses || 0)} detail="Fuel, repair, operation" tone="amber" icon={Coins} />
        <StatCard label="Net Profit" value={formatPeso(dashboardStats?.netProfit || 0)} detail="Revenue minus expenses" tone="blue" icon={TrendingUp} />
        <StatCard label="Tickets" value={formatNumber(dashboardStats?.totalTransactions || 0)} detail="Transaction log records" tone="violet" icon={Landmark} />
      </section>

      <section className="analytics-grid">
        <ChartCard title="Top Route Revenue" eyebrow={report.source === "demo" ? "Demo preview" : "Firebase live"}>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={revenueRows.slice(0, 8)}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="route" hide />
              <YAxis tickFormatter={(value) => `${Number(value) / 1000}k`} />
              <Tooltip formatter={(value) => formatPeso(Number(value))} />
              <Bar dataKey="revenue" fill="#0f7ad3" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Tender Mix" eyebrow="Cash vs GCash">
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie data={paymentData} dataKey="value" nameKey="name" innerRadius={78} outerRadius={112} paddingAngle={4}>
                {paymentData.map((item) => (
                  <Cell key={item.name} fill={item.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatPeso(Number(value))} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <section className="command-card wide">
          <div className="section-heading compact">
            <div>
              <span>Route ledger</span>
              <h2>Passenger and revenue ranking</h2>
            </div>
          </div>
          <DataTable
            rows={revenueRows}
            getRowKey={(row) => row.route}
            columns={[
              { header: "Route", cell: (row) => <strong>{row.route}</strong> },
              { header: "Passengers", cell: (row) => formatNumber(row.passengers) },
              { header: "Revenue", cell: (row) => formatPeso(row.revenue) }
            ]}
          />
        </section>
      </section>
    </AppShell>
  );
}
