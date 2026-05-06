"use client";

import { FormEvent, useCallback, useState } from "react";
import type { BusFleetRecord } from "@pos-bus/shared";
import { BusFront, Plus, Wrench } from "lucide-react";
import { api } from "@/services/api";
import { useApiResource } from "@/hooks/useApiResource";
import { AppShell } from "@/components/layout/AppShell";
import { DataTable } from "@/components/ui/DataTable";

const emptyBus = {
  busNumber: "",
  plateNumber: "",
  busType: "aircon",
  routeLine: "FVR to ST.CRUZ",
  seatingCapacity: "45",
  standingCapacity: "15",
  fuelType: "Diesel",
  status: "active"
};

export function BusFleetPage() {
  const [form, setForm] = useState(emptyBus);
  const [message, setMessage] = useState<string | null>(null);
  const loadBuses = useCallback(() => api.buses(), []);
  const buses = useApiResource(loadBuses);
  const rows = buses.data || [];

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    try {
      await api.createBus({
        busNumber: form.busNumber,
        plateNumber: form.plateNumber,
        busType: form.busType,
        routeLine: form.routeLine,
        seatingCapacity: Number(form.seatingCapacity),
        standingCapacity: Number(form.standingCapacity),
        fuelType: form.fuelType,
        status: form.status as BusFleetRecord["status"]
      });
      setForm(emptyBus);
      await buses.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save bus.");
    }
  };

  const setStatus = async (bus: BusFleetRecord, status: BusFleetRecord["status"]) => {
    await api.patchBus(bus.id, { status });
    await buses.refresh();
  };

  return (
    <AppShell title="Bus Fleet Management" kicker="Fleet records, assignment, capacity, and maintenance readiness">
      <section className="admin-grid">
        <section className="command-card">
          <div className="section-heading compact">
            <div>
              <span>Firebase path: AdminBuses</span>
              <h2>Add bus record</h2>
            </div>
            <BusFront size={20} />
          </div>
          <form className="stacked-form" onSubmit={submit}>
            <div className="form-row">
              <label>
                Bus number
                <input required value={form.busNumber} onChange={(event) => setForm((value) => ({ ...value, busNumber: event.target.value }))} placeholder="BUS 314" />
              </label>
              <label>
                Plate number
                <input value={form.plateNumber} onChange={(event) => setForm((value) => ({ ...value, plateNumber: event.target.value }))} placeholder="ABC 1234" />
              </label>
            </div>
            <div className="form-row">
              <label>
                Bus type
                <select value={form.busType} onChange={(event) => setForm((value) => ({ ...value, busType: event.target.value }))}>
                  <option value="aircon">Aircon bus</option>
                  <option value="ordinary">Ordinary bus</option>
                </select>
              </label>
              <label>
                Route line
                <select value={form.routeLine} onChange={(event) => setForm((value) => ({ ...value, routeLine: event.target.value }))}>
                  <option>FVR to ST.CRUZ</option>
                  <option>FVR to PITX via GMA</option>
                </select>
              </label>
            </div>
            <div className="form-row">
              <label>
                Seating capacity
                <input type="number" min="0" value={form.seatingCapacity} onChange={(event) => setForm((value) => ({ ...value, seatingCapacity: event.target.value }))} />
              </label>
              <label>
                Standing capacity
                <input type="number" min="0" value={form.standingCapacity} onChange={(event) => setForm((value) => ({ ...value, standingCapacity: event.target.value }))} />
              </label>
            </div>
            <div className="form-row">
              <label>
                Fuel type
                <input value={form.fuelType} onChange={(event) => setForm((value) => ({ ...value, fuelType: event.target.value }))} />
              </label>
              <label>
                Status
                <select value={form.status} onChange={(event) => setForm((value) => ({ ...value, status: event.target.value }))}>
                  <option value="active">Active</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="inactive">Inactive</option>
                  <option value="offline">Offline</option>
                </select>
              </label>
            </div>
            {message ? <p className="form-error">{message}</p> : null}
            <button type="submit" className="primary-action">
              <Plus size={17} /> Save bus
            </button>
          </form>
        </section>

        <section className="command-card">
          <div className="section-heading compact">
            <div>
              <span>Image upload</span>
              <h2>Storage setup</h2>
            </div>
            <Wrench size={20} />
          </div>
          <p className="quiet-copy">
            Bus photo upload is prepared for Firebase Storage. Configure Storage rules and bucket credentials before enabling production uploads.
          </p>
        </section>
      </section>

      <section className="command-card">
        <div className="section-heading compact">
          <div>
            <span>{rows.length} buses</span>
            <h2>Fleet registry</h2>
          </div>
        </div>
        <DataTable
          rows={rows}
          getRowKey={(row) => row.id}
          columns={[
            { header: "Bus", cell: (row) => <strong>{row.busNumber}</strong> },
            { header: "Plate", cell: (row) => row.plateNumber || "Not set" },
            { header: "Type", cell: (row) => (row.busType || "aircon").toString().toLowerCase() === "ordinary" ? "Ordinary" : "Aircon" },
            { header: "Route", cell: (row) => row.routeLine || "Unassigned" },
            { header: "Capacity", cell: (row) => `${row.seatingCapacity || 0} seated / ${row.standingCapacity || 0} standing` },
            { header: "Fuel", cell: (row) => row.fuelType || "Not set" },
            { header: "Status", cell: (row) => <span className={`status-pill status-${row.status}`}>{row.status}</span> },
            {
              header: "Action",
              cell: (row) => (
                <button type="button" className="soft-button table-action" onClick={() => setStatus(row, row.status === "active" ? "maintenance" : "active")}>
                  {row.status === "active" ? "Set maintenance" : "Activate"}
                </button>
              )
            }
          ]}
        />
      </section>
    </AppShell>
  );
}
