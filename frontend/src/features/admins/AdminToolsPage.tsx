"use client";

import { FormEvent, useCallback, useMemo, useState } from "react";
import type { AdminAccount, EmployeeRecord } from "@pos-bus/shared";
import { Edit3, KeyRound, Plus, Power, RefreshCcw, ShieldCheck, UserCog, Users, X } from "lucide-react";
import { api } from "@/services/api";
import { useApiResource } from "@/hooks/useApiResource";
import { AppShell } from "@/components/layout/AppShell";
import { DataTable } from "@/components/ui/DataTable";

// ─── Types ────────────────────────────────────────────────────────────────────

type MergedRow = {
  key: string;
  employee: EmployeeRecord | null;
  account: AdminAccount | null;
  displayName: string;
  displayRole: string;
  displayStatus: string;
  hasAccount: boolean;
};

type AccountFilter = "all" | "active" | "no-account" | "inactive";
type RoleFilter = "all" | "Driver" | "Conductor" | "Admin" | "SuperAdmin" | "Inspector";

const roleOptions: AdminAccount["role"][] = ["Admin", "Driver", "Conductor", "Inspector"];
const temporaryPassword = () =>
  `POS-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

const emptyCreateForm = () => ({
  fullName: "",
  email: "",
  role: "Conductor" as AdminAccount["role"],
  password: temporaryPassword()
});

type EditForm = {
  id: string;
  fullName: string;
  email: string;
  role: AdminAccount["role"];
  status: AdminAccount["status"];
};

// ─── Merge logic ──────────────────────────────────────────────────────────────

const mergeLists = (employees: EmployeeRecord[], accounts: AdminAccount[]): MergedRow[] => {
  const rows: MergedRow[] = [];
  const usedAccountIds = new Set<string>();

  // For each employee, try to find a matching account
  for (const emp of employees) {
    const matchedAccount =
      accounts.find(
        (a) =>
          a.id === emp.accountId ||
          a.employeeId === emp.id ||
          (emp.email && a.email?.toLowerCase() === emp.email.toLowerCase()) ||
          (emp.employeeNumber && a.employeeNumber === emp.employeeNumber)
      ) || null;

    if (matchedAccount) usedAccountIds.add(matchedAccount.id);

    rows.push({
      key: emp.id,
      employee: emp,
      account: matchedAccount,
      displayName: emp.fullName || matchedAccount?.fullName || "—",
      displayRole: matchedAccount?.role || toAdminRole(emp.role) || emp.role || "—",
      displayStatus: matchedAccount ? matchedAccount.status : "no-account",
      hasAccount: matchedAccount !== null
    });
  }

  // Add accounts that have no matching employee
  for (const acct of accounts) {
    if (usedAccountIds.has(acct.id)) continue;
    rows.push({
      key: acct.id,
      employee: null,
      account: acct,
      displayName: acct.fullName || "—",
      displayRole: acct.role || "—",
      displayStatus: acct.status,
      hasAccount: true
    });
  }

  return rows.sort((a, b) => a.displayName.localeCompare(b.displayName));
};

const toAdminRole = (employeeRole?: string): AdminAccount["role"] | null => {
  if (!employeeRole) return null;
  const map: Record<string, AdminAccount["role"]> = {
    admin: "Admin",
    driver: "Driver",
    conductor: "Conductor",
    inspector: "Inspector"
  };
  return map[employeeRole.toLowerCase()] || null;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function AdminToolsPage() {
  const loadAccounts = useCallback(() => api.adminAccounts(), []);
  const loadEmployees = useCallback(() => api.employees(), []);
  const accounts = useApiResource(loadAccounts);
  const employees = useApiResource(loadEmployees);

  const [accountFilter, setAccountFilter] = useState<AccountFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(emptyCreateForm);
  const [editing, setEditing] = useState<EditForm | null>(null);
  const [selectedRow, setSelectedRow] = useState<MergedRow | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const refreshAll = async () => {
    await Promise.all([accounts.refresh(), employees.refresh()]);
  };

  // Merge employees + accounts
  const mergedRows = useMemo(
    () => mergeLists(employees.data || [], accounts.data || []),
    [employees.data, accounts.data]
  );

  // Filtered rows
  const filteredRows = useMemo(() => {
    return mergedRows.filter((row) => {
      const matchQuery =
        !query ||
        `${row.displayName} ${row.displayRole} ${row.displayStatus} ${row.employee?.employeeNumber || ""} ${row.account?.email || ""}`
          .toLowerCase()
          .includes(query.toLowerCase());

      const matchAccount =
        accountFilter === "all" ||
        (accountFilter === "no-account" && !row.hasAccount) ||
        (accountFilter === "active" && row.account?.status === "active") ||
        (accountFilter === "inactive" && row.account?.status === "inactive");

      const matchRole =
        roleFilter === "all" ||
        row.displayRole === roleFilter ||
        (roleFilter === "Admin" && (row.displayRole === "Admin" || row.displayRole === "SuperAdmin"));

      return matchQuery && matchAccount && matchRole;
    });
  }, [mergedRows, query, accountFilter, roleFilter]);

  // Create account
  const createAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setIsSuccess(false);
    setIsSaving(true);

    try {
      await api.createAdmin({
        fullName: form.fullName,
        email: form.email,
        role: form.role,
        status: "active",
        password: form.password
      });
      setMessage(`✓ Account created for ${form.fullName}. Temp password: ${form.password}`);
      setIsSuccess(true);
      setForm(emptyCreateForm());
      setSelectedRow(null);
      await refreshAll();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create account.");
      setIsSuccess(false);
    } finally {
      setIsSaving(false);
    }
  };

  // Open edit
  const openEdit = (row: MergedRow) => {
    if (!row.account) return;
    setMessage(null);
    setIsSuccess(false);
    setEditing({
      id: row.account.id,
      fullName: row.account.fullName,
      email: row.account.email,
      role: row.account.role,
      status: row.account.status
    });
  };

  // Save edit
  const saveEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    setIsSaving(true);
    setMessage(null);
    setIsSuccess(false);

    try {
      await api.patchAdmin(editing.id, {
        fullName: editing.fullName,
        email: editing.email,
        role: editing.role,
        status: editing.status
      });
      setEditing(null);
      await refreshAll();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update account.");
    } finally {
      setIsSaving(false);
    }
  };

  // Reset password
  const resetPassword = async (row: MergedRow) => {
    if (!row.account) return;
    const nextPassword = temporaryPassword();
    setMessage(null);
    setIsSuccess(false);
    await api.patchAdmin(row.account.id, { password: nextPassword });
    setMessage(`✓ Temp password for ${row.displayName}: ${nextPassword}`);
    setIsSuccess(true);
    await refreshAll();
  };

  // Toggle status
  const toggleStatus = async (row: MergedRow) => {
    if (!row.account) return;
    const status = row.account.status === "active" ? "inactive" : "active";
    await api.patchAdmin(row.account.id, { status });
    await refreshAll();
  };

  // Select row to prefill create form
  const selectRow = (row: MergedRow) => {
    setSelectedRow(row);
    if (!row.hasAccount) {
      // Prefill create form from employee data
      setForm({
        fullName: row.employee?.fullName || "",
        email: row.employee?.email || "",
        role: toAdminRole(row.employee?.role) || "Conductor",
        password: temporaryPassword()
      });
      setMessage(null);
      setIsSuccess(false);
    }
  };

  return (
    <AppShell title="Admin Tools" kicker="Login accounts, access control, and workforce sync">
      <section className="admin-grid account-admin-grid">
        {/* Left: table */}
        <section className="command-card">
          <div className="section-heading compact">
            <div>
              <span>{filteredRows.length} of {mergedRows.length} records</span>
              <h2>Admin and workforce accounts</h2>
            </div>
            <ShieldCheck size={20} />
          </div>

          {/* Search */}
          <div className="filter-bar single" style={{ marginBottom: 10 }}>
            <label>
              Search
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, email, role, status…"
              />
            </label>
          </div>

          {/* Account status filter chips */}
          <div className="admin-chip-row">
            {(["all", "active", "no-account", "inactive"] as AccountFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                className={`emp-chip ${accountFilter === f ? "active" : ""}`}
                onClick={() => setAccountFilter(f)}
              >
                {f === "no-account" ? "No Account" : f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
            <span className="admin-chip-sep" />
            {(["all", "Driver", "Conductor", "Admin", "Inspector"] as RoleFilter[]).map((r) => (
              <button
                key={r}
                type="button"
                className={`emp-chip ${roleFilter === r ? "active" : ""}`}
                onClick={() => setRoleFilter(r)}
              >
                {r === "all" ? "All Roles" : r}
              </button>
            ))}
          </div>

          <DataTable
            rows={filteredRows}
            getRowKey={(row) => row.key}
            onRowClick={selectRow}
            selectedRowKey={selectedRow?.key}
            columns={[
              {
                header: "Name",
                cell: (row) => (
                  <span className="admin-name-cell">
                    <strong>{row.displayName}</strong>
                    {row.employee?.employeeNumber ? (
                      <span className="admin-emp-num">{row.employee.employeeNumber}</span>
                    ) : null}
                  </span>
                )
              },
              {
                header: "Email",
                cell: (row) => row.account?.email || row.employee?.email || <em>—</em>
              },
              { header: "Role", cell: (row) => row.displayRole },
              {
                header: "Account",
                cell: (row) =>
                  row.hasAccount ? (
                    <span className={`status-pill status-${row.displayStatus}`}>{row.displayStatus}</span>
                  ) : (
                    <span className="status-pill status-no-account">No account</span>
                  )
              },
              {
                header: "Actions",
                cell: (row) => (
                  <div className="table-action-row">
                    {row.hasAccount ? (
                      <>
                        <button
                          type="button"
                          className="soft-button table-action"
                          onClick={(e) => { e.stopPropagation(); openEdit(row); }}
                        >
                          <Edit3 size={14} /> Edit
                        </button>
                        <button
                          type="button"
                          className="soft-button table-action"
                          onClick={(e) => { e.stopPropagation(); void resetPassword(row); }}
                        >
                          <KeyRound size={14} /> Reset
                        </button>
                        <button
                          type="button"
                          className="soft-button table-action"
                          onClick={(e) => { e.stopPropagation(); void toggleStatus(row); }}
                        >
                          <Power size={14} />
                          {row.account?.status === "active" ? "Deactivate" : "Activate"}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="primary-action table-action"
                        onClick={(e) => { e.stopPropagation(); selectRow(row); }}
                      >
                        <Plus size={14} /> Create access
                      </button>
                    )}
                  </div>
                )
              }
            ]}
          />
        </section>

        {/* Right: create access form */}
        <section className="command-card">
          <div className="section-heading compact">
            <div>
              <span>{selectedRow && !selectedRow.hasAccount ? `Prefilled for ${selectedRow.displayName}` : "New account"}</span>
              <h2>Create access</h2>
            </div>
            <UserCog size={20} />
          </div>

          {selectedRow && !selectedRow.hasAccount ? (
            <div className="admin-prefill-notice">
              <Users size={14} />
              <span>Prefilled from employee record. Review and confirm before creating.</span>
            </div>
          ) : null}

          <form className="stacked-form" onSubmit={createAccount}>
            <label>
              Full name
              <input
                value={form.fullName}
                onChange={(e) => setForm((c) => ({ ...c, fullName: e.target.value }))}
                required
              />
            </label>
            <label>
              Email
              <input
                value={form.email}
                onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))}
                type="email"
                required
              />
            </label>
            <label>
              Role
              <select
                value={form.role}
                onChange={(e) => setForm((c) => ({ ...c, role: e.target.value as AdminAccount["role"] }))}
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Temporary password
              <div className="field-with-button">
                <input
                  value={form.password}
                  onChange={(e) => setForm((c) => ({ ...c, password: e.target.value }))}
                  required
                />
                <button
                  type="button"
                  className="soft-button"
                  aria-label="Regenerate password"
                  onClick={() => setForm((c) => ({ ...c, password: temporaryPassword() }))}
                >
                  <RefreshCcw size={14} />
                </button>
              </div>
            </label>

            {message ? (
              <p className={`form-error account-message ${isSuccess ? "form-success" : ""}`}>{message}</p>
            ) : null}

            <button className="primary-action" type="submit" disabled={isSaving}>
              <Plus size={17} /> {isSaving ? "Creating…" : "Create account"}
            </button>
          </form>
        </section>
      </section>

      {/* Edit modal */}
      {editing ? (
        <div className="modal-backdrop" role="presentation">
          <section
            className="command-card modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-account-title"
          >
            <div className="section-heading compact">
              <div>
                <span>Login account</span>
                <h2 id="edit-account-title">Edit account</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setEditing(null)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <form className="stacked-form" onSubmit={saveEdit}>
              <label>
                Full name
                <input
                  value={editing.fullName}
                  onChange={(e) => setEditing({ ...editing, fullName: e.target.value })}
                  required
                />
              </label>
              <label>
                Email
                <input
                  value={editing.email}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                  type="email"
                  required
                />
              </label>
              <div className="form-row">
                <label>
                  Role
                  {editing.role === "SuperAdmin" ? (
                    <input value="SuperAdmin" disabled className="locked-input" />
                  ) : (
                    <select
                      value={editing.role}
                      onChange={(e) => setEditing({ ...editing, role: e.target.value as AdminAccount["role"] })}
                    >
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  )}
                </label>
                <label>
                  Status
                  <select
                    value={editing.status}
                    onChange={(e) =>
                      setEditing({ ...editing, status: e.target.value as AdminAccount["status"] })
                    }
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="pending">Pending</option>
                  </select>
                </label>
              </div>
              {message && !isSuccess ? <p className="form-error">{message}</p> : null}
              <div className="inline-actions">
                <button type="button" className="soft-button" onClick={() => setEditing(null)}>
                  Cancel
                </button>
                <button type="submit" className="primary-action" disabled={isSaving}>
                  {isSaving ? "Saving…" : "Save account"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}
