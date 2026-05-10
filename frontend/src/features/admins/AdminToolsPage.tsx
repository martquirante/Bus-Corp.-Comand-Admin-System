"use client";

import { FormEvent, useCallback, useMemo, useState } from "react";
import type { AdminAccount } from "@pos-bus/shared";
import { Edit3, KeyRound, Plus, Power, RefreshCcw, ShieldCheck, UserCog, X } from "lucide-react";
import { api } from "@/services/api";
import { useApiResource } from "@/hooks/useApiResource";
import { AppShell } from "@/components/layout/AppShell";
import { DataTable } from "@/components/ui/DataTable";

const roleOptions: AdminAccount["role"][] = ["Admin", "Driver", "Conductor", "Inspector"];

const temporaryPassword = () => `POS-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

const emptyForm = () => ({
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

export function AdminToolsPage() {
  const loadAccounts = useCallback(() => api.adminAccounts(), []);
  const accounts = useApiResource(loadAccounts);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<EditForm | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const rows = useMemo(() => {
    const list = accounts.data || [];
    if (!query) return list;
    return list.filter((account) =>
      `${account.fullName} ${account.email} ${account.role} ${account.status}`.toLowerCase().includes(query.toLowerCase())
    );
  }, [accounts.data, query]);

  const createAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setIsSaving(true);

    try {
      await api.createAdmin({
        fullName: form.fullName,
        email: form.email,
        role: form.role,
        status: "active",
        password: form.password
      });
      setMessage(`Created account for ${form.fullName}. Temporary password: ${form.password}`);
      setForm(emptyForm());
      await accounts.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create account.");
    } finally {
      setIsSaving(false);
    }
  };

  const openEdit = (account: AdminAccount) => {
    setMessage(null);
    setEditing({
      id: account.id,
      fullName: account.fullName,
      email: account.email,
      role: account.role,
      status: account.status
    });
  };

  const saveEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    setIsSaving(true);
    setMessage(null);

    try {
      await api.patchAdmin(editing.id, {
        fullName: editing.fullName,
        email: editing.email,
        role: editing.role,
        status: editing.status
      });
      setEditing(null);
      await accounts.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update account.");
    } finally {
      setIsSaving(false);
    }
  };

  const resetPassword = async (account: AdminAccount) => {
    const nextPassword = temporaryPassword();
    setMessage(null);
    await api.patchAdmin(account.id, { password: nextPassword });
    setMessage(`Temporary password reset for ${account.fullName}: ${nextPassword}`);
    await accounts.refresh();
  };

  const toggleStatus = async (account: AdminAccount) => {
    const status = account.status === "active" ? "inactive" : "active";
    setMessage(null);
    await api.patchAdmin(account.id, { status });
    await accounts.refresh();
  };

  return (
    <AppShell title="Admin Tools" kicker="Login account, access, and password control">
      <section className="admin-grid account-admin-grid">
        <section className="command-card">
          <div className="section-heading compact">
            <div>
              <span>Access control</span>
              <h2>Admin and workforce accounts</h2>
            </div>
            <ShieldCheck size={20} />
          </div>
          <div className="filter-bar single">
            <label>
              Search accounts
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, email, role, status" />
            </label>
          </div>
          <DataTable
            rows={rows}
            getRowKey={(row) => `${row.status}:${row.id}`}
            columns={[
              { header: "Name", cell: (row) => <strong>{row.fullName}</strong> },
              { header: "Email", cell: (row) => row.email },
              { header: "Role", cell: (row) => row.role },
              { header: "Status", cell: (row) => <span className={`status-pill status-${row.status}`}>{row.status}</span> },
              {
                header: "Actions",
                cell: (row) => (
                  <div className="table-action-row">
                    <button type="button" className="soft-button table-action" onClick={() => openEdit(row)}>
                      <Edit3 size={14} /> Edit
                    </button>
                    <button type="button" className="soft-button table-action" onClick={() => resetPassword(row)}>
                      <KeyRound size={14} /> Reset
                    </button>
                    <button type="button" className="soft-button table-action" onClick={() => toggleStatus(row)}>
                      <Power size={14} /> {row.status === "active" ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                )
              }
            ]}
          />
        </section>

        <section className="command-card">
          <div className="section-heading compact">
            <div>
              <span>New account</span>
              <h2>Create access</h2>
            </div>
            <UserCog size={20} />
          </div>
          <form className="stacked-form" onSubmit={createAccount}>
            <label>
              Full name
              <input
                value={form.fullName}
                onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                required
              />
            </label>
            <label>
              Email
              <input
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                type="email"
                required
              />
            </label>
            <label>
              Role
              <select
                value={form.role}
                onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as AdminAccount["role"] }))}
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
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  required
                />
                <button
                  type="button"
                  className="soft-button"
                  aria-label="Regenerate temporary password"
                  onClick={() => setForm((current) => ({ ...current, password: temporaryPassword() }))}
                >
                  <RefreshCcw size={14} />
                </button>
              </div>
            </label>
            {message ? <p className="form-error account-message">{message}</p> : null}
            <button className="primary-action" type="submit" disabled={isSaving}>
              <Plus size={17} /> Create account
            </button>
          </form>
        </section>
      </section>

      {editing ? (
        <div className="modal-backdrop" role="presentation">
          <section className="command-card modal-panel" role="dialog" aria-modal="true" aria-labelledby="edit-account-title">
            <div className="section-heading compact">
              <div>
                <span>Login account</span>
                <h2 id="edit-account-title">Edit account</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setEditing(null)} aria-label="Close edit account">
                <X size={18} />
              </button>
            </div>
            <form className="stacked-form" onSubmit={saveEdit}>
              <label>
                Full name
                <input value={editing.fullName} onChange={(event) => setEditing({ ...editing, fullName: event.target.value })} required />
              </label>
              <label>
                Email
                <input value={editing.email} onChange={(event) => setEditing({ ...editing, email: event.target.value })} type="email" required />
              </label>
              <div className="form-row">
                <label>
                  Role
                  {editing.role === "SuperAdmin" ? (
                    <input value="SuperAdmin" disabled className="locked-input" />
                  ) : (
                    <select value={editing.role} onChange={(event) => setEditing({ ...editing, role: event.target.value as AdminAccount["role"] })}>
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
                  <select value={editing.status} onChange={(event) => setEditing({ ...editing, status: event.target.value as AdminAccount["status"] })}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="pending">Pending</option>
                  </select>
                </label>
              </div>
              <div className="inline-actions">
                <button type="button" className="soft-button" onClick={() => setEditing(null)}>
                  Cancel
                </button>
                <button type="submit" className="primary-action" disabled={isSaving}>
                  Save account
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}
