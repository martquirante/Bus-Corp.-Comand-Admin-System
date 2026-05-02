"use client";

import { FormEvent, useCallback, useMemo, useState } from "react";
import type { AdminAccount } from "@pos-bus/shared";
import { KeyRound, Plus, ShieldCheck, UserCog } from "lucide-react";
import { api } from "@/services/api";
import { useApiResource } from "@/hooks/useApiResource";
import { AppShell } from "@/components/layout/AppShell";
import { DataTable } from "@/components/ui/DataTable";

const roleOptions: AdminAccount["role"][] = ["Conductor", "Driver", "Inspector", "Admin", "SuperAdmin"];

export function AdminToolsPage() {
  const loadAccounts = useCallback(() => api.adminAccounts(), []);
  const accounts = useApiResource(loadAccounts);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    role: "Conductor" as AdminAccount["role"],
    password: ""
  });
  const [message, setMessage] = useState<string | null>(null);

  const rows = useMemo(() => {
    const list = accounts.data || [];
    if (!query) return list;
    return list.filter((account) =>
      `${account.fullName} ${account.email} ${account.role}`.toLowerCase().includes(query.toLowerCase())
    );
  }, [accounts.data, query]);

  const createAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    try {
      await api.createAdmin({
        fullName: form.fullName,
        email: form.email,
        role: form.role,
        status: "active",
        password: form.password || undefined
      });
      setForm({ fullName: "", email: "", role: "Conductor", password: "" });
      await accounts.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create account.");
    }
  };

  return (
    <AppShell title="Admin Tools" kicker="Workforce access and sensitive settings">
      <section className="admin-grid">
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
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, email, role" />
            </label>
          </div>
          <DataTable
            rows={rows}
            getRowKey={(row) => `${row.status}:${row.id}`}
            columns={[
              { header: "Name", cell: (row) => <strong>{row.fullName}</strong> },
              { header: "Email", cell: (row) => row.email },
              { header: "Role", cell: (row) => row.role },
              { header: "Status", cell: (row) => <span className={`status-pill status-${row.status}`}>{row.status}</span> }
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
                onChange={(event) =>
                  setForm((current) => ({ ...current, role: event.target.value as AdminAccount["role"] }))
                }
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
                  placeholder="POS-1234"
                />
                <button
                  type="button"
                  className="soft-button"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      password: `POS-${Math.floor(1000 + Math.random() * 9000)}`
                    }))
                  }
                >
                  <KeyRound size={14} />
                </button>
              </div>
            </label>
            {message ? <p className="form-error">{message}</p> : null}
            <button className="primary-action" type="submit">
              <Plus size={17} /> Create account
            </button>
          </form>
        </section>
      </section>
    </AppShell>
  );
}
