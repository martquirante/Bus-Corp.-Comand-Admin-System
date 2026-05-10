"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EmployeeRecord, EmployeeRole, EmployeeSalaryType } from "@pos-bus/shared";
import { Edit3, Eye, IdCard, Power, Upload, X } from "lucide-react";
import { api } from "@/services/api";
import { useApiResource } from "@/hooks/useApiResource";
import { AppShell } from "@/components/layout/AppShell";
import { DataTable } from "@/components/ui/DataTable";
import { EmployeeIdCard } from "@/components/employee/EmployeeIdCard";
import { EmployeeIdExportActions } from "@/components/employee/EmployeeIdExportActions";

type EmployeeEditForm = {
  employeeNumber: string;
  fullName: string;
  role: EmployeeRole;
  phone: string;
  address: string;
  assignedBus: string;
  assignedRoute: string;
  salaryRate: string;
  salaryType: EmployeeSalaryType;
  status: EmployeeRecord["status"];
};

const roleOptions: EmployeeRole[] = ["admin", "driver", "conductor", "inspector", "mechanic"];
const salaryTypeOptions: EmployeeSalaryType[] = ["daily", "monthly", "commission"];
const routeOptions = ["FVR-PITX-FVR", "FVR-ST. CRUZ-FVR"];

const defaultSalary = (role: EmployeeRole) => {
  if (role === "driver") return { salaryRate: "12", salaryType: "commission" as const };
  if (role === "conductor") return { salaryRate: "10", salaryType: "commission" as const };
  return { salaryRate: "0", salaryType: "daily" as const };
};

const titleCase = (value: string) => value.replace(/^\w/, (letter) => letter.toUpperCase());

const employeeToForm = (employee: EmployeeRecord): EmployeeEditForm => {
  const salary = defaultSalary(employee.role);
  return {
    employeeNumber: employee.employeeNumber || "",
    fullName: employee.fullName || "",
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

export function EmployeePage() {
  const loadEmployees = useCallback(() => api.employees(), []);
  const employees = useApiResource(loadEmployees);
  const rows = employees.data || [];
  const frontRef = useRef<HTMLDivElement | null>(null);
  const backRef = useRef<HTMLDivElement | null>(null);
  const [selected, setSelected] = useState<EmployeeRecord | null>(null);
  const [editing, setEditing] = useState<EmployeeRecord | null>(null);
  const [form, setForm] = useState<EmployeeEditForm | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const selectedEmployee = useMemo(() => {
    if (!selected) return rows[0] || null;
    return rows.find((employee) => employee.id === selected.id) || selected;
  }, [rows, selected]);

  const loadAssets = useCallback(async (employee: EmployeeRecord) => {
    try {
      const result = await api.getEmployeeAssets(employee.id);
      if (result.data.employee) setSelected(result.data.employee);
    } catch {
      setSelected(employee);
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
    setSelected(employee);
    setIsFlipped(false);
    await loadAssets(employee);
  };

  const openEdit = async (employee: EmployeeRecord) => {
    setMessage(null);
    setEditing(employee);
    setForm(employeeToForm(employee));
    setSelected(employee);
    await loadAssets(employee);
  };

  const saveEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing || !form) return;
    setIsSaving(true);
    setMessage(null);

    try {
      const result = await api.patchEmployee(editing.id, formToPayload(form));
      setSelected(result.data);
      setEditing(null);
      setForm(null);
      await employees.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update employee.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleStatus = async (employee: EmployeeRecord) => {
    const status = employee.status === "active" ? "inactive" : "active";
    const result = await api.patchEmployee(employee.id, { status });
    setSelected(result.data);
    await employees.refresh();
  };

  const uploadAsset = async (event: ChangeEvent<HTMLInputElement>, kind: "photo" | "signature") => {
    const file = event.target.files?.[0];
    const target = editing || selectedEmployee;
    event.target.value = "";
    if (!file || !target) return;

    setMessage(null);
    setIsSaving(true);
    try {
      const result =
        kind === "photo"
          ? await api.uploadEmployeePhoto(target.id, file)
          : await api.uploadEmployeeSignature(target.id, file);
      if (result.data.employee) {
        setSelected(result.data.employee);
        setEditing(result.data.employee);
        setForm(employeeToForm(result.data.employee));
      }
      await employees.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Could not upload employee ${kind}.`);
    } finally {
      setIsSaving(false);
    }
  };

  const updateRole = (role: EmployeeRole) => {
    if (!form) return;
    const salary = defaultSalary(role);
    const shouldReplaceSalary = !form.salaryRate || form.salaryRate === "0" || form.salaryType !== "commission";
    setForm({
      ...form,
      role,
      salaryRate: shouldReplaceSalary ? salary.salaryRate : form.salaryRate,
      salaryType: shouldReplaceSalary ? salary.salaryType : form.salaryType
    });
  };

  const onSavedId = (employee: EmployeeRecord) => {
    setSelected(employee);
    void employees.refresh();
  };

  return (
    <AppShell title="Employee" kicker="Workforce profiles, salary settings, and secure ID generation">
      {message ? (
        <section className="command-card inline-error">
          <span>{message}</span>
        </section>
      ) : null}

      <section className="employee-workspace-grid">
        <section className="command-card">
          <div className="section-heading compact">
            <div>
              <span>{rows.length} employees</span>
              <h2>Workforce registry</h2>
            </div>
            <IdCard size={20} />
          </div>
          <DataTable
            rows={rows}
            getRowKey={(row) => row.id}
            columns={[
              { header: "Employee name", cell: (row) => <strong>{row.fullName}</strong> },
              { header: "Employee ID", cell: (row) => row.employeeNumber },
              { header: "Role", cell: (row) => titleCase(row.role) },
              { header: "Phone", cell: (row) => row.phone || "Not set" },
              { header: "Bus", cell: (row) => row.assignedBus || row.assignedBusId || "Unassigned" },
              { header: "Route", cell: (row) => row.assignedRoute || row.assignedRouteId || "Unassigned" },
              { header: "Status", cell: (row) => <span className={`status-pill status-${row.status}`}>{row.status}</span> },
              {
                header: "Actions",
                cell: (row) => (
                  <div className="table-action-row">
                    <button type="button" className="soft-button table-action" onClick={() => viewEmployee(row)}>
                      <Eye size={14} /> View
                    </button>
                    <button type="button" className="soft-button table-action" onClick={() => openEdit(row)}>
                      <Edit3 size={14} /> Edit
                    </button>
                    <button type="button" className="soft-button table-action" onClick={() => toggleStatus(row)}>
                      <Power size={14} /> {row.status === "active" ? "Deactivate" : "Activate"}
                    </button>
                    <button type="button" className="soft-button table-action" onClick={() => viewEmployee(row)}>
                      <IdCard size={14} /> Preview ID
                    </button>
                  </div>
                )
              }
            ]}
          />
        </section>

        <aside className="command-card employee-id-panel">
          <div className="section-heading compact">
            <div>
              <span>Generated in web app</span>
              <h2>Employee ID preview</h2>
            </div>
          </div>
          <EmployeeIdCard
            employee={selectedEmployee}
            isFlipped={isFlipped}
            frontRef={frontRef}
            backRef={backRef}
            onQrReady={setQrDataUrl}
          />
          <EmployeeIdExportActions
            employee={selectedEmployee}
            frontRef={frontRef}
            backRef={backRef}
            qrDataUrl={qrDataUrl}
            onFlip={() => setIsFlipped((value) => !value)}
            onSaved={onSavedId}
          />
        </aside>
      </section>

      {editing && form ? (
        <div className="modal-backdrop" role="presentation">
          <section className="command-card modal-panel employee-edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-employee-title">
            <div className="section-heading compact">
              <div>
                <span>Employee profile</span>
                <h2 id="edit-employee-title">Edit workforce record</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setEditing(null)} aria-label="Close edit employee">
                <X size={18} />
              </button>
            </div>

            <form className="stacked-form" onSubmit={saveEdit}>
              <div className="form-row">
                <label>
                  Employee number
                  <input value={form.employeeNumber} onChange={(event) => setForm({ ...form, employeeNumber: event.target.value })} required />
                </label>
                <label>
                  Full name
                  <input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required />
                </label>
              </div>

              <div className="form-row">
                <label>
                  Role
                  <select value={form.role} onChange={(event) => updateRole(event.target.value as EmployeeRole)}>
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {titleCase(role)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Status
                  <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as EmployeeRecord["status"] })}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="pending">Pending</option>
                  </select>
                </label>
              </div>

              <div className="form-row">
                <label>
                  Phone
                  <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="09xx xxx xxxx" />
                </label>
                <label>
                  Address
                  <input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Home address" />
                </label>
              </div>

              <div className="form-row">
                <label>
                  Assigned bus
                  <input value={form.assignedBus} onChange={(event) => setForm({ ...form, assignedBus: event.target.value })} placeholder="BUS 314" />
                </label>
                <label>
                  Assigned route
                  <select value={form.assignedRoute} onChange={(event) => setForm({ ...form, assignedRoute: event.target.value })}>
                    <option value="">Unassigned</option>
                    {routeOptions.map((route) => (
                      <option key={route} value={route}>
                        {route}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="form-row">
                <label>
                  Salary rate
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.salaryRate}
                    onChange={(event) => setForm({ ...form, salaryRate: event.target.value })}
                  />
                </label>
                <label>
                  Salary type
                  <select value={form.salaryType} onChange={(event) => setForm({ ...form, salaryType: event.target.value as EmployeeSalaryType })}>
                    {salaryTypeOptions.map((type) => (
                      <option key={type} value={type}>
                        {titleCase(type)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="employee-upload-grid">
                <label className="upload-tile">
                  <Upload size={16} />
                  <span>Upload profile photo</span>
                  <input type="file" accept="image/*" onChange={(event) => uploadAsset(event, "photo")} />
                </label>
                <label className="upload-tile">
                  <Upload size={16} />
                  <span>Upload signature</span>
                  <input type="file" accept="image/*" onChange={(event) => uploadAsset(event, "signature")} />
                </label>
              </div>

              <div className="inline-actions">
                <button type="button" className="soft-button" onClick={() => setEditing(null)}>
                  Cancel
                </button>
                <button type="submit" className="primary-action" disabled={isSaving}>
                  Save employee
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}
