"use client";

import { FormEvent, useCallback, useMemo, useState, useRef, useEffect } from "react";
import type { AdminAccount, EmployeeRecord } from "@pos-bus/shared";
import { Edit3, KeyRound, Plus, Power, RefreshCcw, ShieldCheck, UserCog, X, Search, ChevronDown } from "lucide-react";
import { api } from "@/services/api";
import { useApiResource } from "@/hooks/useApiResource";
import { AppShell } from "@/components/layout/AppShell";
import { Portal } from "@/components/ui/Portal";

// ─── Types ────────────────────────────────────────────────────────────────────

type MergedRow = {
  key: string;
  employee: EmployeeRecord | null;
  account: AdminAccount | null;
  displayName: string;
  displayEmail: string;
  displayRole: string;
  displayStatus: string;
  hasAccount: boolean;
};

type AccountFilter = "all" | "active" | "no-account" | "inactive";
type RoleFilter = "all" | "Driver" | "Conductor" | "Admin" | "SuperAdmin" | "Inspector";

const roleOptions: AdminAccount["role"][] = ["Admin", "Driver", "Conductor", "Inspector"];
const temporaryPassword = () =>
  `POS-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

type CreateForm = {
  employeeId?: string;
  employeeNumber?: string;
  fullName: string;
  email: string;
  role: AdminAccount["role"];
  password: string;
};

const emptyCreateForm = (): CreateForm => ({
  fullName: "",
  email: "",
  role: "Conductor",
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
      displayEmail: matchedAccount?.email || emp.email || "",
      displayName: emp.fullName || matchedAccount?.fullName || "—",
      displayRole: matchedAccount?.role || toAdminRole(emp.role) || emp.role || "—",
      displayStatus: matchedAccount ? matchedAccount.status : "no-account",
      hasAccount: matchedAccount !== null
    });
  }

  for (const acct of accounts) {
    if (usedAccountIds.has(acct.id)) continue;
    rows.push({
      key: acct.id,
      employee: null,
      account: acct,
      displayEmail: acct.email || "",
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
  const [form, setForm] = useState<CreateForm>(emptyCreateForm());
  const [editing, setEditing] = useState<EditForm | null>(null);
  const [selectedRow, setSelectedRow] = useState<MergedRow | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [comboSearch, setComboSearch] = useState("");
  const [showCombo, setShowCombo] = useState(false);
  const comboRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (comboRef.current && !comboRef.current.contains(event.target as Node)) {
        setShowCombo(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const refreshAll = async () => {
    await Promise.all([accounts.refresh(), employees.refresh()]);
  };

  const mergedRows = useMemo(
    () => mergeLists(employees.data || [], accounts.data || []),
    [employees.data, accounts.data]
  );

  const filteredRows = useMemo(() => {
    return mergedRows.filter((row) => {
      const matchQuery =
        !query ||
        `${row.displayName} ${row.displayEmail} ${row.displayRole} ${row.displayStatus} ${row.employee?.employeeNumber || ""}`
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

  const comboOptions = useMemo(() => {
    const q = comboSearch.toLowerCase();
    return mergedRows
      .filter((r) => r.employee)
      .filter((r) => {
        if (!q) return true;
        const e = r.employee!;
        return (
          e.fullName.toLowerCase().includes(q) ||
          (e.employeeNumber && e.employeeNumber.toLowerCase().includes(q)) ||
          (e.email && e.email.toLowerCase().includes(q)) ||
          e.role.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.hasAccount === b.hasAccount) {
          return a.displayName.localeCompare(b.displayName);
        }
        return a.hasAccount ? 1 : -1;
      });
  }, [mergedRows, comboSearch]);

  const selectEmployee = (row: MergedRow) => {
    const emp = row.employee;
    if (!emp) return;

    setSelectedRow(row);
    setComboSearch(emp.fullName);
    setShowCombo(false);
    setMessage(null);
    setIsSuccess(false);

    setForm((prev) => ({
      ...prev,
      employeeId: emp.id,
      employeeNumber: emp.employeeNumber || "",
      fullName: emp.fullName,
      email: row.account?.email || emp.email || "",
      role: toAdminRole(emp.role) || "Conductor"
    }));
  };

  const selectRow = (row: MergedRow) => {
    if (row.employee) {
      selectEmployee(row);
      return;
    }

    setSelectedRow(row);
    setComboSearch("");
    setForm(emptyCreateForm());
    setMessage(null);
    setIsSuccess(false);
  };

  const createAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedRow?.employee) {
      setMessage("Please select a valid employee from the list.");
      setIsSuccess(false);
      return;
    }

    if (selectedRow.hasAccount) {
      setMessage("This employee already has a login account.");
      setIsSuccess(false);
      return;
    }

    setMessage(null);
    setIsSuccess(false);
    setIsSaving(true);

    try {
      await api.createAdmin({
        employeeId: form.employeeId,
        employeeNumber: form.employeeNumber,
        fullName: form.fullName,
        email: form.email,
        role: form.role,
        status: "active",
        password: form.password
      });
      setMessage(`✓ Account created for ${form.fullName}. Temp password: ${form.password}`);
      setIsSuccess(true);
      setForm(emptyCreateForm());
      setComboSearch("");
      setSelectedRow(null);
      await refreshAll();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create account.");
      setIsSuccess(false);
    } finally {
      setIsSaving(false);
    }
  };

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

  const toggleStatus = async (row: MergedRow) => {
    if (!row.account) return;
    const status = row.account.status === "active" ? "inactive" : "active";
    await api.patchAdmin(row.account.id, { status });
    await refreshAll();
  };

  const hasExistingAccount = Boolean(selectedRow?.employee && selectedRow.hasAccount);

  return (
    <AppShell
      title="Admin Tools"
      kicker="Login accounts, access control, and workforce sync"
      mainClassName="admin-tools-shell"
    >
      <section className="admin-tools-grid">
        {/* Left: list */}
        <section className="command-card admin-account-panel">
          <div className="section-heading compact">
            <div>
              <span>{filteredRows.length} of {mergedRows.length} records</span>
              <h2>Admin and workforce accounts</h2>
            </div>
            <ShieldCheck size={20} />
          </div>

          <div className="admin-account-toolbar">
            <div className="admin-tools-search">
              <Search size={16} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, email, role, status…"
              />
            </div>

            <div className="admin-filter-controls">
              <label>
                Account status
                <select
                  value={accountFilter}
                  onChange={(e) => setAccountFilter(e.target.value as AccountFilter)}
                >
                  <option value="all">All accounts</option>
                  <option value="active">Active</option>
                  <option value="no-account">No account</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>

              <label>
                Role
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
                >
                  <option value="all">All roles</option>
                  <option value="Driver">Driver</option>
                  <option value="Conductor">Conductor</option>
                  <option value="Admin">Admin</option>
                  <option value="Inspector">Inspector</option>
                </select>
              </label>
            </div>
          </div>

          {/* Custom Account List */}
          <div className="admin-account-list">
            {filteredRows.length === 0 ? (
              <div className="fleet-empty">
                <p>No workforce accounts found.</p>
              </div>
            ) : (
              filteredRows.map((row) => (
                <article
                  key={row.key}
                  className={`admin-account-row ${selectedRow?.key === row.key ? "selected" : ""}`}
                  onClick={() => selectRow(row)}
                >
                  <div className="admin-account-card-main">
                    <div className="admin-account-person">
                      <strong>{row.displayName}</strong>
                      <span>{row.employee?.employeeNumber || row.account?.employeeNumber || "No employee ID"}</span>
                      {!row.hasAccount ? <small>No login account yet</small> : null}
                    </div>

                    <div className="admin-account-email">
                      <span>Login Email</span>
                      <strong>{row.displayEmail || "No email set"}</strong>
                    </div>

                    <div className="admin-account-badges">
                      <span className="admin-role-badge">{row.displayRole}</span>
                      {row.hasAccount ? (
                        <span className={`status-pill status-${row.displayStatus}`}>
                          {row.displayStatus}
                        </span>
                      ) : (
                        <span className="status-pill status-no-account">No Account</span>
                      )}
                    </div>
                  </div>

                  <div className="admin-account-actions">
                    <div className="admin-account-action-set">
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
                          onClick={(e) => { e.stopPropagation(); selectEmployee(row); }}
                        >
                          <Plus size={14} /> Create access
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        {/* Right: create access form */}
        <section className="command-card admin-access-panel">
          <div className="section-heading compact">
            <div>
              <span>New account setup</span>
              <h2>Create access</h2>
            </div>
            <UserCog size={20} />
          </div>

          <form className="stacked-form" onSubmit={createAccount}>
            {/* Combobox for Employee selection */}
            <div className="admin-employee-combobox" ref={comboRef}>
              <label>
                Select Employee *
                <div className="admin-employee-picker" onClick={() => setShowCombo(true)}>
                  <Search size={16} />
                  <input
                    value={comboSearch}
                    onChange={(e) => {
                      setComboSearch(e.target.value);
                      setShowCombo(true);
                      if (e.target.value === "" && selectedRow) {
                        setSelectedRow(null);
                        setForm(emptyCreateForm());
                      }
                    }}
                    onFocus={() => setShowCombo(true)}
                    placeholder="Search by name, ID, email, role..."
                  />
                  {comboSearch && (
                    <button
                      type="button"
                      className="admin-picker-clear"
                      onClick={(e) => {
                        e.stopPropagation();
                        setComboSearch("");
                        setSelectedRow(null);
                        setForm(emptyCreateForm());
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                  {!comboSearch && <ChevronDown size={16} />}
                </div>
              </label>

              {showCombo && (
                <div className="admin-employee-options">
                  {comboOptions.length > 0 ? (
                    comboOptions.map((row) => (
                      <button
                        key={row.key}
                        type="button"
                        className="admin-employee-option"
                        onClick={() => selectEmployee(row)}
                      >
                        <div style={{ flex: 1 }}>
                          <strong>{row.displayName}</strong>
                          <small>
                            ID: {row.employee?.employeeNumber || "—"} &bull; {row.displayRole}
                          </small>
                        </div>
                        <em>
                          {row.hasAccount ? row.displayStatus : "No Account"}
                        </em>
                      </button>
                    ))
                  ) : (
                    <div className="admin-employee-empty">No employees found.</div>
                  )}
                </div>
              )}
            </div>

            {selectedRow?.employee ? (
              <div className="admin-selected-employee">
                <div>
                  <span>Name</span>
                  <strong>{selectedRow.displayName}</strong>
                </div>
                <div>
                  <span>ID Number</span>
                  <strong>{selectedRow.employee.employeeNumber || "N/A"}</strong>
                </div>
                <div>
                  <span>Role</span>
                  <strong>{selectedRow.displayRole}</strong>
                </div>
                <div>
                  <span>Email</span>
                  <strong>{selectedRow.employee.email || "—"}</strong>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <span>Account Status</span>
                  <strong className={selectedRow.hasAccount ? "" : "form-success"}>
                    {selectedRow.hasAccount ? selectedRow.displayStatus : "No Account"}
                  </strong>
                </div>
              </div>
            ) : null}

            <div className="form-readonly-header">
              <label>
                Full name
                <input value={form.fullName} readOnly className="locked-input" placeholder="Auto-filled from employee" required />
              </label>
              <label>
                Employee Number
                <input value={form.employeeNumber || ""} readOnly className="locked-input" placeholder="Auto-filled" />
              </label>
            </div>

            <label>
              Email
              <input
                value={form.email}
                onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))}
                type="email"
                required
                readOnly={!!selectedRow?.employee?.email}
                className={selectedRow?.employee?.email ? "locked-input" : ""}
                placeholder={selectedRow?.employee?.email ? "" : "Enter email for account"}
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

            {hasExistingAccount && (
              <p className="form-error penalty-warning" style={{ marginTop: 0 }}>
                This employee already has a login account.
              </p>
            )}

            {message ? (
              <p className={`form-error account-message ${isSuccess ? "form-success rem-exact" : ""}`} style={{ color: isSuccess ? "var(--green)" : "var(--red)" }}>
                {message}
              </p>
            ) : null}

            <button
              className="primary-action"
              type="submit"
              disabled={isSaving || !selectedRow?.employee || hasExistingAccount}
            >
              <Plus size={17} />
              {isSaving
                ? "Creating…"
                : selectedRow?.employee
                  ? `Create access for ${selectedRow.employee.fullName.split(' ')[0]}`
                  : "Create account"}
            </button>
          </form>
        </section>
      </section>

      {/* Edit modal */}
      {editing ? (
        <Portal>
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
        </Portal>
      ) : null}
    </AppShell>
  );
}
