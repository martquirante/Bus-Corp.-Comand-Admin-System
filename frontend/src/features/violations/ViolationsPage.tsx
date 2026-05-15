"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BusFleetRecord, EmployeeRecord, EmployeeViolationRecord, RouteConfig } from "@pos-bus/shared";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Edit3,
  FileText,
  Plus,
  Search,
  ShieldAlert,
  X
} from "lucide-react";
import { api } from "@/services/api";
import { useApiResource } from "@/hooks/useApiResource";
import { AppShell } from "@/components/layout/AppShell";
import { Portal } from "@/components/ui/Portal";
import {
  PENALTY_TYPES,
  VIOLATION_GROUPS,
  VIOLATION_PRESETS,
  VIOLATION_STATUSES,
  ViolationSeverity,
  ViolationStatus,
  allViolationTypes,
  calculatePenaltyEndDate,
  getViolationCategory,
  isActiveSuspension,
  isOpenViolation,
  normalizeViolationStatus
} from "./violationConfig";

type StatusFilter = "all" | ViolationStatus;
type SeverityFilter = "all" | ViolationSeverity;

type ViolationForm = {
  employeeId: string;
  employeeQuery: string;
  employeeName: string;
  employeeNumber: string;
  employeeRole: string;
  employeeEmail: string;
  employeePhone: string;
  busId: string;
  busNumber: string;
  routeId: string;
  routeName: string;
  allowAssignmentOverride: boolean;
  violationDate: string;
  incidentTime: string;
  violationType: string;
  severity: ViolationSeverity;
  description: string;
  evidenceNotes: string;
  reportedByName: string;
  penaltyType: string;
  penaltyDetails: string;
  suspensionDays: string;
  salaryDeductionAmount: string;
  deductionReason: string;
  penaltyStartDate: string;
  penaltyEndDate: string;
  status: ViolationStatus;
  resolutionNotes: string;
};

const EMPTY_VIOLATIONS: EmployeeViolationRecord[] = [];
const EMPTY_EMPLOYEES: EmployeeRecord[] = [];
const EMPTY_BUSES: BusFleetRecord[] = [];
const EMPTY_ROUTES: RouteConfig[] = [];

const today = () => new Date().toISOString().split("T")[0];

const emptyForm = (): ViolationForm => ({
  employeeId: "",
  employeeQuery: "",
  employeeName: "",
  employeeNumber: "",
  employeeRole: "",
  employeeEmail: "",
  employeePhone: "",
  busId: "",
  busNumber: "",
  routeId: "",
  routeName: "",
  allowAssignmentOverride: false,
  violationDate: today(),
  incidentTime: "",
  violationType: "",
  severity: "minor",
  description: "",
  evidenceNotes: "",
  reportedByName: "",
  penaltyType: "",
  penaltyDetails: "",
  suspensionDays: "0",
  salaryDeductionAmount: "0",
  deductionReason: "",
  penaltyStartDate: "",
  penaltyEndDate: "",
  status: "Active",
  resolutionNotes: ""
});

const titleCase = (value: string) =>
  String(value || "").replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const normalizeKey = (value?: string | number | null) => String(value ?? "").trim().toLowerCase();

const employeeLabel = (employee: EmployeeRecord) =>
  [employee.fullName, employee.employeeNumber ? `(${employee.employeeNumber})` : "", employee.role].filter(Boolean).join(" ");

const routeDisplayName = (route: RouteConfig) =>
  route.routeName || [route.origin, route.destination].filter(Boolean).join(" - ") || route.id;

const currency = (value?: number) =>
  Number(value || 0).toLocaleString("en-PH", { style: "currency", currency: "PHP" });

const isDeductionPenalty = (penaltyType?: string) =>
  penaltyType === "Salary Deduction" || penaltyType === "Cash Shortage Deduction";

const severityClass = (severity?: string) => {
  if (severity === "critical") return "severity-critical";
  if (severity === "major") return "severity-major";
  return "severity-minor";
};

const statusClass = (status?: string) => {
  const normalized = normalizeViolationStatus(status);
  if (normalized === "Resolved") return "status-online";
  if (normalized === "Dismissed") return "status-archived";
  if (normalized === "Escalated") return "status-offline";
  if (normalized === "Under Review") return "status-idle";
  return "status-offline";
};

const sortByLatest = (rows: EmployeeViolationRecord[]) =>
  [...rows].sort((a, b) => {
    const aKey = `${a.violationDate || ""}T${a.incidentTime || "00:00"}`;
    const bKey = `${b.violationDate || ""}T${b.incidentTime || "00:00"}`;
    return bKey.localeCompare(aKey);
  });

export function ViolationsPage() {
  const [prefillEmployeeId, setPrefillEmployeeId] = useState("");
  const [shouldAutoOpen, setShouldAutoOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setPrefillEmployeeId(params.get("employeeId") || "");
    setShouldAutoOpen(params.get("action") === "log");
  }, []);

  const loadViolations = useCallback(
    () => api.employeeViolations(prefillEmployeeId ? { employeeId: prefillEmployeeId } : undefined),
    [prefillEmployeeId]
  );
  const loadEmployees = useCallback(() => api.employees(), []);
  const loadBuses = useCallback(() => api.buses(), []);
  const loadRoutes = useCallback(() => api.routes(), []);

  const violations = useApiResource(loadViolations);
  const employees = useApiResource(loadEmployees);
  const buses = useApiResource(loadBuses);
  const routes = useApiResource(loadRoutes);

  const rows = violations.data || EMPTY_VIOLATIONS;
  const employeeRows = employees.data || EMPTY_EMPLOYEES;
  const busRows = buses.data || EMPTY_BUSES;
  const routeRows = routes.data || EMPTY_ROUTES;

  const [selected, setSelected] = useState<EmployeeViolationRecord | null>(null);
  const [editing, setEditing] = useState<EmployeeViolationRecord | null>(null);
  const [form, setForm] = useState<ViolationForm | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [employeeMenuOpen, setEmployeeMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const autoOpenKeyRef = useRef("");

  const selectedRecord = useMemo(() => {
    if (!selected) return rows[0] || null;
    return rows.find((violation) => violation.id === selected.id) || selected;
  }, [rows, selected]);

  const busByKey = useMemo(() => {
    const map = new Map<string, BusFleetRecord>();
    busRows.forEach((bus) => {
      [bus.id, bus.busNumber, bus.plateNumber].map(normalizeKey).filter(Boolean).forEach((key) => map.set(key, bus));
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

  const employeeMatches = useMemo(() => {
    const q = normalizeKey(form?.employeeQuery);
    if (!q) return employeeRows.slice(0, 8);
    return employeeRows
      .filter((employee) =>
        [
          employee.fullName,
          employee.employeeNumber,
          employee.role,
          employee.email,
          employee.phone
        ].some((value) => normalizeKey(value).includes(q))
      )
      .slice(0, 8);
  }, [employeeRows, form?.employeeQuery]);

  const filteredRows = useMemo(() => {
    const q = normalizeKey(search);
    return sortByLatest(rows).filter((record) => {
      const status = normalizeViolationStatus(record.status);
      const category = getViolationCategory(record.violationType);
      const text = [
        record.employeeName,
        record.employeeNumber,
        record.employeeRole || record.role,
        record.violationType,
        record.violationDate,
        record.busNumber,
        record.routeName,
        record.description
      ]
        .map(normalizeKey)
        .join(" ");

      const matchSearch = !q || text.includes(q);
      const matchStatus = statusFilter === "all" || status === statusFilter;
      const matchSeverity = severityFilter === "all" || record.severity === severityFilter;
      const matchCategory = categoryFilter === "all" || category === categoryFilter;
      const matchType = typeFilter === "all" || record.violationType === typeFilter;
      return matchSearch && matchStatus && matchSeverity && matchCategory && matchType;
    });
  }, [categoryFilter, rows, search, severityFilter, statusFilter, typeFilter]);

  const stats = useMemo(() => {
    const active = rows.filter(isOpenViolation);
    const critical = rows.filter((record) => record.severity === "critical");
    const suspended = rows.filter((record) => isActiveSuspension(record));
    return {
      total: rows.length,
      active: active.length,
      critical: critical.length,
      suspended: suspended.length
    };
  }, [rows]);

  const applyEmployeeToForm = useCallback((employee: EmployeeRecord, current: ViolationForm): ViolationForm => {
    const busKey = normalizeKey(employee.assignedBusId || employee.assignedBus);
    const routeKey = normalizeKey(employee.assignedRouteId || employee.assignedRoute);
    const bus = busKey ? busByKey.get(busKey) : undefined;
    const route = routeKey ? routeByKey.get(routeKey) : undefined;

    return {
      ...current,
      employeeId: employee.id,
      employeeQuery: employee.fullName || employee.employeeNumber || "",
      employeeName: employee.fullName || "",
      employeeNumber: employee.employeeNumber || "",
      employeeRole: employee.role || "",
      employeeEmail: employee.email || "",
      employeePhone: employee.phone || "",
      busId: bus?.id || "",
      busNumber: bus?.busNumber || employee.assignedBus || employee.assignedBusId || "",
      routeId: route?.id || "",
      routeName: route ? routeDisplayName(route) : employee.assignedRoute || employee.assignedRouteId || ""
    };
  }, [busByKey, routeByKey]);

  const applyViolationPreset = (type: string, current: ViolationForm): ViolationForm => {
    const preset = VIOLATION_PRESETS[type] || VIOLATION_PRESETS.Other;
    const startDate = preset.penaltyType === "Suspension" ? current.penaltyStartDate || today() : current.penaltyStartDate;
    const suspensionDays = String(preset.suspensionDays || 0);
    return {
      ...current,
      violationType: type,
      severity: preset.severity,
      description: preset.description,
      penaltyType: preset.penaltyType,
      penaltyDetails: preset.penaltyDetails,
      suspensionDays,
      salaryDeductionAmount: String(preset.salaryDeductionAmount || 0),
      penaltyStartDate: startDate,
      penaltyEndDate: preset.penaltyType === "Suspension" ? calculatePenaltyEndDate(startDate, Number(suspensionDays)) : current.penaltyEndDate
    };
  };

  const openCreate = useCallback((employee?: EmployeeRecord) => {
    setMessage(null);
    setEditing(null);
    const next = employee ? applyEmployeeToForm(employee, emptyForm()) : emptyForm();
    setForm(next);
    setEmployeeMenuOpen(false);
  }, [applyEmployeeToForm]);

  const violationToForm = (record: EmployeeViolationRecord): ViolationForm => {
    const base = emptyForm();
    return {
      ...base,
      employeeId: record.employeeId || "",
      employeeQuery: record.employeeName || record.employeeNumber || "",
      employeeName: record.employeeName || "",
      employeeNumber: record.employeeNumber || "",
      employeeRole: record.employeeRole || record.role || "",
      busId: record.busId || "",
      busNumber: record.busNumber || "",
      routeId: record.routeId || "",
      routeName: record.routeName || "",
      violationDate: record.violationDate || today(),
      incidentTime: record.incidentTime || "",
      violationType: record.violationType || "",
      severity: (record.severity === "major" || record.severity === "critical" ? record.severity : "minor") as ViolationSeverity,
      description: record.description || "",
      evidenceNotes: record.evidenceNotes || "",
      reportedByName: record.reportedByName || record.reportedById || "",
      penaltyType: record.penaltyType || record.penalty || "",
      penaltyDetails: record.penaltyDetails || "",
      suspensionDays: String(record.suspensionDays || 0),
      salaryDeductionAmount: String(record.salaryDeductionAmount || 0),
      deductionReason: record.deductionReason || "",
      penaltyStartDate: record.penaltyStartDate || "",
      penaltyEndDate: record.penaltyEndDate || "",
      status: normalizeViolationStatus(record.status),
      resolutionNotes: record.resolutionNotes || ""
    };
  };

  const openEdit = (record: EmployeeViolationRecord) => {
    setMessage(null);
    setEditing(record);
    setForm(violationToForm(record));
    setEmployeeMenuOpen(false);
  };

  const closeModal = () => {
    setEditing(null);
    setForm(null);
    setMessage(null);
    setEmployeeMenuOpen(false);
  };

  useEffect(() => {
    if (!shouldAutoOpen || !prefillEmployeeId || autoOpenKeyRef.current === prefillEmployeeId || form) return;
    const employee = employeeRows.find((row) => row.id === prefillEmployeeId);
    if (!employee) return;
    autoOpenKeyRef.current = prefillEmployeeId;
    openCreate(employee);
  }, [employeeRows, form, openCreate, prefillEmployeeId, shouldAutoOpen]);

  const setEmployeeQuery = (value: string) => {
    if (!form) return;
    setForm({
      ...form,
      employeeId: "",
      employeeQuery: value,
      employeeName: value,
      employeeNumber: "",
      employeeRole: "",
      employeeEmail: "",
      employeePhone: "",
      busId: "",
      busNumber: "",
      routeId: "",
      routeName: ""
    });
    setEmployeeMenuOpen(true);
  };

  const selectEmployee = (employee: EmployeeRecord) => {
    if (!form) return;
    setForm(applyEmployeeToForm(employee, form));
    setEmployeeMenuOpen(false);
  };

  const updatePenaltyType = (penaltyType: string) => {
    if (!form) return;
    const startDate = penaltyType === "Suspension" ? form.penaltyStartDate || today() : "";
    const suspensionDays = penaltyType === "Suspension" ? form.suspensionDays : "0";
    setForm({
      ...form,
      penaltyType,
      suspensionDays,
      penaltyStartDate: startDate,
      penaltyEndDate: penaltyType === "Suspension" ? calculatePenaltyEndDate(startDate, Number(suspensionDays || 0)) : "",
      salaryDeductionAmount: isDeductionPenalty(penaltyType) ? form.salaryDeductionAmount : "0",
      deductionReason: isDeductionPenalty(penaltyType) ? form.deductionReason : ""
    });
  };

  const updateSuspensionDays = (value: string) => {
    if (!form) return;
    setForm({
      ...form,
      suspensionDays: value,
      penaltyEndDate: calculatePenaltyEndDate(form.penaltyStartDate, Number(value || 0))
    });
  };

  const updatePenaltyStartDate = (value: string) => {
    if (!form) return;
    setForm({
      ...form,
      penaltyStartDate: value,
      penaltyEndDate: calculatePenaltyEndDate(value, Number(form.suspensionDays || 0))
    });
  };

  const validateForm = (current: ViolationForm) => {
    if (!current.employeeId) return "Please select a valid employee from the list.";
    if (!current.violationType) return "Violation type is required.";
    if (!current.violationDate) return "Incident date is required.";
    if (!current.severity) return "Severity is required.";
    if (!current.description.trim()) return "Incident description is required.";
    if (!current.penaltyType) return "Penalty type is required.";

    if (current.penaltyType === "Suspension") {
      const days = Number(current.suspensionDays || 0);
      if (!Number.isFinite(days) || days <= 0) return "Suspension days must be greater than 0.";
      if (!current.penaltyStartDate) return "Penalty start date is required for suspension.";
    }

    if (isDeductionPenalty(current.penaltyType)) {
      const amount = Number(current.salaryDeductionAmount || 0);
      if (!Number.isFinite(amount) || amount <= 0) return "Salary deduction amount must be greater than 0.";
    }

    return "";
  };

  const formToPayload = (current: ViolationForm): Partial<EmployeeViolationRecord> => ({
    employeeId: current.employeeId,
    employeeName: current.employeeName,
    employeeNumber: current.employeeNumber,
    employeeRole: current.employeeRole,
    role: current.employeeRole,
    busId: current.busId || undefined,
    busNumber: current.busNumber || undefined,
    routeId: current.routeId || undefined,
    routeName: current.routeName || undefined,
    violationDate: current.violationDate,
    incidentTime: current.incidentTime || undefined,
    violationType: current.violationType,
    severity: current.severity,
    description: current.description,
    evidenceNotes: current.evidenceNotes || undefined,
    reportedByName: current.reportedByName || undefined,
    penalty: current.penaltyType,
    penaltyType: current.penaltyType,
    penaltyDetails: current.penaltyDetails || undefined,
    suspensionDays: Number(current.suspensionDays || 0),
    salaryDeductionAmount: Number(current.salaryDeductionAmount || 0),
    deductionReason: current.deductionReason || undefined,
    penaltyStartDate: current.penaltyStartDate || undefined,
    penaltyEndDate: current.penaltyEndDate || undefined,
    status: current.status,
    resolutionNotes: current.resolutionNotes || undefined
  });

  const saveViolation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form) return;
    const validationError = validateForm(form);
    if (validationError) {
      setMessage(validationError);
      return;
    }

    setIsSaving(true);
    setMessage(null);
    try {
      const payload = formToPayload(form);
      const result = editing
        ? await api.patchViolation(editing.id, payload)
        : await api.createViolation(payload);
      setSelected(result.data);
      closeModal();
      await violations.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save violation record.");
    } finally {
      setIsSaving(false);
    }
  };

  const patchStatus = async (record: EmployeeViolationRecord, status: ViolationStatus) => {
    try {
      const result = await api.patchViolationStatus(record.id, { status });
      setSelected(result.data);
      await violations.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update violation status.");
    }
  };

  const selectedPreset = form?.violationType ? VIOLATION_PRESETS[form.violationType] || VIOLATION_PRESETS.Other : null;
  const isModalOpen = form !== null;

  return (
    <AppShell
      title="Employee Violations"
      kicker="Incident reports, disciplinary actions, penalties, and resolutions"
    >
      <div className="stats-grid compact-grid violation-stats">
        <div className="stat-card tone-blue">
          <FileText size={18} className="stat-icon" />
          <strong>{stats.total}</strong>
          <p>Total incidents</p>
        </div>
        <div className="stat-card tone-amber">
          <Clock size={18} className="stat-icon" />
          <strong>{stats.active}</strong>
          <p>Open actions</p>
        </div>
        <div className="stat-card tone-red">
          <ShieldAlert size={18} className="stat-icon" />
          <strong>{stats.critical}</strong>
          <p>Critical cases</p>
        </div>
        <div className="stat-card tone-violet">
          <AlertTriangle size={18} className="stat-icon" />
          <strong>{stats.suspended}</strong>
          <p>Active suspensions</p>
        </div>
      </div>

      <div className="violation-toolbar">
        <div className="violation-search-wrap">
          <Search size={15} className="violation-search-icon" />
          <input
            className="violation-search-input"
            placeholder="Search employee, type, route, date..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <label className="violation-filter-select">
          <span>Status</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
            <option value="all">All</option>
            {VIOLATION_STATUSES.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </label>

        <label className="violation-filter-select">
          <span>Severity</span>
          <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value as SeverityFilter)}>
            <option value="all">All</option>
            <option value="minor">Minor</option>
            <option value="major">Major</option>
            <option value="critical">Critical</option>
          </select>
        </label>

        <label className="violation-filter-select">
          <span>Category</span>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="all">All</option>
            {VIOLATION_GROUPS.map((group) => (
              <option key={group.category} value={group.category}>{group.category}</option>
            ))}
          </select>
        </label>

        <label className="violation-filter-select">
          <span>Type</span>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="all">All</option>
            {allViolationTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </label>

        <button type="button" className="primary-action violation-add-btn" onClick={() => openCreate()}>
          <Plus size={16} /> Log Incident
        </button>
      </div>

      {message && !isModalOpen ? (
        <div className={`fleet-global-msg ${message.toLowerCase().includes("success") ? "msg-success" : "msg-error"}`}>
          {message}
        </div>
      ) : null}

      <div className="violation-workspace">
        <section className="command-card violation-list-panel">
          <div className="section-heading compact">
            <div>
              <span>{filteredRows.length} records</span>
              <h2>Incident Log</h2>
            </div>
            <AlertTriangle size={20} />
          </div>

          {filteredRows.length === 0 ? (
            <div className="violation-empty">
              <AlertTriangle size={34} />
              <strong>No violation records found.</strong>
              <p>Use Log Incident to record disciplinary actions and operational incidents.</p>
            </div>
          ) : (
            <div className="violation-record-list">
              {filteredRows.map((record) => {
                const status = normalizeViolationStatus(record.status);
                return (
                  <button
                    key={record.id}
                    type="button"
                    className={`violation-record-card ${selectedRecord?.id === record.id ? "selected" : ""}`}
                    onClick={() => setSelected(record)}
                  >
                    <div>
                      <strong>{record.employeeName || "Unknown employee"}</strong>
                      <span>{record.employeeNumber || record.employeeId || "No employee ID"} - {record.employeeRole || record.role || "No role"}</span>
                      <small>{record.violationDate}{record.incidentTime ? ` ${record.incidentTime}` : ""} - {record.violationType}</small>
                    </div>
                    <div className="violation-record-card-meta">
                      <span className={`severity-pill ${severityClass(record.severity)}`}>{titleCase(record.severity || "minor")}</span>
                      <span className={`status-pill ${statusClass(status)}`}>{status}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="command-card violation-detail-panel">
          {!selectedRecord ? (
            <div className="violation-empty detail">
              <FileText size={42} />
              <strong>Select an incident</strong>
              <p>Complete incident and penalty details will appear here.</p>
            </div>
          ) : (
            <>
              <div className="violation-detail-header">
                <div>
                  <span>{getViolationCategory(selectedRecord.violationType)}</span>
                  <h2>{selectedRecord.violationType || "Incident"}</h2>
                  <p>{selectedRecord.employeeName || "Unknown employee"} - {selectedRecord.employeeNumber || "No employee ID"}</p>
                </div>
                <div className="violation-detail-badges">
                  <span className={`severity-pill ${severityClass(selectedRecord.severity)}`}>{titleCase(selectedRecord.severity || "minor")}</span>
                  <span className={`status-pill ${statusClass(selectedRecord.status)}`}>{normalizeViolationStatus(selectedRecord.status)}</span>
                </div>
              </div>

              <dl className="violation-detail-grid">
                <div><dt>Employee role</dt><dd>{selectedRecord.employeeRole || selectedRecord.role || "-"}</dd></div>
                <div><dt>Assigned bus</dt><dd>{selectedRecord.busNumber || "-"}</dd></div>
                <div><dt>Assigned route</dt><dd>{selectedRecord.routeName || "-"}</dd></div>
                <div><dt>Incident date/time</dt><dd>{selectedRecord.violationDate || "-"} {selectedRecord.incidentTime || ""}</dd></div>
                <div><dt>Reported by</dt><dd>{selectedRecord.reportedByName || selectedRecord.reportedById || "-"}</dd></div>
                <div><dt>Created at</dt><dd>{selectedRecord.createdAt ? new Date(selectedRecord.createdAt).toLocaleString() : "-"}</dd></div>
                <div><dt>Penalty type</dt><dd>{selectedRecord.penaltyType || selectedRecord.penalty || "-"}</dd></div>
                <div><dt>Suspension days</dt><dd>{selectedRecord.suspensionDays || 0}</dd></div>
                <div><dt>Deduction amount</dt><dd>{currency(selectedRecord.salaryDeductionAmount)}</dd></div>
                <div><dt>Penalty start</dt><dd>{selectedRecord.penaltyStartDate || "-"}</dd></div>
                <div><dt>Penalty end</dt><dd>{selectedRecord.penaltyEndDate || "-"}</dd></div>
                <div><dt>Last updated</dt><dd>{selectedRecord.updatedAt ? new Date(selectedRecord.updatedAt).toLocaleString() : "-"}</dd></div>
              </dl>

              <div className="violation-notes-block">
                <span>Incident description</span>
                <p>{selectedRecord.description || "-"}</p>
              </div>
              <div className="violation-notes-block">
                <span>Evidence / remarks</span>
                <p>{selectedRecord.evidenceNotes || "-"}</p>
              </div>
              <div className="violation-notes-block">
                <span>Penalty details</span>
                <p>{selectedRecord.penaltyDetails || "-"}</p>
              </div>
              <div className="violation-notes-block">
                <span>Deduction reason</span>
                <p>{selectedRecord.deductionReason || "-"}</p>
              </div>
              <div className="violation-notes-block">
                <span>Resolution notes</span>
                <p>{selectedRecord.resolutionNotes || "-"}</p>
              </div>

              <div className="violation-detail-actions">
                <button type="button" className="soft-button" onClick={() => patchStatus(selectedRecord, "Under Review")}>
                  <Clock size={14} /> Mark Under Review
                </button>
                <button type="button" className="soft-button" onClick={() => patchStatus(selectedRecord, "Resolved")}>
                  <CheckCircle2 size={14} /> Mark Resolved
                </button>
                <button type="button" className="soft-button" onClick={() => patchStatus(selectedRecord, "Dismissed")}>
                  <X size={14} /> Dismiss
                </button>
                <button type="button" className="soft-button danger-outline" onClick={() => patchStatus(selectedRecord, "Escalated")}>
                  <ShieldAlert size={14} /> Escalate
                </button>
                <button type="button" className="primary-action" onClick={() => openEdit(selectedRecord)}>
                  <Edit3 size={14} /> Edit Incident
                </button>
              </div>
            </>
          )}
        </section>
      </div>

      {isModalOpen && form ? (
        <Portal>
          <div className="modal-backdrop" role="presentation">
            <section
              className="command-card modal-panel bus-edit-modal violation-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="violation-modal-title"
            >
              <div className="section-heading compact">
                <div>
                  <span>Incident entry</span>
                  <h2 id="violation-modal-title">{editing ? "Edit Employee Violation" : "Log Employee Violation"}</h2>
                </div>
                <button type="button" className="icon-button" onClick={closeModal} aria-label="Close">
                  <X size={18} />
                </button>
              </div>

              {message ? <p className="form-error" style={{ marginBottom: 12 }}>{message}</p> : null}

              <form className="stacked-form violation-form" onSubmit={saveViolation}>
                <div className="violation-form-section">
                  <h3>Employee validation</h3>
                  <div className="form-row">
                    <label className="employee-combo-field">
                      Employee combobox *
                      <input
                        role="combobox"
                        aria-expanded={employeeMenuOpen}
                        aria-controls="employee-combo-options"
                        value={form.employeeQuery}
                        onFocus={() => setEmployeeMenuOpen(true)}
                        onChange={(event) => setEmployeeQuery(event.target.value)}
                        placeholder="Search by name, employee ID, role, or email"
                        autoComplete="off"
                      />
                      {employeeMenuOpen ? (
                        <div id="employee-combo-options" className="employee-combo-menu" role="listbox">
                          {employeeMatches.length ? employeeMatches.map((employee) => (
                            <button
                              key={employee.id}
                              type="button"
                              role="option"
                              aria-selected={form.employeeId === employee.id}
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => selectEmployee(employee)}
                            >
                              <strong>{employee.fullName || "Unnamed employee"}</strong>
                              <span>{employee.employeeNumber || "No ID"} - {titleCase(employee.role || "employee")}</span>
                              {employee.email ? <small>{employee.email}</small> : null}
                            </button>
                          )) : (
                            <div className="employee-combo-empty">No matching employees found.</div>
                          )}
                        </div>
                      ) : null}
                    </label>

                    <label>
                      Employee ID / employeeNumber
                      <input value={form.employeeNumber} readOnly placeholder="Auto-filled" />
                    </label>
                  </div>

                  <div className="form-row">
                    <label>
                      Employee database id
                      <input value={form.employeeId} readOnly placeholder="Auto-filled after selection" />
                    </label>
                    <label>
                      Role
                      <input value={titleCase(form.employeeRole)} readOnly placeholder="Auto-filled" />
                    </label>
                  </div>

                  <div className="form-row">
                    <label>
                      Assigned bus
                      <input
                        value={form.busNumber}
                        readOnly={!form.allowAssignmentOverride}
                        onChange={(event) => setForm({ ...form, busNumber: event.target.value, busId: "" })}
                        placeholder="Unassigned"
                      />
                    </label>
                    <label>
                      Assigned route
                      <input
                        value={form.routeName}
                        readOnly={!form.allowAssignmentOverride}
                        onChange={(event) => setForm({ ...form, routeName: event.target.value, routeId: "" })}
                        placeholder="Unassigned"
                      />
                    </label>
                  </div>

                  <label className="checkbox-row violation-override-row">
                    <input
                      type="checkbox"
                      checked={form.allowAssignmentOverride}
                      onChange={(event) => setForm({ ...form, allowAssignmentOverride: event.target.checked })}
                    />
                    Allow manual bus/route override
                  </label>

                  {form.employeeId ? (
                    <div className="selected-employee-preview">
                      <strong>{form.employeeName}</strong>
                      <span>{form.employeeNumber || "No employee ID"} - {titleCase(form.employeeRole)}</span>
                      <span>Bus: {form.busNumber || "Unassigned"} - Route: {form.routeName || "Unassigned"}</span>
                      {(form.employeeEmail || form.employeePhone) ? <small>{[form.employeeEmail, form.employeePhone].filter(Boolean).join(" - ")}</small> : null}
                    </div>
                  ) : null}
                </div>

                <div className="violation-form-section">
                  <h3>Incident details</h3>
                  <div className="form-row">
                    <label>
                      Incident date *
                      <input
                        type="date"
                        required
                        value={form.violationDate}
                        onChange={(event) => setForm({ ...form, violationDate: event.target.value })}
                      />
                    </label>
                    <label>
                      Incident time
                      <input
                        type="time"
                        value={form.incidentTime}
                        onChange={(event) => setForm({ ...form, incidentTime: event.target.value })}
                      />
                    </label>
                  </div>

                  <div className="form-row">
                    <label>
                      Violation type *
                      <select
                        required
                        value={form.violationType}
                        onChange={(event) => setForm(applyViolationPreset(event.target.value, form))}
                      >
                        <option value="">Select violation type</option>
                        {VIOLATION_GROUPS.map((group) => (
                          <optgroup key={group.category} label={group.category}>
                            {group.types.map((type) => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </label>
                    <label>
                      Severity *
                      <select
                        required
                        value={form.severity}
                        onChange={(event) => setForm({ ...form, severity: event.target.value as ViolationSeverity })}
                      >
                        <option value="minor">Minor</option>
                        <option value="major">Major</option>
                        <option value="critical">Critical</option>
                      </select>
                    </label>
                  </div>

                  {selectedPreset ? (
                    <div className="penalty-preview-box">
                      <span>Recommended action: {selectedPreset.penaltyType}{selectedPreset.suspensionDays ? `, ${selectedPreset.suspensionDays} days` : ""}</span>
                      <button type="button" className="soft-button table-action" onClick={() => setForm(applyViolationPreset(form.violationType, form))}>
                        Use suggested penalty
                      </button>
                    </div>
                  ) : null}

                  <div className="form-row" style={{ gridTemplateColumns: "1fr" }}>
                    <label>
                      Incident description *
                      <textarea
                        required
                        rows={4}
                        value={form.description}
                        onChange={(event) => setForm({ ...form, description: event.target.value })}
                        placeholder="Describe what happened, where, and who was involved."
                      />
                    </label>
                  </div>

                  <div className="form-row" style={{ gridTemplateColumns: "1fr" }}>
                    <label>
                      Evidence / remarks
                      <textarea
                        rows={2}
                        value={form.evidenceNotes}
                        onChange={(event) => setForm({ ...form, evidenceNotes: event.target.value })}
                        placeholder="Attach notes about reports, screenshots, witness statements, GPS/POS references, or supporting documents."
                      />
                    </label>
                  </div>
                </div>

                <div className="violation-form-section">
                  <h3>Penalty and status</h3>
                  <div className="form-row">
                    <label>
                      Reported by
                      <input
                        value={form.reportedByName}
                        onChange={(event) => setForm({ ...form, reportedByName: event.target.value })}
                        placeholder="Supervisor or admin name"
                      />
                    </label>
                    <label>
                      Status
                      <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ViolationStatus })}>
                        {VIOLATION_STATUSES.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="form-row">
                    <label>
                      Penalty type *
                      <select required value={form.penaltyType} onChange={(event) => updatePenaltyType(event.target.value)}>
                        <option value="">Select penalty</option>
                        {PENALTY_TYPES.map((penalty) => (
                          <option key={penalty} value={penalty}>{penalty}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Penalty details
                      <input
                        value={form.penaltyDetails}
                        onChange={(event) => setForm({ ...form, penaltyDetails: event.target.value })}
                        placeholder="Penalty notes"
                      />
                    </label>
                  </div>

                  {form.penaltyType === "Suspension" ? (
                    <div className="conditional-penalty-panel">
                      <div className="form-row">
                        <label>
                          Suspension days *
                          <input
                            type="number"
                            min="1"
                            value={form.suspensionDays}
                            onChange={(event) => updateSuspensionDays(event.target.value)}
                          />
                        </label>
                        <label>
                          Penalty start date *
                          <input
                            type="date"
                            value={form.penaltyStartDate}
                            onChange={(event) => updatePenaltyStartDate(event.target.value)}
                          />
                        </label>
                        <label>
                          Penalty end date
                          <input value={form.penaltyEndDate} readOnly placeholder="Auto-calculated" />
                        </label>
                      </div>
                      <p className="penalty-warning">Employee should not be assigned to active duty during suspension period.</p>
                    </div>
                  ) : null}

                  {isDeductionPenalty(form.penaltyType) ? (
                    <div className="conditional-penalty-panel">
                      <div className="form-row">
                        <label>
                          Deduction amount *
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.salaryDeductionAmount}
                            onChange={(event) => setForm({ ...form, salaryDeductionAmount: event.target.value })}
                            placeholder="0.00"
                          />
                        </label>
                        <label>
                          Deduction reason
                          <input
                            value={form.deductionReason}
                            onChange={(event) => setForm({ ...form, deductionReason: event.target.value })}
                            placeholder="Shortage, damage, device loss, etc."
                          />
                        </label>
                      </div>
                      <p className="field-hint">Deduction is recorded only in this violation after admin saves.</p>
                    </div>
                  ) : null}

                  <div className="form-row" style={{ gridTemplateColumns: "1fr" }}>
                    <label>
                      Resolution notes
                      <textarea
                        rows={2}
                        value={form.resolutionNotes}
                        onChange={(event) => setForm({ ...form, resolutionNotes: event.target.value })}
                        placeholder="Final action, review result, or dismissal reason."
                      />
                    </label>
                  </div>
                </div>

                <div className="inline-actions">
                  <button type="button" className="soft-button" onClick={closeModal}>Cancel</button>
                  <button type="submit" className="primary-action" disabled={isSaving}>
                    {isSaving ? "Saving..." : editing ? "Save Incident" : "Log Incident"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        </Portal>
      ) : null}
    </AppShell>
  );
}
