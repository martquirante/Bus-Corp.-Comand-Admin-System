"use client";

import { FormEvent, useCallback, useMemo, useState } from "react";
import type { BusFleetRecord, EmployeeRecord, RemittanceRecord, RouteConfig } from "@pos-bus/shared";
import {
  AlertCircle, CheckCircle2, Clock, PhilippinePeso, Plus,
  Search, TrendingDown, X
} from "lucide-react";
import { api } from "@/services/api";
import { useApiResource } from "@/hooks/useApiResource";
import { AppShell } from "@/components/layout/AppShell";
import { Portal } from "@/components/ui/Portal";

// ─── Constants ────────────────────────────────────────────────────────────────

type RStatus = RemittanceRecord["status"];
type StatusFilter = "all" | RStatus;

const STATUS_DISPLAY: Record<RStatus, { label: string; cls: string }> = {
  Pending:  { label: "Pending",  cls: "status-pending"  },
  Cleared:  { label: "Cleared",  cls: "status-active"   },
  Short:    { label: "Short",    cls: "status-maintenance" },
  Over:     { label: "Over",     cls: "status-on-route"  }
};

const emptyForm = {
  conductorId: "",
  conductorName: "",
  busId: "",
  busNumber: "",
  routeId: "",
  routeName: "",
  shiftDate: new Date().toISOString().split("T")[0],
  expectedAmount: "",
  remittedAmount: "",
  ticketCount: "",
  notes: ""
};

type RemittanceForm = typeof emptyForm;

const fmt = (n: number) =>
  n.toLocaleString("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 });

const EMPTY_ROWS: RemittanceRecord[] = [];
const EMPTY_EMPLOYEES: EmployeeRecord[] = [];
const EMPTY_BUSES: BusFleetRecord[] = [];
const EMPTY_ROUTES: RouteConfig[] = [];

const normalizeKey = (value?: string | number | null) => String(value ?? "").trim().toLowerCase();

const keysForBus = (bus: BusFleetRecord) =>
  [bus.id, bus.busNumber, bus.plateNumber].map(normalizeKey).filter(Boolean);

const employeeDisplayName = (employee: EmployeeRecord) =>
  employee.fullName || employee.employeeNumber || employee.id;

const routeDisplayName = (route: RouteConfig) =>
  route.routeName || [route.origin, route.destination].filter(Boolean).join(" - ") || route.id || "";

// ─── Main Component ───────────────────────────────────────────────────────────

export function RemittancesPage() {
  const loadRemittances = useCallback(() => api.remittances(), []);
  const loadEmployees = useCallback(() => api.employees(), []);
  const loadBuses = useCallback(() => api.buses(), []);
  const loadRoutes = useCallback(() => api.routes(), []);
  const remittances = useApiResource(loadRemittances);
  const employees = useApiResource(loadEmployees);
  const buses = useApiResource(loadBuses);
  const routes = useApiResource(loadRoutes);
  const rows = remittances.data || EMPTY_ROWS;
  const employeeRows = employees.data || EMPTY_EMPLOYEES;
  const busRows = buses.data || EMPTY_BUSES;
  const routeRows = routes.data || EMPTY_ROUTES;

  const [selected, setSelected] = useState<RemittanceRecord | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<RemittanceForm | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const selectedRecord = useMemo(() => {
    if (!selected) return rows[0] || null;
    return rows.find((r) => r.id === selected.id) || selected;
  }, [rows, selected]);

  const conductorOptions = useMemo(
    () =>
      employeeRows
        .filter((employee) => employee.role === "conductor")
        .sort((a, b) => {
          if (a.status !== b.status) return a.status === "active" ? -1 : 1;
          return employeeDisplayName(a).localeCompare(employeeDisplayName(b));
        }),
    [employeeRows]
  );

  const busByKey = useMemo(() => {
    const map = new Map<string, BusFleetRecord>();
    busRows.forEach((bus) => {
      keysForBus(bus).forEach((key) => map.set(key, bus));
    });
    return map;
  }, [busRows]);

  const routeByKey = useMemo(() => {
    const map = new Map<string, RouteConfig>();
    routeRows.forEach((route) => {
      [route.id, route.routeName, route.origin, route.destination, route.lineId, route.routeGroup]
        .map(normalizeKey)
        .filter(Boolean)
        .forEach((key) => map.set(key, route));
    });
    return map;
  }, [routeRows]);

  // ── Summary stats (today) ──
  const today = new Date().toISOString().split("T")[0];
  const todayRows = rows.filter((r) => r.shiftDate === today);
  const stats = useMemo(() => ({
    totalExpected: todayRows.reduce((sum, r) => sum + r.expectedAmount, 0),
    totalRemitted: todayRows.reduce((sum, r) => sum + r.remittedAmount, 0),
    pending: rows.filter((r) => r.status === "Pending").length,
    shortages: rows.filter((r) => r.status === "Short").length
  }), [rows, todayRows]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        (r.conductorName || "").toLowerCase().includes(q) ||
        (r.busNumber || "").toLowerCase().includes(q) ||
        (r.routeName || "").toLowerCase().includes(q) ||
        r.shiftDate.includes(q);
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [rows, search, statusFilter]);

  const setConductorFromEmployee = (employeeId: string) => {
    if (!form) return;
    const conductor = conductorOptions.find((employee) => employee.id === employeeId);
    if (!conductor) {
      setForm({ ...form, conductorId: "", conductorName: "" });
      return;
    }

    const assignedBusKey = normalizeKey(conductor.assignedBusId || conductor.assignedBus);
    const assignedRouteKey = normalizeKey(conductor.assignedRouteId || conductor.assignedRoute);
    const assignedBus = assignedBusKey ? busByKey.get(assignedBusKey) : undefined;
    const assignedRoute = assignedRouteKey ? routeByKey.get(assignedRouteKey) : undefined;

    setForm({
      ...form,
      conductorId: conductor.id,
      conductorName: employeeDisplayName(conductor),
      busId: assignedBus?.id || form.busId,
      busNumber: assignedBus?.busNumber || conductor.assignedBus || form.busNumber,
      routeId: assignedRoute?.id || conductor.assignedRouteId || form.routeId,
      routeName: assignedRoute ? routeDisplayName(assignedRoute) : conductor.assignedRoute || form.routeName
    });
  };

  const setBusFromSelection = (busId: string) => {
    if (!form) return;
    const bus = busRows.find((item) => item.id === busId);
    setForm({
      ...form,
      busId: bus?.id || "",
      busNumber: bus?.busNumber || ""
    });
  };

  const setRouteFromSelection = (routeId: string) => {
    if (!form) return;
    const route = routeRows.find((item) => item.id === routeId);
    setForm({
      ...form,
      routeId: route?.id || "",
      routeName: route ? routeDisplayName(route) : ""
    });
  };

  const openCreate = () => {
    setMessage(null);
    setIsCreating(true);
    setForm({ ...emptyForm });
  };

  const closeModal = () => {
    setIsCreating(false);
    setForm(null);
    setMessage(null);
  };

  const saveCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form) return;
    setIsSaving(true);
    setMessage(null);
    const expected = Number(form.expectedAmount || 0);
    const remitted = Number(form.remittedAmount || 0);
    const shortageAmount = Math.max(expected - remitted, 0);
    const overageAmount = Math.max(remitted - expected, 0);
    let status: RStatus = "Pending";
    if (remitted > 0) {
      if (remitted < expected) status = "Short";
      else if (remitted > expected) status = "Over";
      else status = "Cleared";
    }

    try {
      const result = await api.createRemittance({
        conductorId: form.conductorId || undefined,
        conductorName: form.conductorName || undefined,
        busId: form.busId || undefined,
        busNumber: form.busNumber || undefined,
        routeId: form.routeId || undefined,
        routeName: form.routeName || undefined,
        shiftDate: form.shiftDate,
        expectedAmount: expected,
        remittedAmount: remitted,
        shortageAmount,
        overageAmount,
        ticketCount: form.ticketCount ? Number(form.ticketCount) : undefined,
        notes: form.notes || undefined,
        status
      });
      setSelected(result.data);
      closeModal();
      await remittances.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not create remittance record.");
    } finally {
      setIsSaving(false);
    }
  };

  const markReceived = async (record: RemittanceRecord) => {
    try {
      const result = await api.receiveRemittance(record.id);
      setSelected(result.data);
      await remittances.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not mark as received.");
    }
  };

  const markShort = async (record: RemittanceRecord) => {
    try {
      const result = await api.patchRemittance(record.id, { status: "Short" });
      setSelected(result.data);
      await remittances.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not mark as short.");
    }
  };

  const markRejected = async (record: RemittanceRecord) => {
    try {
      const result = await api.rejectRemittance(record.id);
      setSelected(result.data);
      await remittances.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not reject remittance.");
    }
  };

  return (
    <AppShell
      title="Conductor Remittances"
      kicker="Daily cash turn-over monitoring and office validation"
    >
      {/* ── Summary Stats ── */}
      <div className="stats-grid compact-grid rem-stats">
        <div className="stat-card tone-blue">
          <PhilippinePeso size={18} className="stat-icon" />
          <strong>{fmt(stats.totalExpected)}</strong>
          <p>Expected Today</p>
        </div>
        <div className="stat-card tone-green">
          <PhilippinePeso size={18} className="stat-icon" />
          <strong>{fmt(stats.totalRemitted)}</strong>
          <p>Remitted Today</p>
        </div>
        <div className="stat-card tone-amber">
          <Clock size={18} className="stat-icon" />
          <strong>{stats.pending}</strong>
          <p>Pending</p>
        </div>
        <div className="stat-card tone-red">
          <TrendingDown size={18} className="stat-icon" />
          <strong>{stats.shortages}</strong>
          <p>Shortages</p>
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="fleet-controls-bar">
        <div className="fleet-search-wrap">
          <Search size={15} className="fleet-search-icon" />
          <input
            className="fleet-search-input"
            placeholder="Search conductor, bus, route, date…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="fleet-filter-group">
          <span className="fleet-filter-label">Status</span>
          {(["all", "Pending", "Cleared", "Short", "Over"] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={`fleet-chip ${statusFilter === s ? "active" : ""}`}
              onClick={() => setStatusFilter(s)}
            >
              {s === "all" ? "All" : s}
            </button>
          ))}
        </div>
        <button type="button" className="primary-action fleet-add-btn" onClick={openCreate}>
          <Plus size={16} /> Add Remittance
        </button>
      </div>

      {message && !isCreating && (
        <div className={`fleet-global-msg ${message.includes("success") ? "msg-success" : "msg-error"}`}>
          {message}
        </div>
      )}

      {/* ── Main workspace ── */}
      <div className="fleet-workspace">
        {/* List panel */}
        <section className="command-card fleet-list-panel">
          <div className="section-heading compact">
            <div>
              <span>{filteredRows.length} records</span>
              <h2>Remittance Log</h2>
            </div>
            <PhilippinePeso size={20} />
          </div>

          {filteredRows.length === 0 ? (
            <div className="fleet-empty">
              <PhilippinePeso size={32} />
              <p>No remittance records found.</p>
            </div>
          ) : (
            <div className="fleet-bus-list">
              {filteredRows.map((r) => {
                const diff = r.remittedAmount - r.expectedAmount;
                const s = STATUS_DISPLAY[r.status];
                return (
                  <button
                    key={r.id}
                    type="button"
                    className={`fleet-bus-card rem-card ${selectedRecord?.id === r.id ? "selected" : ""}`}
                    onClick={() => setSelected(r)}
                  >
                    <div className="rem-card-left">
                      <strong className="fleet-bus-number">{r.conductorName || "Conductor"}</strong>
                      <span className="fleet-bus-card-meta">
                        {r.shiftDate} · {r.busNumber || "No bus"} · {r.routeName || "No route"}
                      </span>
                    </div>
                    <div className="rem-card-right">
                      <span className={`fleet-status-badge ${s.cls}`}>{s.label}</span>
                      <span className={`rem-diff ${diff < 0 ? "rem-short" : diff > 0 ? "rem-over" : "rem-exact"}`}>
                        {diff >= 0 ? `+${fmt(diff)}` : fmt(diff)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Detail panel */}
        <section className="command-card fleet-detail-panel">
          {!selectedRecord ? (
            <div className="fleet-detail-empty">
              <PhilippinePeso size={48} />
              <p>Select a remittance record to view details.</p>
            </div>
          ) : (
            <>
              <div className="fleet-detail-header">
                <div>
                  <h2 className="fleet-detail-bus-number">{selectedRecord.conductorName || "Conductor"}</h2>
                  <span className="fleet-detail-plate">{selectedRecord.shiftDate}</span>
                </div>
                <span className={`fleet-status-badge large ${STATUS_DISPLAY[selectedRecord.status].cls}`}>
                  {STATUS_DISPLAY[selectedRecord.status].label}
                </span>
              </div>

              <div className="fleet-detail-specs">
                <div className="fleet-spec-item">
                  <span className="fleet-spec-label">Bus</span>
                  <span className="fleet-spec-value">{selectedRecord.busNumber || "—"}</span>
                </div>
                <div className="fleet-spec-item">
                  <span className="fleet-spec-label">Route</span>
                  <span className="fleet-spec-value">{selectedRecord.routeName || "—"}</span>
                </div>
                <div className="fleet-spec-item rem-amount-item">
                  <span className="fleet-spec-label">Expected Amount</span>
                  <span className="fleet-spec-value rem-expected">{fmt(selectedRecord.expectedAmount)}</span>
                </div>
                <div className="fleet-spec-item rem-amount-item">
                  <span className="fleet-spec-label">Remitted Amount</span>
                  <span className="fleet-spec-value rem-remitted">{fmt(selectedRecord.remittedAmount)}</span>
                </div>
                <div className="fleet-spec-item rem-amount-item">
                  <span className="fleet-spec-label">Shortage</span>
                  <span className={`fleet-spec-value ${(selectedRecord.shortageAmount || 0) > 0 ? "rem-short" : ""}`}>
                    {fmt(selectedRecord.shortageAmount || 0)}
                  </span>
                </div>
                <div className="fleet-spec-item rem-amount-item">
                  <span className="fleet-spec-label">Overage</span>
                  <span className={`fleet-spec-value ${(selectedRecord.overageAmount || 0) > 0 ? "rem-over" : ""}`}>
                    {fmt(selectedRecord.overageAmount || 0)}
                  </span>
                </div>
                <div className="fleet-spec-item">
                  <span className="fleet-spec-label">Ticket Count</span>
                  <span className="fleet-spec-value">{selectedRecord.ticketCount ?? "—"}</span>
                </div>
                <div className="fleet-spec-item">
                  <span className="fleet-spec-label">Received By</span>
                  <span className="fleet-spec-value">{selectedRecord.receivedByName || selectedRecord.cashierId || "—"}</span>
                </div>
                {selectedRecord.receivedAt && (
                  <div className="fleet-spec-item">
                    <span className="fleet-spec-label">Received At</span>
                    <span className="fleet-spec-value">{new Date(selectedRecord.receivedAt).toLocaleString()}</span>
                  </div>
                )}
              </div>

              {selectedRecord.notes && (
                <div className="fleet-detail-notes">
                  <span className="fleet-spec-label">Notes</span>
                  <p>{selectedRecord.notes}</p>
                </div>
              )}

              <div className="fleet-detail-actions">
                {selectedRecord.status === "Pending" || selectedRecord.status === "Short" ? (
                  <button
                    type="button"
                    className="primary-action"
                    onClick={() => markReceived(selectedRecord)}
                  >
                    <CheckCircle2 size={14} /> Mark Received
                  </button>
                ) : null}
                {selectedRecord.status !== "Short" && selectedRecord.status !== "Cleared" ? (
                  <button
                    type="button"
                    className="soft-button"
                    onClick={() => markShort(selectedRecord)}
                  >
                    <TrendingDown size={14} /> Mark Short
                  </button>
                ) : null}
                {selectedRecord.status !== "Pending" ? (
                  <button
                    type="button"
                    className="soft-button"
                    onClick={() => markRejected(selectedRecord)}
                  >
                    <AlertCircle size={14} /> Reject
                  </button>
                ) : null}
              </div>
            </>
          )}
        </section>
      </div>

      {/* ── Add Remittance Modal ── */}
      {isCreating && form && (
        <Portal>
        <div className="modal-backdrop" role="presentation">
          <section
            className="command-card modal-panel bus-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rem-modal-title"
          >
            <div className="section-heading compact">
              <div>
                <span>Remittance entry</span>
                <h2 id="rem-modal-title">Add Remittance Record</h2>
              </div>
              <button type="button" className="icon-button" onClick={closeModal} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            {message && <p className="form-error" style={{ marginBottom: 12 }}>{message}</p>}

            <form className="stacked-form" onSubmit={saveCreate}>
              <div className="form-row">
                <label>
                  Shift Date *
                  <input
                    type="date"
                    required
                    value={form.shiftDate}
                    onChange={(e) => setForm({ ...form, shiftDate: e.target.value })}
                  />
                </label>
                <label>
                  Conductor
                  <select
                    value={form.conductorId}
                    onChange={(e) => setConductorFromEmployee(e.target.value)}
                  >
                    <option value="">Select conductor</option>
                    {conductorOptions.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employeeDisplayName(employee)}
                        {employee.employeeNumber ? ` (${employee.employeeNumber})` : ""}
                        {employee.status !== "active" ? ` - ${employee.status}` : ""}
                      </option>
                    ))}
                  </select>
                  <small className="field-hint">From Employees. Assigned bus and route auto-fill when available.</small>
                </label>
              </div>
              <div className="form-row">
                <label>
                  Bus Number
                  <select
                    value={form.busId}
                    onChange={(e) => setBusFromSelection(e.target.value)}
                  >
                    <option value="">Select bus</option>
                    {busRows.map((bus) => (
                      <option key={bus.id} value={bus.id}>
                        {bus.busNumber}{bus.plateNumber ? ` - ${bus.plateNumber}` : ""}
                      </option>
                    ))}
                  </select>
                  <small className="field-hint">{form.busNumber ? `Selected: ${form.busNumber}` : "Choose a bus or select an assigned conductor."}</small>
                </label>
                <label>
                  Route
                  <select
                    value={form.routeId}
                    onChange={(e) => setRouteFromSelection(e.target.value)}
                  >
                    <option value="">Select route</option>
                    {routeRows.map((route) => (
                      <option key={route.id} value={route.id}>
                        {routeDisplayName(route)}
                      </option>
                    ))}
                  </select>
                  <small className="field-hint">{form.routeName ? `Selected: ${form.routeName}` : "Choose a route or select an assigned conductor."}</small>
                </label>
              </div>
              <div className="form-row">
                <label>
                  Expected Amount (PHP) *
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={form.expectedAmount}
                    onChange={(e) => setForm({ ...form, expectedAmount: e.target.value })}
                    placeholder="0.00"
                  />
                </label>
                <label>
                  Remitted Amount (PHP) *
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={form.remittedAmount}
                    onChange={(e) => setForm({ ...form, remittedAmount: e.target.value })}
                    placeholder="0.00"
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Ticket Count
                  <input
                    type="number"
                    min="0"
                    value={form.ticketCount}
                    onChange={(e) => setForm({ ...form, ticketCount: e.target.value })}
                    placeholder="0"
                  />
                </label>
              </div>

              {form.expectedAmount && form.remittedAmount && (
                <div className="rem-preview">
                  {(() => {
                    const exp = Number(form.expectedAmount);
                    const rem = Number(form.remittedAmount);
                    const diff = rem - exp;
                    return (
                      <span className={diff < 0 ? "rem-short" : diff > 0 ? "rem-over" : "rem-exact"}>
                        {diff < 0 ? `Shortage: ${fmt(Math.abs(diff))}` : diff > 0 ? `Overage: ${fmt(diff)}` : "✓ Exact match"}
                      </span>
                    );
                  })()}
                </div>
              )}

              <div className="form-row" style={{ gridTemplateColumns: "1fr" }}>
                <label>
                  Notes / Remarks
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={2}
                    placeholder="Any notes about this remittance…"
                  />
                </label>
              </div>

              <div className="inline-actions">
                <button type="button" className="soft-button" onClick={closeModal}>Cancel</button>
                <button type="submit" className="primary-action" disabled={isSaving}>
                  {isSaving ? "Saving…" : "Save Remittance"}
                </button>
              </div>
            </form>
          </section>
        </div>
        </Portal>
      )}
    </AppShell>
  );
}
