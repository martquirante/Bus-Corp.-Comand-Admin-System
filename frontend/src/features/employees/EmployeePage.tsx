"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EmployeeRecord, EmployeeRole, EmployeeSalaryType } from "@pos-bus/shared";
import { Edit3, IdCard, Plus, Power, Search, X } from "lucide-react";
import { api } from "@/services/api";
import { useApiResource } from "@/hooks/useApiResource";
import { AppShell } from "@/components/layout/AppShell";
import { DataTable } from "@/components/ui/DataTable";
import { EmployeeProfilePanel } from "./EmployeeProfilePanel";

type EmployeeEditForm = {
  employeeNumber: string;
  fullName: string;
  role: EmployeeRole;
  phone: string;
  email: string;
  address: string;
  assignedBus: string;
  assignedRoute: string;
  salaryRate: string;
  salaryType: EmployeeSalaryType;
  status: EmployeeRecord["status"];
};

const roleOptions: EmployeeRole[] = ["admin", "driver", "conductor", "inspector", "mechanic"];
const TRANSPORT_ROLES: EmployeeRole[] = ["driver", "conductor"];
const salaryTypeOptions: EmployeeSalaryType[] = ["daily", "monthly", "commission"];
const routeOptions = ["FVR-PITX-FVR", "FVR-ST. CRUZ-FVR"];

type RoleFilter = "all" | EmployeeRole;
type StatusFilter = "all" | "active" | "inactive" | "pending";

const defaultSalary = (role: EmployeeRole) => {
  if (role === "driver") return { salaryRate: "15", salaryType: "commission" as const };
  if (role === "conductor") return { salaryRate: "12", salaryType: "commission" as const };
  return { salaryRate: "0", salaryType: "daily" as const };
};

const titleCase = (value: string) => value.replace(/^\w/, (letter) => letter.toUpperCase());

const employeeToForm = (employee: EmployeeRecord): EmployeeEditForm => {
  const salary = defaultSalary(employee.role);
  return {
    employeeNumber: employee.employeeNumber || "",
    fullName: employee.fullName || "",
    email: employee.email || "",
    role: employee.role,
    phone: employee.phone || "",
    address: employee.address || "",
    assignedBus: employee.assignedBus || employee.assignedBusId || "",
    assignedRoute: employee.assignedRoute || employee.assignedRouteId || "",
    salaryRate: employee.salaryRate === undefined ? salary.salaryRate : String(employee.salaryRate),
    salaryType: employee.salaryType || salary.salaryType,
    status: employee.status || "active"
  };
};

const formToPayload = (form: EmployeeEditForm): Partial<EmployeeRecord> => ({
  employeeNumber: form.employeeNumber,
  fullName: form.fullName,
  email: form.email,
  role: form.role,
  phone: form.phone,
  address: form.address,
  assignedBus: form.assignedBus,
  assignedBusId: form.assignedBus,
  assignedRoute: form.assignedRoute,
  assignedRouteId: form.assignedRoute,
  salaryRate: Number(form.salaryRate || 0),
  salaryType: form.salaryType,
  status: form.status
});

const mergeEmployeeWithAssets = (
  base: EmployeeRecord | null | undefined,
  incoming: Partial<EmployeeRecord> | null | undefined
): EmployeeRecord | null => {
  if (!base && !incoming) return null;
  if (!base) return incoming as EmployeeRecord;
  if (!incoming) return base;

  return {
    ...base,
    ...incoming,

    photoUrl:
      incoming.photoUrl ||
      incoming.profilePhotoUrl ||
      base.photoUrl ||
      base.profilePhotoUrl,

    profilePhotoUrl:
      incoming.profilePhotoUrl ||
      incoming.photoUrl ||
      base.profilePhotoUrl ||
      base.photoUrl,

    photoPath: incoming.photoPath || base.photoPath,

    signatureUrl: incoming.signatureUrl || base.signatureUrl,
    signaturePath: incoming.signaturePath || base.signaturePath,

    idFrontUrl: incoming.idFrontUrl || base.idFrontUrl,
    idFrontPath: incoming.idFrontPath || base.idFrontPath,

    idBackUrl: incoming.idBackUrl || base.idBackUrl,
    idBackPath: incoming.idBackPath || base.idBackPath,

    idPdfUrl: incoming.idPdfUrl || base.idPdfUrl,
    idPdfPath: incoming.idPdfPath || base.idPdfPath,

    qrUrl: incoming.qrUrl || base.qrUrl,
    qrPath: incoming.qrPath || base.qrPath,

    storageFolder: incoming.storageFolder || base.storageFolder
  };
};

const EMPTY_ROWS: EmployeeRecord[] = [];

export function EmployeePage() {
  const loadEmployees = useCallback(() => api.employees(), []);
  const loadBuses = useCallback(() => api.buses(), []);
  
  const employees = useApiResource(loadEmployees);
  const buses = useApiResource(loadBuses);
  
  const rows = employees.data || EMPTY_ROWS;

  const [selected, setSelected] = useState<EmployeeRecord | null>(null);
  const [editing, setEditing] = useState<EmployeeRecord | null>(null);
  const [form, setForm] = useState<EmployeeEditForm | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const selectedEmployee = useMemo(() => {
    if (!selected) return rows[0] || null;
    const rowMatch = rows.find((employee) => employee.id === selected.id);
    if (!rowMatch) return selected;
    return mergeEmployeeWithAssets(rowMatch, selected);
  }, [rows, selected]);

  // FIX: use mergeEmployeeWithAssets instead of direct setSelected
  // so photo and signature don't overwrite each other on load
  const loadAssets = useCallback(async (employee: EmployeeRecord) => {
    try {
      const result = await api.getEmployeeAssets(employee.id);
      if (result.data.employee)
        setSelected((prev) => mergeEmployeeWithAssets(prev || employee, result.data.employee!));
    } catch {
      setSelected((current) => mergeEmployeeWithAssets(current || employee, employee));
    }
  }, []);

  useEffect(() => {
    if (!selected && rows[0]) {
      setSelected(rows[0]);
      void loadAssets(rows[0]);
    }
  }, [loadAssets, rows, selected]);

  const viewEmployee = async (employee: EmployeeRecord) => {
    setMessage(null);
    setSelected((current) =>
      current?.id === employee.id
        ? mergeEmployeeWithAssets(current, employee)
        : employee
    );
    await loadAssets(employee);
  };

  const openEdit = async (employee: EmployeeRecord) => {
    setMessage(null);
    setEditing(employee);
    setForm(employeeToForm(employee));
    setSelected((current) =>
      current?.id === employee.id
        ? mergeEmployeeWithAssets(current, employee)
        : employee
    );
    await loadAssets(employee);
  };

  const openCreate = () => {
    setMessage(null);
    setIsCreating(true);
    setForm({
      employeeNumber: "",
      fullName: "",
      email: "",
      role: "driver",
      phone: "",
      address: "",
      assignedBus: "",
      assignedRoute: "",
      salaryRate: "15",
      salaryType: "commission",
      status: "active"
    });
  };

  const validateBusAssignment = () => {
    if (!form) return true;
    if (form.role !== "driver" && form.role !== "conductor") return true;
    if (!form.assignedBus) return true;
    if (form.status !== "active") return true; // Only validate active employees

    // Find other active employees assigned to this bus with the SAME role
    const conflict = rows.find(emp => 
      emp.id !== editing?.id && 
      emp.status === "active" &&
      emp.role === form.role && 
      (emp.assignedBus === form.assignedBus || emp.assignedBusId === form.assignedBus)
    );

    if (conflict) {
      setMessage(`Validation Error: Bus ${form.assignedBus} already has an active ${form.role} assigned (${conflict.fullName || conflict.employeeNumber}). A bus can only have one active driver and one active conductor.`);
      return false;
    }
    return true;
  };

  const saveEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing || !form) return;
    setIsSaving(true);
    setMessage(null);

    if (!validateBusAssignment()) {
      setIsSaving(false);
      return;
    }

    try {
      const result = await api.patchEmployee(editing.id, formToPayload(form));
      setSelected((current) => mergeEmployeeWithAssets(current || editing, result.data));
      setEditing(null);
      setForm(null);
      await employees.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update employee.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form) return;
    setIsSaving(true);
    setMessage(null);

    if (!validateBusAssignment()) {
      setIsSaving(false);
      return;
    }

    try {
      const result = await api.createEmployee(formToPayload(form));
      setSelected((current) => mergeEmployeeWithAssets(current, result.data));
      setIsCreating(false);
      setForm(null);
      await employees.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create employee.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleStatus = async (employee: EmployeeRecord) => {
    const status = employee.status === "active" ? "inactive" : "active";
    const result = await api.patchEmployee(employee.id, { status });
    setSelected((current) => mergeEmployeeWithAssets(current || employee, result.data));
    await employees.refresh();
  };

  const uploadInFlightRef = useRef<string | null>(null);

  const uploadAsset = async (event: ChangeEvent<HTMLInputElement>, kind: "photo" | "signature") => {
    const file = event.target.files?.[0];
    const target = selectedEmployee;
    event.target.value = "";
    if (!file || !target) return;

    const uploadKey = `${target.id}-${kind}`;
    if (uploadInFlightRef.current === uploadKey) return;
    uploadInFlightRef.current = uploadKey;

    setMessage(null);
    setIsSaving(true);
    try {
      const result =
        kind === "photo"
          ? await api.uploadEmployeePhoto(target.id, file)
          : await api.uploadEmployeeSignature(target.id, file);

      if (result.data.employee) {
        setSelected((current) => mergeEmployeeWithAssets(current || target, result.data.employee || target));
        setMessage(`Successfully uploaded employee ${kind}.`);
      }
      await employees.refresh();

      const assetsResult = await api.getEmployeeAssets(target.id);
      if (assetsResult.data.employee) {
        setSelected((current) => mergeEmployeeWithAssets(current || target, assetsResult.data.employee || target));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Could not upload employee ${kind}.`);
    } finally {
      setIsSaving(false);
      uploadInFlightRef.current = null;
    }
  };

  const updateRole = (role: EmployeeRole) => {
    if (!form) return;
    const salary = defaultSalary(role);
    const isTransport = role === "driver" || role === "conductor";
    setForm({
      ...form,
      role,
      assignedBus: isTransport ? form.assignedBus : "",
      assignedRoute: isTransport ? form.assignedRoute : "",
      salaryRate: isTransport ? salary.salaryRate : form.salaryRate,
      salaryType: isTransport ? salary.salaryType : form.salaryType
    });
  };

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchSearch =
        !search ||
        `${row.fullName} ${row.employeeNumber} ${row.role} ${row.phone} ${row.status}`
          .toLowerCase()
          .includes(search.toLowerCase());
      const matchRole = roleFilter === "all" || row.role === roleFilter;
      const matchStatus = statusFilter === "all" || row.status === statusFilter;
      return matchSearch && matchRole && matchStatus;
    });
  }, [rows, search, roleFilter, statusFilter]);

  const closeModal = () => {
    setEditing(null);
    setIsCreating(false);
    setForm(null);
    setMessage(null);
  };

  // Filter buses to only show those not yet occupied by an active employee with the same role
  const availableBuses = useMemo(() => {
    if (!buses.data || !form) return [];
    
    return buses.data.filter((bus) => {
      // Is there another active employee with the SAME role already assigned to this bus?
      const isOccupied = rows.some((emp) => 
        emp.id !== editing?.id &&
        emp.status === "active" &&
        emp.role === form.role &&
        (emp.assignedBus === bus.busNumber || emp.assignedBusId === bus.busNumber)
      );
      
      // Also allow it if the *currently editing* employee is already assigned to it
      const isCurrentAssignment = editing?.assignedBus === bus.busNumber || editing?.assignedBusId === bus.busNumber;
      
      return !isOccupied || isCurrentAssignment;
    });
  }, [buses.data, form?.role, editing?.id, editing?.assignedBus, editing?.assignedBusId, rows]);

  const isModalOpen = (editing !== null || isCreating) && form !== null;

  return (
    <AppShell title="Employees" kicker="Workforce registry, profiles, and digital ID management">
      {/* Global error message */}
      {message && !isModalOpen ? (
        <section className={`command-card emp-global-message ${message.includes("Successfully") ? "inline-success" : "inline-error"}`}>
          <span>{message}</span>
        </section>
      ) : null}

      {/* Search + Filters */}
      <div className="emp-filter-bar">
        <div className="emp-search-wrap">
          <Search size={15} className="emp-search-icon" />
          <input
            className="emp-search-input"
            placeholder="Search by name, ID, role, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="emp-chip-group">
          <span className="emp-chip-label">Status</span>
          {(["all", "active", "inactive", "pending"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              type="button"
              className={`emp-chip ${statusFilter === s ? "active" : ""}`}
              onClick={() => setStatusFilter(s)}
            >
              {titleCase(s)}
            </button>
          ))}
        </div>

        <div className="emp-chip-group">
          <span className="emp-chip-label">Role</span>
          {(["all", ...roleOptions] as RoleFilter[]).map((r) => (
            <button
              key={r}
              type="button"
              className={`emp-chip ${roleFilter === r ? "active" : ""}`}
              onClick={() => setRoleFilter(r)}
            >
              {titleCase(r)}
            </button>
          ))}
        </div>

        <button type="button" className="primary-action emp-add-btn" onClick={openCreate}>
          <Plus size={16} /> Add Employee
        </button>
      </div>

      {/* Main workspace: table left, profile right */}
      <section className="employee-workspace-grid">
        {/* Table */}
        <section className="command-card">
          <div className="section-heading compact">
            <div>
              <span>{filteredRows.length} of {rows.length} employees</span>
              <h2>All Staff</h2>
            </div>
            <IdCard size={20} />
          </div>
          <DataTable
            rows={filteredRows}
            getRowKey={(row) => row.id}
            onRowClick={(row) => void viewEmployee(row)}
            selectedRowKey={selectedEmployee?.id}
            columns={[
              { header: "Employee name", cell: (row) => <strong>{row.fullName}</strong> },
              { header: "Employee ID", cell: (row) => row.employeeNumber || "—" },
              { header: "Role", cell: (row) => titleCase(row.role) },
              { header: "Phone", cell: (row) => row.phone || "—" },
              { header: "Bus", cell: (row) => row.assignedBus || row.assignedBusId || "—" },
              { header: "Route", cell: (row) => row.assignedRoute || row.assignedRouteId || "—" },
              {
                header: "Status",
                cell: (row) => <span className={`status-pill status-${row.status}`}>{row.status}</span>
              },
              {
                header: "Actions",
                cell: (row) => (
                  <div className="table-action-row">
                    <button type="button" className="soft-button table-action" onClick={(e) => { e.stopPropagation(); void openEdit(row); }}>
                      <Edit3 size={14} /> Edit
                    </button>
                    <button type="button" className="soft-button table-action" onClick={(e) => { e.stopPropagation(); void toggleStatus(row); }}>
                      <Power size={14} /> {row.status === "active" ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                )
              }
            ]}
          />
        </section>

        {/* Profile panel */}
        <EmployeeProfilePanel
          employee={selectedEmployee}
          isSaving={isSaving}
          uploadMessage={message}
          onEdit={() => selectedEmployee && void openEdit(selectedEmployee)}
          onUpload={uploadAsset}
        />
      </section>

      {/* Edit / Create modal */}
      {isModalOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section
            className="command-card modal-panel employee-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="emp-modal-title"
          >
            <div className="section-heading compact">
              <div>
                <span>Employee profile</span>
                <h2 id="emp-modal-title">{isCreating ? "Add New Employee" : "Edit Employee Info"}</h2>
              </div>
              <button type="button" className="icon-button" onClick={closeModal} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            {message ? <p className="form-error" style={{ marginBottom: 12 }}>{message}</p> : null}

            <form className="stacked-form" onSubmit={isCreating ? saveCreate : saveEdit}>
              <div className="form-row">
                <label>
                  Employee number
                  <input
                    value={form!.employeeNumber}
                    onChange={(e) => setForm({ ...form!, employeeNumber: e.target.value })}
                    required
                  />
                </label>
                <label>
                  Full name
                  <input
                    value={form!.fullName}
                    onChange={(e) => setForm({ ...form!, fullName: e.target.value })}
                    required
                  />
                </label>
              </div>

              <div className="form-row">
                <label>
                  Role
                  <select value={form!.role} onChange={(e) => updateRole(e.target.value as EmployeeRole)}>
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {titleCase(role)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Status
                  <select
                    value={form!.status}
                    onChange={(e) => setForm({ ...form!, status: e.target.value as EmployeeRecord["status"] })}
                  >
                    <option value="active">Active — Can log in and work</option>
                    <option value="inactive">Inactive — Access removed</option>
                    <option value="pending">Pending — Awaiting approval</option>
                  </select>
                </label>
              </div>

              <div className="form-row">
                <label>
                  Phone
                  <input
                    value={form!.phone}
                    onChange={(e) => setForm({ ...form!, phone: e.target.value })}
                    placeholder="09xx xxx xxxx"
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    value={form!.email}
                    onChange={(e) => setForm({ ...form!, email: e.target.value })}
                    placeholder="employee@posbus.com"
                  />
                </label>
              </div>

              <div className="form-row" style={{ gridTemplateColumns: '1fr' }}>
                <label>
                  Address
                  <input
                    value={form!.address}
                    onChange={(e) => setForm({ ...form!, address: e.target.value })}
                    placeholder="Home address"
                  />
                </label>
              </div>

              {/* Bus / Route — only relevant for Drivers and Conductors */}
              {TRANSPORT_ROLES.includes(form!.role) && (
                <div className="form-row">
                  <label>
                    Assigned Bus
                    <select
                      value={form!.assignedBus}
                      onChange={(e) => setForm({ ...form!, assignedBus: e.target.value })}
                    >
                      <option value="">Not assigned</option>
                      {availableBuses.map((bus) => (
                        <option key={bus.id} value={bus.busNumber}>
                          {bus.busNumber} {bus.plateNumber ? `(${bus.plateNumber})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Assigned Route
                    <select
                      value={form!.assignedRoute}
                      onChange={(e) => setForm({ ...form!, assignedRoute: e.target.value })}
                    >
                      <option value="">Not assigned</option>
                      {routeOptions.map((route) => (
                        <option key={route} value={route}>
                          {route}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              <div className="form-row">
                <label>
                  Pay Rate {TRANSPORT_ROLES.includes(form!.role) ? "(Fixed %)" : ""}
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form!.salaryRate}
                    onChange={(e) => setForm({ ...form!, salaryRate: e.target.value })}
                    disabled={TRANSPORT_ROLES.includes(form!.role)}
                  />
                </label>
                <label>
                  Pay Schedule
                  <select
                    value={form!.salaryType}
                    onChange={(e) => setForm({ ...form!, salaryType: e.target.value as EmployeeSalaryType })}
                    disabled={TRANSPORT_ROLES.includes(form!.role)}
                  >
                    <option value="daily">Daily</option>
                    <option value="monthly">Monthly</option>
                    <option value="commission">Commission (per trip)</option>
                  </select>
                </label>
              </div>

              <div className="inline-actions">
                <button type="button" className="soft-button" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="primary-action" disabled={isSaving}>
                  {isSaving ? "Saving…" : isCreating ? "Add employee" : "Save changes"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}
