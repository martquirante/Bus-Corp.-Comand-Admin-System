"use client";

import { ChangeEvent, FormEvent, useCallback, useMemo, useRef, useState } from "react";
import type { BusFleetRecord, EmployeeRecord, FleetBus } from "@pos-bus/shared";
import {
  BusFront, Camera, Edit3, Fuel, MapPin, Plus, Search,
  Settings, Shield, Wrench, X, Navigation
} from "lucide-react";
import { api } from "@/services/api";
import { useApiResource } from "@/hooks/useApiResource";
import { useLiveApiResource } from "@/hooks/useLiveApiResource";
import { AppShell } from "@/components/layout/AppShell";
import { Portal } from "@/components/ui/Portal";

// ─── Constants ────────────────────────────────────────────────────────────────

type BusStatus = BusFleetRecord["status"];
type FuelFilter = "all" | "diesel" | "hybrid" | "electric";
type StatusFilter = "all" | BusStatus;

const FUEL_TYPES = ["diesel", "hybrid", "electric"] as const;
const STATUS_OPTIONS: BusStatus[] = ["active", "available", "on-route", "maintenance", "inactive", "offline"];
const BUS_NUMBER_PREFIX = "19";
const BUS_NUMBER_LENGTH = 6;

const emptyForm = {
  busNumber: "",
  plateNumber: "",
  busType: "aircon",
  fuelType: "diesel",
  seatingCapacity: "45",
  status: "active" as BusStatus,
  assignedRouteId: "",
  assignedDriverId: "",
  assignedDriverName: "",
  assignedConductorId: "",
  assignedConductorName: "",
  registrationNumber: "",
  permitInfo: "",
  insuranceInfo: "",
  lastMaintenance: "",
  nextMaintenance: "",
  notes: ""
};

type BusForm = typeof emptyForm;

const busToForm = (bus: BusFleetRecord): BusForm => ({
  busNumber: bus.busNumber || "",
  plateNumber: bus.plateNumber || "",
  busType: bus.busType || "aircon",
  fuelType: (bus.fuelType || "diesel").toLowerCase(),
  seatingCapacity: String(bus.seatingCapacity ?? 45),
  status: bus.status || "active",
  assignedRouteId: bus.assignedRouteId || "",
  assignedDriverId: bus.assignedDriverId || "",
  assignedDriverName: bus.assignedDriverName || "",
  assignedConductorId: bus.assignedConductorId || "",
  assignedConductorName: bus.assignedConductorName || "",
  registrationNumber: bus.registrationNumber || bus.registrationNotes || "",
  permitInfo: bus.permitInfo || "",
  insuranceInfo: bus.insuranceInfo || "",
  lastMaintenance: bus.lastMaintenance ? bus.lastMaintenance.split("T")[0] : "",
  nextMaintenance: bus.nextMaintenance ? bus.nextMaintenance.split("T")[0] : "",
  notes: bus.notes || ""
});

const formToPayload = (form: BusForm): Partial<BusFleetRecord> => ({
  busNumber: form.busNumber,
  plateNumber: form.plateNumber,
  busType: form.busType,
  fuelType: titleCase(form.fuelType),
  seatingCapacity: Number(form.seatingCapacity || 0),
  status: form.status,
  assignedRouteId: form.assignedRouteId || undefined,
  assignedDriverId: form.assignedDriverId || undefined,
  assignedDriverName: form.assignedDriverName || undefined,
  assignedConductorId: form.assignedConductorId || undefined,
  assignedConductorName: form.assignedConductorName || undefined,
  registrationNumber: form.registrationNumber || undefined,
  registrationNotes: form.registrationNumber || undefined,
  permitInfo: form.permitInfo || undefined,
  insuranceInfo: form.insuranceInfo || undefined,
  lastMaintenance: form.lastMaintenance || undefined,
  nextMaintenance: form.nextMaintenance || undefined,
  notes: form.notes || undefined
});

const fuelColor = (type?: string) => {
  const t = (type || "").toLowerCase();
  if (t === "electric") return "tone-green";
  if (t === "hybrid") return "tone-blue";
  return "tone-amber";
};

const statusColor = (status: BusStatus) => {
  if (status === "active" || status === "available") return "status-active";
  if (status === "on-route") return "status-on-route";
  if (status === "maintenance") return "status-maintenance";
  return "status-inactive";
};

const titleCase = (value: string) =>
  value.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const EMPTY_ROWS: BusFleetRecord[] = [];

const normalizeBusNumberDigits = (value?: string | number | null) =>
  String(value ?? "").replace(/\D/g, "");

const suggestNextBusNumber = (rows: BusFleetRecord[]) => {
  const existing = rows
    .map((bus) => normalizeBusNumberDigits(bus.busNumber))
    .filter((value) => value.length === BUS_NUMBER_LENGTH && value.startsWith(BUS_NUMBER_PREFIX))
    .map((value) => Number(value));

  const next = existing.length ? Math.max(...existing) + 1 : Number(`${BUS_NUMBER_PREFIX}0001`);
  return String(Math.min(next, Number(`${BUS_NUMBER_PREFIX}9999`))).padStart(BUS_NUMBER_LENGTH, "0");
};

type FleetBusWithTelemetry = FleetBus & {
  odometer?: number;
  odometerKm?: number;
  distanceKm?: number;
  totalDistanceKm?: number;
  tripDistanceKm?: number;
  distanceTraveledKm?: number;
  distanceTravelledKm?: number;
  mileageKm?: number;
  kmRun?: number;
  kilometersRun?: number;
};

type BusAssignment = {
  driverId?: string;
  driverName?: string;
  driverRouteId?: string;
  conductorId?: string;
  conductorName?: string;
  conductorRouteId?: string;
};

const normalizeKey = (value?: string | number | null) => String(value ?? "").trim().toLowerCase();

const uniqueKeys = (...values: Array<string | number | null | undefined>) =>
  Array.from(new Set(values.map(normalizeKey).filter(Boolean)));

const busKeys = (bus?: Pick<BusFleetRecord, "id" | "busNumber" | "plateNumber"> | null) =>
  bus ? uniqueKeys(bus.id, bus.busNumber, bus.plateNumber) : [];

const employeeBusKeys = (employee: EmployeeRecord) =>
  uniqueKeys(employee.assignedBusId, employee.assignedBus);

const employeeRoute = (employee: EmployeeRecord) =>
  employee.assignedRouteId || employee.assignedRoute || "";

const employeeDisplayName = (employee: EmployeeRecord) =>
  employee.fullName || employee.employeeNumber || employee.id;

const liveTelemetryKm = (live?: FleetBusWithTelemetry | null) => {
  const candidates = [
    live?.odometerKm,
    live?.odometer,
    live?.totalDistanceKm,
    live?.distanceTraveledKm,
    live?.distanceTravelledKm,
    live?.tripDistanceKm,
    live?.distanceKm,
    live?.mileageKm,
    live?.kmRun,
    live?.kilometersRun
  ];

  return candidates.find((value) => typeof value === "number" && Number.isFinite(value));
};

const mergeBusRecord = (
  row: BusFleetRecord | null | undefined,
  selected: BusFleetRecord | null | undefined
) => {
  if (!row) return selected || null;
  if (!selected || row.id !== selected.id) return row;

  return {
    ...row,
    photoUrl: selected.photoUrl || row.photoUrl,
    photoPath: selected.photoPath || row.photoPath
  };
};

// ─── Subcomponents ────────────────────────────────────────────────────────────

function DocumentUploadInput({
  label,
  value,
  onChange,
  docType,
  busId,
  disabled
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  docType: string;
  busId?: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !busId) return;
    setUploading(true);
    try {
      const res = await api.uploadBusDocument(busId, docType, file);
      onChange(res.data.docUrl);
    } catch (err) {
      alert("Upload failed. " + (err instanceof Error ? err.message : ""));
    } finally {
      setUploading(false);
    }
  };

  const isUrl = value.startsWith("http");

  return (
    <label>
      {label}
      <div style={{ display: "flex", gap: 8 }}>
        {isUrl ? (
          <a href={value} target="_blank" rel="noreferrer" style={{ flex: 1, padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 6, color: "var(--primary)", textDecoration: "underline", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            View Document
          </a>
        ) : (
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{ flex: 1 }}
            placeholder={isUrl ? "URL" : "e.g. ABC-1234 or Upload"}
          />
        )}
        <input type="file" ref={inputRef} style={{ display: "none" }} accept=".pdf,image/*" onChange={handleUpload} />
        <button
          type="button"
          className="soft-button"
          disabled={uploading || disabled || !busId}
          onClick={() => inputRef.current?.click()}
          style={{ whiteSpace: "nowrap" }}
          title={!busId ? "Save bus first to upload" : "Upload document"}
        >
          {uploading ? "..." : "Upload"}
        </button>
        {isUrl && (
          <button type="button" className="soft-button" onClick={() => onChange("")} title="Clear">
            <X size={14} />
          </button>
        )}
      </div>
    </label>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BusFleetPage() {
  const loadBuses = useCallback(() => api.buses(), []);
  const loadEmployees = useCallback(() => api.employees(), []);
  const loadRoutes = useCallback(() => api.routes(), []);
  const loadFleet = useCallback(() => api.fleet(), []);
  const buses = useApiResource(loadBuses);
  const employees = useApiResource(loadEmployees);
  const routes = useApiResource(loadRoutes);
  const fleet = useLiveApiResource(loadFleet, { intervalMs: 4000 });
  const rows = buses.data || EMPTY_ROWS;
  const liveRows = useMemo(() => (fleet.data || []) as FleetBusWithTelemetry[], [fleet.data]);

  const employeeMap = useMemo(() => {
    const map = new Map<string, string>();
    (employees.data || []).forEach(emp => {
      map.set(emp.id, emp.fullName);
      if (emp.employeeNumber) map.set(emp.employeeNumber, emp.fullName);
    });
    return map;
  }, [employees.data]);

  const routeMap = useMemo(() => {
    const map = new Map<string, string>();
    (routes.data || []).forEach(r => {
      if (r.id && r.routeName) map.set(r.id, r.routeName);
      if (r.routeName) map.set(r.routeName, r.routeName);
    });
    return map;
  }, [routes.data]);

  const getEmpName = useCallback(
    (id?: string, name?: string) => name && name !== id ? name : (id ? employeeMap.get(id) || id : ""),
    [employeeMap]
  );
  const getRouteName = useCallback((id?: string) => id ? routeMap.get(id) || id : "", [routeMap]);

  const liveBusMap = useMemo(() => {
    const map = new Map<string, FleetBusWithTelemetry>();
    liveRows.forEach((bus) => {
      uniqueKeys(bus.id, bus.busNumber).forEach((key) => map.set(key, bus));
    });
    return map;
  }, [liveRows]);

  const assignmentMap = useMemo(() => {
    const aliases = new Map<string, string[]>();
    rows.forEach((bus) => {
      const keys = busKeys(bus);
      keys.forEach((key) => aliases.set(key, keys));
    });

    const map = new Map<string, BusAssignment>();
    const orderedEmployees = [...(employees.data || [])].sort((a, b) => {
      if (a.status === b.status) return 0;
      if (a.status === "active") return -1;
      if (b.status === "active") return 1;
      return 0;
    });

    orderedEmployees.forEach((employee) => {
      if (employee.role !== "driver" && employee.role !== "conductor") return;

      const rawKeys = employeeBusKeys(employee);
      if (!rawKeys.length) return;

      const keys = Array.from(new Set(rawKeys.flatMap((key) => aliases.get(key) || [key])));
      const routeId = employeeRoute(employee);

      keys.forEach((key) => {
        const assignment = { ...(map.get(key) || {}) };
        if (employee.role === "driver" && !assignment.driverName) {
          assignment.driverId = employee.id;
          assignment.driverName = employeeDisplayName(employee);
          assignment.driverRouteId = routeId;
        }
        if (employee.role === "conductor" && !assignment.conductorName) {
          assignment.conductorId = employee.id;
          assignment.conductorName = employeeDisplayName(employee);
          assignment.conductorRouteId = routeId;
        }
        map.set(key, assignment);
      });
    });

    return map;
  }, [employees.data, rows]);

  const [selected, setSelected] = useState<BusFleetRecord | null>(null);
  const [editing, setEditing] = useState<BusFleetRecord | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<BusForm | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [fuelFilter, setFuelFilter] = useState<FuelFilter>("all");

  const photoInputRef = useRef<HTMLInputElement>(null);

  const selectedBus = useMemo(() => {
    if (!selected) return rows[0] || null;
    return mergeBusRecord(rows.find((b) => b.id === selected.id), selected);
  }, [rows, selected]);

  const modalBus = useMemo(() => {
    if (!form) return null;
    const base = editing || selectedBus;

    return {
      ...(base || {}),
      id: base?.id || form.busNumber || "draft",
      busNumber: form.busNumber,
      plateNumber: form.plateNumber,
      busType: form.busType,
      seatingCapacity: Number(form.seatingCapacity || base?.seatingCapacity || 0),
      status: form.status,
      assignedRouteId: form.assignedRouteId || base?.assignedRouteId,
      assignedDriverId: form.assignedDriverId || base?.assignedDriverId,
      assignedDriverName: form.assignedDriverName || base?.assignedDriverName,
      assignedConductorId: form.assignedConductorId || base?.assignedConductorId,
      assignedConductorName: form.assignedConductorName || base?.assignedConductorName
    } as BusFleetRecord;
  }, [editing, form, selectedBus]);

  const assignmentForBus = useCallback((bus?: BusFleetRecord | null) => {
    for (const key of busKeys(bus)) {
      const assignment = assignmentMap.get(key);
      if (assignment) return assignment;
    }
    return undefined;
  }, [assignmentMap]);

  const liveBusForBus = useCallback((bus?: BusFleetRecord | null) => {
    for (const key of busKeys(bus)) {
      const live = liveBusMap.get(key);
      if (live) return live;
    }
    return undefined;
  }, [liveBusMap]);

  const routeForBus = useCallback((bus?: BusFleetRecord | null) => {
    const assignment = assignmentForBus(bus);
    const live = liveBusForBus(bus);
    return (
      bus?.assignedRouteId ||
      assignment?.driverRouteId ||
      assignment?.conductorRouteId ||
      live?.assignedRouteId ||
      live?.route ||
      ""
    );
  }, [assignmentForBus, liveBusForBus]);

  const driverForBus = useCallback((bus?: BusFleetRecord | null) => {
    const assignment = assignmentForBus(bus);
    const live = liveBusForBus(bus);
    return assignment?.driverName || getEmpName(bus?.assignedDriverId, bus?.assignedDriverName) || live?.driver || "";
  }, [assignmentForBus, getEmpName, liveBusForBus]);

  const conductorForBus = useCallback((bus?: BusFleetRecord | null) => {
    const assignment = assignmentForBus(bus);
    const live = liveBusForBus(bus);
    return assignment?.conductorName || getEmpName(bus?.assignedConductorId, bus?.assignedConductorName) || live?.conductor || "";
  }, [assignmentForBus, getEmpName, liveBusForBus]);

  const liveOdometerForBus = (bus?: BusFleetRecord | null) => liveTelemetryKm(liveBusForBus(bus));

  const formatLiveOdometer = (bus?: BusFleetRecord | null) => {
    const value = liveOdometerForBus(bus);
    return value === undefined
      ? "Not reported by Live Map"
      : value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  };

  const filteredRows = useMemo(() => {
    return rows.filter((bus) => {
      const q = search.toLowerCase();
      const driverName = driverForBus(bus).toLowerCase();
      const conductorName = conductorForBus(bus).toLowerCase();
      const routeName = getRouteName(routeForBus(bus)).toLowerCase();
      const matchSearch =
        !q ||
        bus.busNumber.toLowerCase().includes(q) ||
        (bus.plateNumber || "").toLowerCase().includes(q) ||
        driverName.includes(q) ||
        conductorName.includes(q) ||
        routeName.includes(q) ||
        (bus.fuelType || "").toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || bus.status === statusFilter;
      const matchFuel =
        fuelFilter === "all" || (bus.fuelType || "").toLowerCase() === fuelFilter;
      return matchSearch && matchStatus && matchFuel;
    });
  }, [rows, search, statusFilter, fuelFilter, conductorForBus, driverForBus, getRouteName, routeForBus]);

  const openCreate = () => {
    setMessage(null);
    setIsCreating(true);
    setEditing(null);
    setForm({ ...emptyForm, busNumber: suggestNextBusNumber(rows) });
  };

  const openEdit = (bus: BusFleetRecord) => {
    setMessage(null);
    setEditing(bus);
    setIsCreating(false);
    setForm(busToForm(bus));
  };

  const closeModal = () => {
    setEditing(null);
    setIsCreating(false);
    setForm(null);
    setMessage(null);
  };

  const saveCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form) return;
    setIsSaving(true);
    setMessage(null);
    try {
      const result = await api.createBus(formToPayload(form));
      setSelected(result.data);
      closeModal();
      await buses.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not create bus.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveEdit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form || !editing) return;
    setIsSaving(true);
    setMessage(null);
    try {
      const result = await api.patchBus(editing.id, formToPayload(form));
      setSelected(result.data);
      closeModal();
      await buses.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not update bus.");
    } finally {
      setIsSaving(false);
    }
  };

  const setStatus = async (bus: BusFleetRecord, status: BusStatus) => {
    await api.patchBus(bus.id, { status });
    await buses.refresh();
  };

  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selectedBus) return;
    setIsUploading(true);
    setMessage(null);
    try {
      const result = await api.uploadBusPhoto(selectedBus.id, file);
      setMessage("Bus photo uploaded successfully.");
      setSelected((prev) => ({
        ...(prev || selectedBus),
        photoUrl: result.data.photoUrl,
        photoPath: result.data.photoPath
      }));
      await buses.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not upload bus photo.");
    } finally {
      setIsUploading(false);
    }
  };

  const isModalOpen = (isCreating || editing !== null) && form !== null;

  return (
    <AppShell
      title="Bus Fleet Management"
      kicker="Vehicle registry, assignments, maintenance, and operating status"
    >
      {/* ── Controls bar ── */}
      <div className="bus-fleet-toolbar">
        <div className="bus-search-wrap">
          <Search size={15} />
          <input
            placeholder="Search bus number, plate, driver, conductor, route…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="bus-filter-group">
          <span className="bus-filter-label">Status</span>
          {(["all", "active", "available", "on-route", "maintenance", "inactive"] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={`bus-filter-chip ${statusFilter === s ? "active" : ""}`}
              onClick={() => setStatusFilter(s)}
            >
              {s === "all" ? "All" : titleCase(s)}
            </button>
          ))}
        </div>

        <div className="bus-filter-group">
          <span className="bus-filter-label">Fuel</span>
          {(["all", "diesel", "hybrid", "electric"] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={`bus-filter-chip ${fuelFilter === f ? "active" : ""}`}
              onClick={() => setFuelFilter(f)}
            >
              {f === "all" ? "All" : titleCase(f)}
            </button>
          ))}
        </div>

        <button type="button" className="primary-action" onClick={openCreate} style={{ marginLeft: "auto" }}>
          <Plus size={16} /> Add Bus
        </button>
      </div>

      {message && !isModalOpen && (
        <div className={`fleet-global-msg ${message.includes("successfully") ? "msg-success" : "msg-error"}`}>
          {message}
        </div>
      )}

      {/* ── Main workspace: list left, detail right ── */}
      <div className="bus-fleet-workspace">
        {/* ── Bus List ── */}
        <section className="command-card bus-list-panel">
          <div className="section-heading compact">
            <div>
              <span>{filteredRows.length} of {rows.length} buses</span>
              <h2>Fleet Registry</h2>
            </div>
            <BusFront size={20} />
          </div>

          {filteredRows.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>
              <BusFront size={32} style={{ margin: "0 auto 12px" }} />
              <p>No buses found. {rows.length === 0 ? "Add your first bus to get started." : "Try adjusting filters."}</p>
            </div>
          ) : (
            <div className="bus-card-list">
              {filteredRows.map((bus) => {
                const routeLabel = getRouteName(routeForBus(bus));

                return (
                <button
                  key={bus.id}
                  type="button"
                  className={`bus-fleet-card ${selectedBus?.id === bus.id ? "selected" : ""}`}
                  onClick={() => setSelected(bus)}
                >
                  {bus.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={bus.photoUrl} alt={bus.busNumber} className="bus-thumb" />
                  ) : (
                    <div className="bus-thumb-placeholder"><BusFront size={24} /></div>
                  )}
                  <div className="bus-card-main">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <strong>{bus.busNumber}</strong>
                      <span className={`status-pill ${statusColor(bus.status)}`}>
                        {titleCase(bus.status)}
                      </span>
                    </div>
                    <div className="bus-card-meta">
                      <span>{bus.plateNumber || "No plate"}</span>
                      <span>·</span>
                      <span>{titleCase(bus.busType || "aircon")}</span>
                    </div>
                    <div className="bus-card-meta" style={{ marginTop: 4 }}>
                      {routeLabel && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><MapPin size={10} /> {routeLabel}</span>
                      )}
                      {bus.fuelType && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }} className={fuelColor(bus.fuelType)}>
                          <Fuel size={10} /> {titleCase(bus.fuelType)}
                        </span>
                      )}
                      {bus.seatingCapacity && (
                        <span>{bus.seatingCapacity} seats</span>
                      )}
                    </div>
                  </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Bus Detail Panel ── */}
        <section className="command-card bus-detail-panel">
          {!selectedBus ? (
            <div style={{ display: "grid", placeItems: "center", padding: 48, color: "var(--muted)", flex: 1 }}>
              <div style={{ textAlign: "center" }}>
                <BusFront size={48} style={{ margin: "0 auto 16px" }} />
                <p>Select a bus from the list to view its profile.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Photo area */}
              <div className="bus-detail-hero">
                {selectedBus.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedBus.photoUrl}
                    alt={selectedBus.busNumber}
                    className="bus-detail-photo"
                  />
                ) : (
                  <div style={{ display: "grid", placeItems: "center", width: "100%", height: "100%", color: "var(--muted)" }}>
                    <div style={{ textAlign: "center" }}>
                      <BusFront size={48} style={{ marginBottom: 12 }} />
                      <div>No photo available</div>
                    </div>
                  </div>
                )}
                <div className="bus-detail-overlay">
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    style={{ display: "none" }}
                    onChange={handlePhotoUpload}
                  />
                  <button
                    type="button"
                    className="soft-button"
                    style={{ background: "rgba(255, 255, 255, 0.9)", border: "none", color: "#122033" }}
                    onClick={() => photoInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    <Camera size={14} />
                    {isUploading ? "Uploading…" : "Change Photo"}
                  </button>
                </div>
              </div>

              {/* Header */}
              <div style={{ padding: "16px 16px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h2 style={{ fontSize: "1.6rem", margin: "0 0 4px", color: "var(--text)" }}>{selectedBus.busNumber}</h2>
                  <span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{selectedBus.plateNumber || "No plate number"}</span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span className={`status-pill ${statusColor(selectedBus.status)}`}>
                    {titleCase(selectedBus.status)}
                  </span>
                </div>
              </div>

              {/* Specs grid */}
              <dl className="bus-detail-info-grid">
                <div>
                  <dt>Bus Type</dt>
                  <dd>{titleCase(selectedBus.busType || "aircon")}</dd>
                </div>
                <div>
                  <dt>Fuel Type</dt>
                  <dd>{titleCase(selectedBus.fuelType || "diesel")}</dd>
                </div>
                <div>
                  <dt>Seated Capacity</dt>
                  <dd>{selectedBus.seatingCapacity ?? "—"}</dd>
                </div>
                <div>
                  <dt>Assigned Route</dt>
                  <dd>{getRouteName(routeForBus(selectedBus)) || "Unassigned"}</dd>
                </div>
                <div>
                  <dt>Assigned Driver</dt>
                  <dd>{driverForBus(selectedBus) || "Unassigned"}</dd>
                </div>
                <div>
                  <dt>Assigned Conductor</dt>
                  <dd>{conductorForBus(selectedBus) || "Unassigned"}</dd>
                </div>
                <div>
                  <dt>Registration No.</dt>
                  <dd>{selectedBus.registrationNumber || selectedBus.registrationNotes || "—"}</dd>
                </div>
                <div>
                  <dt>Permit / Franchise</dt>
                  <dd>{selectedBus.permitInfo || "—"}</dd>
                </div>
                <div>
                  <dt>Insurance Info</dt>
                  <dd>{selectedBus.insuranceInfo || "—"}</dd>
                </div>
                <div>
                  <dt>Last Maintenance</dt>
                  <dd>{selectedBus.lastMaintenance ? new Date(selectedBus.lastMaintenance).toLocaleDateString() : "—"}</dd>
                </div>
                <div>
                  <dt>Next Maintenance</dt>
                  <dd>{selectedBus.nextMaintenance ? new Date(selectedBus.nextMaintenance).toLocaleDateString() : "—"}</dd>
                </div>
                <div>
                  <dt>Live Odometer (km)</dt>
                  <dd>{formatLiveOdometer(selectedBus)}</dd>
                </div>
              </dl>

              {selectedBus.notes && (
                <div style={{ padding: "0 16px 16px", color: "var(--muted)", fontSize: "0.85rem", lineHeight: 1.5 }}>
                  <strong style={{ display: "block", fontSize: "0.72rem", textTransform: "uppercase", marginBottom: 4 }}>Notes</strong>
                  <p style={{ margin: 0 }}>{selectedBus.notes}</p>
                </div>
              )}

              {/* Action buttons */}
              <div className="bus-detail-actions">
                <button type="button" className="soft-button" onClick={() => openEdit(selectedBus)}>
                  <Edit3 size={14} /> Edit
                </button>
                <button
                  type="button"
                  className="soft-button"
                  onClick={() => setStatus(selectedBus, selectedBus.status === "maintenance" ? "active" : "maintenance")}
                >
                  <Wrench size={14} /> {selectedBus.status === "maintenance" ? "Activate" : "Set Maintenance"}
                </button>
                <button
                  type="button"
                  className="soft-button"
                  onClick={() => setStatus(selectedBus, selectedBus.status === "active" ? "inactive" : "active")}
                >
                  <Shield size={14} /> {selectedBus.status === "active" ? "Deactivate" : "Activate"}
                </button>
                <button type="button" className="soft-button" onClick={() => window.location.href = `/fleet-map?bus=${encodeURIComponent(selectedBus.busNumber || selectedBus.id)}`}>
                  <Navigation size={14} /> Track
                </button>
              </div>
            </>
          )}
        </section>
      </div>

      {/* ── Add / Edit Modal ── */}
      {isModalOpen && (
        <Portal>
        <div className="modal-backdrop" role="presentation">
          <section
            className="command-card modal-panel bus-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bus-modal-title"
          >
            <div className="section-heading compact">
              <div>
                <span>Bus profile</span>
                <h2 id="bus-modal-title">{isCreating ? "Add New Bus" : "Edit Bus"}</h2>
              </div>
              <button type="button" className="icon-button" onClick={closeModal} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            {message && <p className="form-error" style={{ marginBottom: 12 }}>{message}</p>}

            <form className="stacked-form" onSubmit={isCreating ? saveCreate : saveEdit}>
              {/* Required fields */}
              <div className="form-section-label">Required</div>
              <div className="form-row">
                <label>
                  Bus Number *
                  <input
                    required
                    value={form!.busNumber}
                    onChange={(e) => setForm({ ...form!, busNumber: normalizeBusNumberDigits(e.target.value).slice(0, BUS_NUMBER_LENGTH) })}
                    placeholder="e.g. 190001"
                    inputMode="numeric"
                    maxLength={BUS_NUMBER_LENGTH}
                    pattern={isCreating ? `${BUS_NUMBER_PREFIX}[0-9]{4}` : undefined}
                    title="Use a 6-digit bus number starting with 19"
                  />
                </label>
                <label>
                  Plate Number
                  <input
                    value={form!.plateNumber}
                    onChange={(e) => setForm({ ...form!, plateNumber: e.target.value })}
                    placeholder="e.g. ABC 1234"
                  />
                </label>
              </div>

              <div className="form-row">
                <label>
                  Bus Type *
                  <select value={form!.busType} onChange={(e) => setForm({ ...form!, busType: e.target.value })}>
                    <option value="aircon">Aircon</option>
                    <option value="ordinary">Ordinary</option>
                  </select>
                </label>
                <label>
                  Fuel Type *
                  <select value={form!.fuelType} onChange={(e) => setForm({ ...form!, fuelType: e.target.value })}>
                    <option value="diesel">Diesel</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="electric">Electric</option>
                  </select>
                </label>
              </div>

              <div className="form-row">
                <label>
                  Seating Capacity *
                  <input
                    type="number"
                    min="0"
                    required
                    value={form!.seatingCapacity}
                    onChange={(e) => setForm({ ...form!, seatingCapacity: e.target.value })}
                  />
                </label>
                <label>
                  Status *
                  <select value={form!.status} onChange={(e) => setForm({ ...form!, status: e.target.value as BusStatus })}>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{titleCase(s)}</option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Optional fields */}
              <div className="form-section-label" style={{ marginTop: 16 }}>Optional Details</div>
              <div className="form-row">
                <label>
                  Assigned Route
                  <input
                    value={getRouteName(routeForBus(modalBus)) || "Unassigned"}
                    disabled
                    title="Routes are assigned via the Map or Route Management"
                    style={{ background: "var(--bg-muted)", color: "var(--muted)", cursor: "not-allowed" }}
                  />
                </label>
                <label>
                  Assigned Driver
                  <input
                    value={driverForBus(modalBus) || "Unassigned"}
                    disabled
                    title="Drivers are assigned via the Employees module"
                    style={{ background: "var(--bg-muted)", color: "var(--muted)", cursor: "not-allowed" }}
                  />
                </label>
              </div>

              <div className="form-row">
                <label>
                  Assigned Conductor
                  <input
                    value={conductorForBus(modalBus) || "Unassigned"}
                    disabled
                    title="Conductors are assigned via the Employees module"
                    style={{ background: "var(--bg-muted)", color: "var(--muted)", cursor: "not-allowed" }}
                  />
                </label>
                <label>
                  Live Odometer (km)
                  <input
                    value={formatLiveOdometer(modalBus)}
                    disabled
                    title="Odometer updates automatically based on live tracking"
                    style={{ background: "var(--bg-muted)", color: "var(--muted)", cursor: "not-allowed" }}
                  />
                </label>
              </div>

              <div className="form-row">
                <DocumentUploadInput
                  label="Registration Number / Document"
                  value={form!.registrationNumber}
                  onChange={(v) => setForm({ ...form!, registrationNumber: v })}
                  docType="registration"
                  busId={editing?.id}
                  disabled={isCreating}
                />
                <DocumentUploadInput
                  label="Permit / Franchise"
                  value={form!.permitInfo}
                  onChange={(v) => setForm({ ...form!, permitInfo: v })}
                  docType="permit"
                  busId={editing?.id}
                  disabled={isCreating}
                />
              </div>

              <div className="form-row" style={{ gridTemplateColumns: "1fr" }}>
                <DocumentUploadInput
                  label="Insurance Info"
                  value={form!.insuranceInfo}
                  onChange={(v) => setForm({ ...form!, insuranceInfo: v })}
                  docType="insurance"
                  busId={editing?.id}
                  disabled={isCreating}
                />
              </div>

              <div className="form-row">
                <label>
                  Last Maintenance Date
                  <input
                    type="date"
                    value={form!.lastMaintenance}
                    onChange={(e) => setForm({ ...form!, lastMaintenance: e.target.value })}
                  />
                </label>
                <label>
                  Next Maintenance Date
                  <input
                    type="date"
                    value={form!.nextMaintenance}
                    onChange={(e) => setForm({ ...form!, nextMaintenance: e.target.value })}
                  />
                </label>
              </div>

              <div className="form-row" style={{ gridTemplateColumns: "1fr" }}>
                <label>
                  Notes / Description
                  <textarea
                    value={form!.notes}
                    onChange={(e) => setForm({ ...form!, notes: e.target.value })}
                    placeholder="Additional notes about this bus…"
                    rows={3}
                  />
                </label>
              </div>

              <div className="inline-actions">
                <button type="button" className="soft-button" onClick={closeModal}>Cancel</button>
                <button type="submit" className="primary-action" disabled={isSaving}>
                  <Settings size={15} />
                  {isSaving ? "Saving…" : isCreating ? "Add Bus" : "Save Changes"}
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
