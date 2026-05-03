"use client";

import type { CSSProperties, FormEvent } from "react";
import { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import { Banknote, CalendarDays, Coins, Download, Landmark, TrendingUp } from "lucide-react";
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
import { useLiveApiResource } from "@/hooks/useLiveApiResource";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/ui/StatCard";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { ChartCard } from "@/components/charts/ChartCard";
import { CommandChartTooltip } from "@/components/charts/CommandChartTooltip";
import { DataTable } from "@/components/ui/DataTable";
import { formatNumber, formatPeso } from "@/utils/format";

const periods = ["Daily", "Weekly", "Monthly", "Yearly"] as const;

export function SalesAnalyticsPage() {
  const [period, setPeriod] = useState<(typeof periods)[number]>("Daily");
  const [expenseForm, setExpenseForm] = useState({ type: "fuel", amount: "", bus: "", remarks: "" });
  const [expenseMessage, setExpenseMessage] = useState<string | null>(null);
  const loadStats = useCallback(() => api.stats(), []);
  const loadReport = useCallback(() => api.revenueReport(), []);
  const loadTransactions = useCallback(() => api.transactions({ limit: 500 }), []);
  const stats = useLiveApiResource(loadStats, { intervalMs: 7000 });
  const report = useLiveApiResource(loadReport, { intervalMs: 9000 });
  const transactions = useLiveApiResource(loadTransactions, { intervalMs: 12000 });
  const dashboardStats = stats.data;
  const revenueRows = useMemo(() => report.data || [], [report.data]);
  const paymentData = [
    { name: "Cash", value: dashboardStats?.cashTotal || 0, color: "#13a46b" },
    { name: "GCash", value: dashboardStats?.gcashTotal || 0, color: "#0f7ad3" }
  ];
  const busiestRoute = useMemo(
    () =>
      revenueRows.reduce<(typeof revenueRows)[number] | undefined>(
        (top, row) => (row.passengers > (top?.passengers || 0) ? row : top),
        undefined
      ),
    [revenueRows]
  );
  const passengerDemand = useMemo(() => {
    const formatter = new Intl.DateTimeFormat("en-PH", { weekday: "short" });
    const demand = new Map<string, number>();
    (transactions.data || []).forEach((transaction) => {
      const date = transaction.time ? new Date(transaction.time) : null;
      if (!date) {
        demand.set("Unknown", (demand.get("Unknown") || 0) + transaction.passengerCount);
        return;
      }
      const day = Number.isNaN(date.getTime()) ? "Unknown" : formatter.format(date);
      demand.set(day, (demand.get(day) || 0) + transaction.passengerCount);
    });
    const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Unknown"];
    return order
      .filter((day) => demand.has(day))
      .map((day) => ({ day, passengers: demand.get(day) || 0 }));
  }, [transactions.data]);
  const peakDay = passengerDemand.reduce((top, day) => (day.passengers > top.passengers ? day : top), {
    day: "Waiting",
    passengers: 0
  });

  const exportCsv = () => {
    const rows = [
      ["POS BUS Passenger and Revenue Ranking"],
      [`Generated,${new Date().toLocaleString("en-PH")}`],
      ["Route", "Passengers", "Revenue"],
      ...revenueRows.map((row) => [row.route, row.passengers, row.revenue])
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "pos-bus-passenger-revenue-ranking.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPrintPdf = () => {
    const printable = window.open("", "_blank", "width=960,height=720");
    if (!printable) return;
    printable.document.write(`
      <html>
        <head>
          <title>POS BUS Passenger and Revenue Ranking</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 32px; color: #142033; }
            header { display:flex; align-items:center; gap:14px; border-bottom: 4px solid #0f7ad3; padding-bottom: 14px; }
            img { width: 54px; height: 54px; object-fit: contain; }
            h1 { margin: 0; font-size: 22px; }
            p { color: #66758a; }
            table { width:100%; border-collapse: collapse; margin-top: 22px; }
            th { background:#0f7ad3; color:#fff; text-align:left; padding:10px; }
            td { border-bottom:1px solid #d7e1ec; padding:10px; }
            tfoot td { font-weight:700; }
          </style>
        </head>
        <body>
          <header>
            <img src="${window.location.origin}/assets/logos/pos-bus-logo.png" />
            <div><h1>Passenger and Revenue Ranking</h1><p>Generated ${new Date().toLocaleString("en-PH")} • ${period}</p></div>
          </header>
          <table>
            <thead><tr><th>Route</th><th>Passengers</th><th>Revenue</th></tr></thead>
            <tbody>${revenueRows.map((row) => `<tr><td>${row.route}</td><td>${row.passengers}</td><td>${formatPeso(row.revenue)}</td></tr>`).join("")}</tbody>
          </table>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printable.document.close();
  };

  const submitExpense = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setExpenseMessage(null);
    try {
      await api.createExpense({
        type: expenseForm.type,
        amount: Number(expenseForm.amount),
        bus: expenseForm.bus,
        remarks: expenseForm.remarks,
        source: "admin-web"
      });
      setExpenseForm({ type: "fuel", amount: "", bus: "", remarks: "" });
      setExpenseMessage("Expense saved to Firebase.");
      await stats.refresh();
    } catch (error) {
      setExpenseMessage(error instanceof Error ? error.message : "Could not save expense.");
    }
  };

  return (
    <AppShell title="Sales & Analytics" kicker="Fare revenue and route performance">
      <section className="stats-grid compact-grid">
        <StatCard label="Gross Revenue" value={<AnimatedNumber value={dashboardStats?.totalRevenue || 0} formatter={formatPeso} />} detail="All live buses" tone="green" icon={Banknote} />
        <StatCard label="Expenses" value={<AnimatedNumber value={dashboardStats?.totalExpenses || 0} formatter={formatPeso} />} detail="Fuel, repair, operation" tone="amber" icon={Coins} />
        <StatCard label="Net Profit" value={<AnimatedNumber value={dashboardStats?.netProfit || 0} formatter={formatPeso} />} detail="Revenue minus expenses" tone="blue" icon={TrendingUp} />
        <StatCard label="Tickets" value={<AnimatedNumber value={dashboardStats?.totalTransactions || 0} formatter={formatNumber} />} detail="Transaction log records" tone="violet" icon={Landmark} />
      </section>

      <section className="command-card analytics-toolbar">
        <div>
          <span>Report window</span>
          <strong>{period} live view</strong>
        </div>
        <div className="period-tabs" aria-label="Sales period">
          {periods.map((item) => (
            <button
              key={item}
              type="button"
              className={item === period ? "active" : ""}
              onClick={() => setPeriod(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="busy-day-card">
          <span>Passenger demand signal</span>
          <strong>{peakDay.passengers ? `${peakDay.day} peak` : busiestRoute?.route || "Waiting for Firebase data"}</strong>
          <small>{formatNumber(peakDay.passengers || busiestRoute?.passengers || 0)} passengers in current dataset</small>
        </div>
      </section>

      <section className="analytics-grid">
        <ChartCard title="Top Route Revenue" eyebrow={report.source === "demo" ? "Demo preview" : "Firebase live"}>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={revenueRows.slice(0, 8)}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="route" hide />
              <YAxis tickFormatter={(value) => `${Number(value) / 1000}k`} />
              <Tooltip content={<CommandChartTooltip />} cursor={false} />
              <Bar dataKey="revenue" fill="#0f7ad3" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Tender Mix" eyebrow="Cash vs GCash">
          <div className="payment-legend">
            <span>
              <Banknote size={17} /> Cash
            </span>
            <span>
              <Image src="/assets/logos/gcash-logo.png" width={54} height={18} alt="" /> GCash
            </span>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie data={paymentData} dataKey="value" nameKey="name" innerRadius={78} outerRadius={112} paddingAngle={4}>
                {paymentData.map((item) => (
                  <Cell key={item.name} fill={item.color} />
                ))}
              </Pie>
              <Tooltip content={<CommandChartTooltip />} cursor={false} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <section className="command-card wide">
          <div className="section-heading compact">
            <div>
              <span>Route ledger</span>
              <h2>Passenger and revenue ranking</h2>
            </div>
            <div className="inline-actions">
              <button type="button" className="soft-button compact-button" onClick={exportCsv}>
                <Download size={14} /> Excel CSV
              </button>
              <button type="button" className="soft-button compact-button" onClick={exportPrintPdf}>
                <Download size={14} /> PDF print
              </button>
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

        <section className="command-card wide">
          <div className="section-heading compact">
            <div>
              <span>Passenger calendar</span>
              <h2>Peak day heatmap</h2>
            </div>
            <CalendarDays size={20} />
          </div>
          <div className="demand-heatmap">
            {passengerDemand.length ? (
              passengerDemand.map((item) => (
                <article key={item.day} style={{ "--heat": Math.min(item.passengers / Math.max(peakDay.passengers, 1), 1) } as CSSProperties}>
                  <strong>{item.day}</strong>
                  <span>{formatNumber(item.passengers)} pax</span>
                </article>
              ))
            ) : (
              <p className="empty-note">No dated ticket records available yet.</p>
            )}
          </div>
        </section>

        <section className="command-card wide">
          <div className="section-heading compact">
            <div>
              <span>Company operations</span>
              <h2>Add manual expense</h2>
            </div>
          </div>
          <form className="expense-inline-form" onSubmit={submitExpense}>
            <label>
              Type
              <select value={expenseForm.type} onChange={(event) => setExpenseForm((value) => ({ ...value, type: event.target.value }))}>
                <option value="fuel">Fuel</option>
                <option value="repairs">Repairs</option>
                <option value="maintenance">Maintenance</option>
                <option value="salary">Salary/Payroll</option>
                <option value="terminal-fees">Terminal fees</option>
                <option value="permit-registration">Permit/registration</option>
                <option value="cleaning">Cleaning</option>
                <option value="toll-parking">Toll/parking</option>
                <option value="misc">Miscellaneous</option>
              </select>
            </label>
            <label>
              Amount
              <input required type="number" min="0" step="0.01" value={expenseForm.amount} onChange={(event) => setExpenseForm((value) => ({ ...value, amount: event.target.value }))} />
            </label>
            <label>
              Bus/Unit
              <input value={expenseForm.bus} onChange={(event) => setExpenseForm((value) => ({ ...value, bus: event.target.value }))} placeholder="Optional" />
            </label>
            <label>
              Remarks
              <input value={expenseForm.remarks} onChange={(event) => setExpenseForm((value) => ({ ...value, remarks: event.target.value }))} placeholder="Receipt note" />
            </label>
            <button type="submit" className="primary-action small">Save expense</button>
          </form>
          {expenseMessage ? <p className="quiet-copy">{expenseMessage}</p> : null}
        </section>
      </section>
    </AppShell>
  );
}
