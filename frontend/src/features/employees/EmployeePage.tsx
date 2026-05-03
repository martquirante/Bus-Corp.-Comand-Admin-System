"use client";

import { FormEvent, useCallback, useState } from "react";
import type { EmployeeRecord } from "@pos-bus/shared";
import { IdCard, Plus } from "lucide-react";
import { api } from "@/services/api";
import { useApiResource } from "@/hooks/useApiResource";
import { AppShell } from "@/components/layout/AppShell";
import { DataTable } from "@/components/ui/DataTable";

const emptyEmployee = {
  employeeNumber: "",
  fullName: "",
  role: "conductor",
  phone: "",
  address: "",
  salaryRate: "",
  salaryType: "daily",
  assignedBusId: "",
  assignedRouteId: "",
  status: "active"
};

export function EmployeePage() {
  const [form, setForm] = useState(emptyEmployee);
  const [message, setMessage] = useState<string | null>(null);
  const loadEmployees = useCallback(() => api.employees(), []);
  const employees = useApiResource(loadEmployees);
  const rows = employees.data || [];

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    try {
      await api.createEmployee({
        employeeNumber: form.employeeNumber,
        fullName: form.fullName,
        role: form.role as EmployeeRecord["role"],
        phone: form.phone,
        address: form.address,
        salaryRate: form.salaryRate ? Number(form.salaryRate) : undefined,
        salaryType: form.salaryType as EmployeeRecord["salaryType"],
        assignedBusId: form.assignedBusId,
        assignedRouteId: form.assignedRouteId,
        status: form.status as EmployeeRecord["status"]
      });
      setForm(emptyEmployee);
      await employees.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save employee.");
    }
  };

  const toggleStatus = async (employee: EmployeeRecord) => {
    await api.patchEmployee(employee.id, { status: employee.status === "active" ? "inactive" : "active" });
    await employees.refresh();
  };

  return (
    <AppShell title="Employee" kicker="Digital IDs, role assignment, and dispatch pairing">
      <section className="admin-grid">
        <section className="command-card">
          <div className="section-heading compact">
            <div>
              <span>Firebase path: AdminEmployees</span>
              <h2>Create employee profile</h2>
            </div>
            <IdCard size={20} />
          </div>
          <form className="stacked-form" onSubmit={submit}>
            <div className="form-row">
              <label>
                Employee number
                <input required value={form.employeeNumber} onChange={(event) => setForm((value) => ({ ...value, employeeNumber: event.target.value }))} placeholder="EMP-0001" />
              </label>
              <label>
                Full name
                <input required value={form.fullName} onChange={(event) => setForm((value) => ({ ...value, fullName: event.target.value }))} placeholder="Juan Dela Cruz" />
              </label>
            </div>
            <div className="form-row">
              <label>
                Role
                <select value={form.role} onChange={(event) => setForm((value) => ({ ...value, role: event.target.value }))}>
                  <option value="admin">Admin</option>
                  <option value="conductor">Conductor</option>
                  <option value="driver">Driver</option>
                  <option value="inspector">Inspector</option>
                  <option value="mechanic">Mechanic</option>
                </select>
              </label>
              <label>
                Phone
                <input value={form.phone} onChange={(event) => setForm((value) => ({ ...value, phone: event.target.value }))} placeholder="09xx xxx xxxx" />
              </label>
            </div>
            <label>
              Address
              <input value={form.address} onChange={(event) => setForm((value) => ({ ...value, address: event.target.value }))} placeholder="Home address" />
            </label>
            <div className="form-row">
              <label>
                Salary rate
                <input type="number" min="0" value={form.salaryRate} onChange={(event) => setForm((value) => ({ ...value, salaryRate: event.target.value }))} />
              </label>
              <label>
                Salary type
                <select value={form.salaryType} onChange={(event) => setForm((value) => ({ ...value, salaryType: event.target.value }))}>
                  <option value="daily">Daily</option>
                  <option value="monthly">Monthly</option>
                  <option value="trip">Per trip</option>
                  <option value="hourly">Hourly</option>
                </select>
              </label>
            </div>
            <div className="form-row">
              <label>
                Assigned bus
                <input value={form.assignedBusId} onChange={(event) => setForm((value) => ({ ...value, assignedBusId: event.target.value }))} placeholder="BUS 314" />
              </label>
              <label>
                Assigned route
                <select value={form.assignedRouteId} onChange={(event) => setForm((value) => ({ ...value, assignedRouteId: event.target.value }))}>
                  <option value="">Unassigned</option>
                  <option value="fvr-stcruz">FVR to ST.CRUZ</option>
                  <option value="fvr-pitx-gma">FVR to PITX via GMA</option>
                </select>
              </label>
            </div>
            {message ? <p className="form-error">{message}</p> : null}
            <button type="submit" className="primary-action">
              <Plus size={17} /> Save employee
            </button>
          </form>
        </section>

        <section className="company-id-card">
          <span>Company Digital ID Preview</span>
          <strong>{form.fullName || "Employee Name"}</strong>
          <p>{form.employeeNumber || "EMP-0000"}</p>
          <small>{form.role.toUpperCase()} • POS BUS</small>
        </section>
      </section>

      <section className="command-card">
        <div className="section-heading compact">
          <div>
            <span>{rows.length} employees</span>
            <h2>Workforce registry</h2>
          </div>
        </div>
        <DataTable
          rows={rows}
          getRowKey={(row) => row.id}
          columns={[
            { header: "Employee", cell: (row) => <strong>{row.fullName}</strong> },
            { header: "ID", cell: (row) => row.employeeNumber },
            { header: "Role", cell: (row) => row.role },
            { header: "Phone", cell: (row) => row.phone || "Not set" },
            { header: "Bus", cell: (row) => row.assignedBusId || "Unassigned" },
            { header: "Route", cell: (row) => row.assignedRouteId || "Unassigned" },
            { header: "Status", cell: (row) => <span className={`status-pill status-${row.status}`}>{row.status}</span> },
            {
              header: "Action",
              cell: (row) => (
                <button type="button" className="soft-button table-action" onClick={() => toggleStatus(row)}>
                  {row.status === "active" ? "Deactivate" : "Activate"}
                </button>
              )
            }
          ]}
        />
      </section>
    </AppShell>
  );
}
