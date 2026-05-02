"use client";

import { FormEvent, useCallback, useState } from "react";
import type { RouteConfig } from "@pos-bus/shared";
import { MapPinned, Pencil, Plus, Route as RouteIcon } from "lucide-react";
import { api } from "@/services/api";
import { useApiResource } from "@/hooks/useApiResource";
import { AppShell } from "@/components/layout/AppShell";
import { DataTable } from "@/components/ui/DataTable";
import { formatPeso } from "@/utils/format";

const emptyForm = {
  origin: "",
  destination: "",
  price: "",
  distance: ""
};

export function RouteConfigPage() {
  const [direction, setDirection] = useState<RouteConfig["direction"]>("forward");
  const [editing, setEditing] = useState<RouteConfig | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState<string | null>(null);
  const loadRoutes = useCallback(() => api.routes(direction), [direction]);
  const routes = useApiResource(loadRoutes);
  const rows = routes.data || [];

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    const payload = {
      direction,
      origin: form.origin,
      destination: form.destination,
      price: Number(form.price),
      distance: form.distance ? Number(form.distance) : undefined
    };

    try {
      if (editing) {
        await api.updateRoute(editing.id, payload);
      } else {
        await api.createRoute(payload);
      }
      setForm(emptyForm);
      setEditing(null);
      await routes.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save route.");
    }
  };

  const editRoute = (route: RouteConfig) => {
    setEditing(route);
    setDirection(route.direction);
    setForm({
      origin: route.origin,
      destination: route.destination,
      price: String(route.price),
      distance: route.distance ? String(route.distance) : ""
    });
  };

  return (
    <AppShell title="Route Config" kicker="Fare table and route mapper">
      <section className="route-layout">
        <div className="command-card route-editor-card">
          <div className="section-heading compact">
            <div>
              <span>{editing ? "Edit existing route" : "Add route segment"}</span>
              <h2>Fare route editor</h2>
            </div>
            <RouteIcon size={20} />
          </div>

          <div className="segmented-control" role="tablist" aria-label="Route direction">
            <button
              type="button"
              className={direction === "forward" ? "active" : ""}
              onClick={() => setDirection("forward")}
            >
              Forward
            </button>
            <button
              type="button"
              className={direction === "reverse" ? "active" : ""}
              onClick={() => setDirection("reverse")}
            >
              Reverse
            </button>
          </div>

          <form className="stacked-form" onSubmit={submit}>
            <label>
              Origin
              <input
                value={form.origin}
                onChange={(event) => setForm((current) => ({ ...current, origin: event.target.value }))}
                placeholder="FVR Terminal"
                required
              />
            </label>
            <label>
              Destination
              <input
                value={form.destination}
                onChange={(event) => setForm((current) => ({ ...current, destination: event.target.value }))}
                placeholder="SM Fairview"
                required
              />
            </label>
            <div className="form-row">
              <label>
                Fare
                <input
                  value={form.price}
                  onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="25.00"
                  required
                />
              </label>
              <label>
                Distance km
                <input
                  value={form.distance}
                  onChange={(event) => setForm((current) => ({ ...current, distance: event.target.value }))}
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="5.8"
                />
              </label>
            </div>
            {message ? <p className="form-error">{message}</p> : null}
            <button className="primary-action" type="submit">
              {editing ? <Pencil size={17} /> : <Plus size={17} />}
              {editing ? "Update route" : "Add route"}
            </button>
          </form>
        </div>

        <section className="route-map-card">
          <div className="section-heading compact">
            <div>
              <span>Mapper preview</span>
              <h2>Route line planner</h2>
            </div>
            <MapPinned size={20} />
          </div>
          <div className="route-editor-map">
            {rows.slice(0, 5).map((route, index) => (
              <div key={route.id} className="route-node" style={{ left: `${12 + index * 18}%`, top: `${26 + (index % 2) * 26}%` }}>
                <strong>{index + 1}</strong>
                <span>{route.origin}</span>
              </div>
            ))}
            <div className="route-editor-line" />
          </div>
        </section>
      </section>

      <section className="command-card">
        <div className="section-heading compact">
          <div>
            <span>{direction} loop</span>
            <h2>Route fare table</h2>
          </div>
        </div>
        <DataTable
          rows={rows}
          getRowKey={(row) => row.id}
          columns={[
            { header: "Key", cell: (row) => <strong>{row.id}</strong> },
            { header: "Origin", cell: (row) => row.origin },
            { header: "Destination", cell: (row) => row.destination },
            { header: "Fare", cell: (row) => formatPeso(row.price) },
            { header: "Distance", cell: (row) => (row.distance ? `${row.distance} km` : "Not set") },
            {
              header: "Action",
              cell: (row) => (
                <button type="button" className="soft-button table-action" onClick={() => editRoute(row)}>
                  <Pencil size={14} /> Edit
                </button>
              )
            }
          ]}
        />
      </section>
    </AppShell>
  );
}
