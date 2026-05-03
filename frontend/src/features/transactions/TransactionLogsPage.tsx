"use client";

import { useCallback, useMemo, useState } from "react";
import { Download, RotateCcw } from "lucide-react";
import { api } from "@/services/api";
import { useApiResource } from "@/hooks/useApiResource";
import { AppShell } from "@/components/layout/AppShell";
import { DataTable } from "@/components/ui/DataTable";
import { FilterBar } from "@/components/ui/FilterBar";
import { formatDateTime, formatPeso } from "@/utils/format";

export function TransactionLogsPage() {
  const [bus, setBus] = useState("");
  const [type, setType] = useState("");
  const [route, setRoute] = useState("");
  const loadTransactions = useCallback(() => api.transactions({ limit: 500 }), []);
  const transactions = useApiResource(loadTransactions);
  const allRows = useMemo(() => transactions.data || [], [transactions.data]);
  const rows = useMemo(
    () =>
      allRows.filter((row) => {
        if (bus && row.busNumber !== bus) return false;
        if (type && row.passengerType !== type) return false;
        if (route && row.route !== route) return false;
        return true;
      }),
    [allRows, bus, route, type]
  );
  const busOptions = useMemo(() => Array.from(new Set(allRows.map((row) => row.busNumber))).filter(Boolean), [allRows]);
  const typeOptions = useMemo(() => Array.from(new Set(allRows.map((row) => row.passengerType))).filter(Boolean), [allRows]);
  const routeOptions = useMemo(() => Array.from(new Set(allRows.map((row) => row.route))).filter(Boolean), [allRows]);
  const totalSales = rows.reduce((sum, row) => sum + row.amount, 0);

  const exportCsv = () => {
    const header = ["Bus", "Route", "Type", "Passenger Count", "Payment", "Amount", "Time"];
    const body = rows.map((row) => [
      row.busNumber,
      row.route,
      row.passengerType,
      row.passengerCount,
      row.paymentMethod,
      row.amount,
      formatDateTime(row.time)
    ]);
    const csv = [header, ...body]
      .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "pos-bus-transactions.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell title="Transaction Logs" kicker="Ticket ledger and receipt search">
      <section className="command-card">
        <div className="section-heading compact">
          <div>
            <span>{formatPeso(totalSales)} total shown</span>
            <h2>Ticket transactions</h2>
          </div>
          <div className="inline-actions">
            <button type="button" className="soft-button" onClick={() => transactions.refresh()}>
              <RotateCcw size={16} /> Refresh
            </button>
            <button type="button" className="primary-action small" onClick={exportCsv}>
              <Download size={16} /> Export CSV
            </button>
          </div>
        </div>

        <FilterBar>
          <label>
            Bus
            <select value={bus} onChange={(event) => setBus(event.target.value)}>
              <option value="">All buses</option>
              {busOptions.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          <label>
            Passenger type
            <select value={type} onChange={(event) => setType(event.target.value)}>
              <option value="">All passenger types</option>
              {typeOptions.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          <label>
            Route
            <select value={route} onChange={(event) => setRoute(event.target.value)}>
              <option value="">All routes</option>
              {routeOptions.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          <button
            type="button"
            className="soft-button"
            onClick={() => {
              setBus("");
              setType("");
              setRoute("");
            }}
          >
            Clear filters
          </button>
        </FilterBar>

        <DataTable
          rows={rows}
          getRowKey={(row) => row.id}
          columns={[
            { header: "Bus", cell: (row) => <strong>{row.busNumber}</strong> },
            { header: "Route", cell: (row) => row.route },
            { header: "Type", cell: (row) => row.passengerType },
            { header: "Pax", cell: (row) => row.passengerCount },
            { header: "Payment", cell: (row) => row.paymentMethod.toUpperCase() },
            { header: "Amount", cell: (row) => formatPeso(row.amount) },
            { header: "Time", cell: (row) => formatDateTime(row.time) }
          ]}
        />
      </section>
    </AppShell>
  );
}
