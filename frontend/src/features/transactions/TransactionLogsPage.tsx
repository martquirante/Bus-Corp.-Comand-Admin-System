"use client";

import type { TransactionLog } from "@pos-bus/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, RotateCcw, ShieldCheck } from "lucide-react";
import { api } from "@/services/api";
import { useApiResource } from "@/hooks/useApiResource";
import { AppShell } from "@/components/layout/AppShell";
import { DataTable } from "@/components/ui/DataTable";
import { FilterBar } from "@/components/ui/FilterBar";
import { formatDateTime, formatPeso } from "@/utils/format";
import { getMainRouteLineIdFromText, normalizeRouteLabel } from "@/utils/routeLines";

type MainLineFilter = "" | "fvr-pitx" | "fvr-stcruz";
type SortMode = "newest" | "oldest" | "amount-desc" | "amount-asc" | "bus-asc" | "route-asc";

const mainLineOptions: Array<{ value: MainLineFilter; label: string }> = [
  { value: "", label: "All main line routes" },
  { value: "fvr-pitx", label: "FVR - PITX - FVR" },
  { value: "fvr-stcruz", label: "FVR - ST. CRUZ - FVR" }
];

const sortOptions: Array<{ value: SortMode; label: string }> = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "amount-desc", label: "Highest amount" },
  { value: "amount-asc", label: "Lowest amount" },
  { value: "bus-asc", label: "Bus number" },
  { value: "route-asc", label: "Route A-Z" }
];

const routeText = (row: TransactionLog) =>
  normalizeRouteLabel(row.route || `${row.origin || "N/A"} -> ${row.destination || "N/A"}`);

const mainLineForTransaction = (row: TransactionLog) =>
  getMainRouteLineIdFromText(row.lineId, row.route, row.origin, row.destination);

const timeValue = (value: TransactionLog["time"]) => {
  if (value === null || value === undefined || value === "") return 0;

  if (typeof value === "number" || Number.isFinite(Number(value))) {
    const numeric = Number(value);
    return numeric > 0 && numeric < 100000000000 ? numeric * 1000 : numeric;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const compareText = (left: string, right: string) =>
  left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });

export function TransactionLogsPage() {
  const [bus, setBus] = useState("");
  const [type, setType] = useState("");
  const [mainLine, setMainLine] = useState<MainLineFilter>("");
  const [route, setRoute] = useState("");
  const [sorting, setSorting] = useState<SortMode>("newest");
  const loadTransactions = useCallback(() => api.transactions({ limit: 500 }), []);
  const transactions = useApiResource(loadTransactions);
  const allRows = useMemo(() => transactions.data || [], [transactions.data]);
  const rows = useMemo(() => {
    const filteredRows = allRows.filter((row) => {
      if (bus && row.busNumber !== bus) return false;
      if (type && row.passengerType !== type) return false;
      if (mainLine && mainLineForTransaction(row) !== mainLine) return false;
      if (route && routeText(row) !== route) return false;
      return true;
    });

    return [...filteredRows].sort((left, right) => {
      if (sorting === "oldest") return timeValue(left.time) - timeValue(right.time);
      if (sorting === "amount-desc") return right.amount - left.amount;
      if (sorting === "amount-asc") return left.amount - right.amount;
      if (sorting === "bus-asc") return compareText(left.busNumber, right.busNumber);
      if (sorting === "route-asc") return compareText(routeText(left), routeText(right));

      return timeValue(right.time) - timeValue(left.time);
    });
  }, [allRows, bus, mainLine, route, sorting, type]);
  const busOptions = useMemo(
    () => Array.from(new Set(allRows.map((row) => row.busNumber).filter(Boolean))).sort(compareText),
    [allRows]
  );
  const typeOptions = useMemo(
    () => Array.from(new Set(allRows.map((row) => row.passengerType).filter(Boolean))).sort(compareText),
    [allRows]
  );
  const routeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          allRows
            .filter((row) => !mainLine || mainLineForTransaction(row) === mainLine)
            .map(routeText)
            .filter(Boolean)
        )
      ).sort(compareText),
    [allRows, mainLine]
  );
  const totalSales = rows.reduce((sum, row) => sum + row.amount, 0);

  useEffect(() => {
    if (route && !routeOptions.includes(route)) setRoute("");
  }, [route, routeOptions]);

  const exportCsv = () => {
    const header = ["Bus", "Main Line Route", "Route", "Type", "Passenger Count", "Payment", "Amount", "Time"];
    const body = rows.map((row) => [
      row.busNumber,
      mainLineOptions.find((option) => option.value === mainLineForTransaction(row))?.label || "Unlinked",
      routeText(row),
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
              {busOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            Passenger type
            <select value={type} onChange={(event) => setType(event.target.value)}>
              <option value="">All passenger types</option>
              {typeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            Main Line Route
            <select value={mainLine} onChange={(event) => setMainLine(event.target.value as MainLineFilter)}>
              {mainLineOptions.map((option) => (
                <option key={option.value || "all-main-lines"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Routes
            <select value={route} onChange={(event) => setRoute(event.target.value)}>
              <option value="">All routes</option>
              {routeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sorting
            <select value={sorting} onChange={(event) => setSorting(event.target.value as SortMode)}>
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </FilterBar>

        <DataTable
          rows={rows}
          getRowKey={(row) => row.id}
          columns={[
            { header: "Bus", cell: (row) => <strong>{row.busNumber}</strong> },
            { header: "Route", cell: (row) => routeText(row) },
            { header: "Type", cell: (row) => row.passengerType },
            { header: "Pax", cell: (row) => row.passengerCount },
            { header: "Payment", cell: (row) => row.paymentMethod.toUpperCase() },
            {
              header: "Amount",
              cell: (row) => (
                <span className="flex items-center gap-1">
                  {formatPeso(row.amount)}
                  <span title="Cryptographically secured on blockchain ledger" className="flex items-center">
                    <ShieldCheck size={14} className="text-emerald-500" />
                  </span>
                </span>
              )
            },
            { header: "Time", cell: (row) => formatDateTime(row.time) }
          ]}
        />
      </section>
    </AppShell>
  );
}
