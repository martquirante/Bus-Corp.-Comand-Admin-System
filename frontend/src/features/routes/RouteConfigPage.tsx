"use client";

import { FormEvent, useCallback, useMemo, useState } from "react";
import type { RouteConfig } from "@pos-bus/shared";
import { ExternalLink, Maximize2, Minimize2, Pencil, Plus, Route as RouteIcon } from "lucide-react";
import { api } from "@/services/api";
import { useApiResource } from "@/hooks/useApiResource";
import { AppShell } from "@/components/layout/AppShell";
import { DataTable } from "@/components/ui/DataTable";
import { formatPeso } from "@/utils/format";

const emptyForm = {
  routeName: "",
  origin: "",
  destination: "",
  price: "",
  distanceKm: "",
  estimatedDurationMinutes: "",
  baseFare: "",
  farePerKm: "",
  mapReferenceUrl: "",
  assignedBusId: "",
  assignedTripScheduleId: "",
  stopsText: "FVR Terminal, GMA Kamuning, ST. CRUZ",
  status: "active",
  isViceVersa: false
};

export function RouteConfigPage() {
  const [direction, setDirection] = useState<RouteConfig["direction"]>("forward");
  const [editing, setEditing] = useState<RouteConfig | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [showLegacyFareMatrix, setShowLegacyFareMatrix] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const loadRoutes = useCallback(() => api.routes(), []);
  const loadLegacyForward = useCallback(() => api.getLegacyRoutesForward(), []);
  const loadLegacyReverse = useCallback(() => api.getLegacyRoutesReverse(), []);
  const routes = useApiResource(loadRoutes);
  const legacyForward = useApiResource(loadLegacyForward);
  const legacyReverse = useApiResource(loadLegacyReverse);
  const rows = useMemo(() => routes.data || [], [routes.data]);
  const routeGroups = useMemo(
    () => [
      {
        id: "pitx",
        title: "FVR <-> PITX via GMA",
        routes: rows.filter((route) => route.id.includes("pitx"))
      },
      {
        id: "st-cruz",
        title: "FVR <-> ST. CRUZ",
        routes: rows.filter((route) => route.id.includes("st-cruz"))
      }
    ],
    [rows]
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    const payload = {
      direction,
      routeName: form.routeName || `${form.origin} to ${form.destination}`,
      origin: form.origin,
      destination: form.destination,
      price: Number(form.price),
      distance: form.distanceKm ? Number(form.distanceKm) : undefined,
      distanceKm: form.distanceKm ? Number(form.distanceKm) : undefined,
      estimatedDurationMinutes: form.estimatedDurationMinutes
        ? Number(form.estimatedDurationMinutes)
        : undefined,
      baseFare: form.baseFare ? Number(form.baseFare) : Number(form.price),
      farePerKm: form.farePerKm ? Number(form.farePerKm) : 0,
      mapReferenceUrl: form.mapReferenceUrl,
      assignedBusId: form.assignedBusId,
      assignedTripScheduleId: form.assignedTripScheduleId,
      stops: form.stopsText
        .split(",")
        .map((name, index) => ({ id: `stop-${index + 1}`, name: name.trim(), sequence: index + 1 }))
        .filter((stop) => stop.name),
      status: form.status as RouteConfig["status"],
      isViceVersa: form.isViceVersa
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
      routeName: route.routeName || `${route.origin} to ${route.destination}`,
      origin: route.origin,
      destination: route.destination,
      price: String(route.price),
      distanceKm: route.distanceKm || route.distance ? String(route.distanceKm || route.distance) : "",
      estimatedDurationMinutes: route.estimatedDurationMinutes ? String(route.estimatedDurationMinutes) : "",
      baseFare: route.baseFare ? String(route.baseFare) : String(route.price || ""),
      farePerKm: route.farePerKm ? String(route.farePerKm) : "",
      mapReferenceUrl: route.mapReferenceUrl || "",
      assignedBusId: route.assignedBusId || "",
      assignedTripScheduleId: route.assignedTripScheduleId || "",
      stopsText: (route.stops || []).map((stop) => stop.name).filter(Boolean).join(", "),
      status: route.status || "active",
      isViceVersa: Boolean(route.isViceVersa)
    });
  };

  const setStatus = async (route: RouteConfig, status: RouteConfig["status"]) => {
    if (!status) return;
    setMessage(null);

    try {
      await api.updateRouteStatus(route.id, status);
      await routes.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update route status.");
    }
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
              Route name
              <input
                value={form.routeName}
                onChange={(event) => setForm((current) => ({ ...current, routeName: event.target.value }))}
                placeholder="FVR Terminal to GMA Kamuning"
              />
            </label>
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
                  value={form.distanceKm}
                  onChange={(event) => setForm((current) => ({ ...current, distanceKm: event.target.value }))}
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="5.8"
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Base fare
                <input
                  value={form.baseFare}
                  onChange={(event) => setForm((current) => ({ ...current, baseFare: event.target.value }))}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="25.00"
                />
              </label>
              <label>
                Fare per km
                <input
                  value={form.farePerKm}
                  onChange={(event) => setForm((current) => ({ ...current, farePerKm: event.target.value }))}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="2.00"
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Duration min
                <input
                  value={form.estimatedDurationMinutes}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, estimatedDurationMinutes: event.target.value }))
                  }
                  type="number"
                  min="0"
                  step="1"
                  placeholder="45"
                />
              </label>
              <label>
                Status
                <select
                  value={form.status}
                  onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
            </div>
            <label>
              Bus stops
              <input
                value={form.stopsText}
                onChange={(event) => setForm((current) => ({ ...current, stopsText: event.target.value }))}
                placeholder="FVR Terminal, GMA Kamuning, ST. CRUZ"
              />
            </label>
            <label>
              Google Maps reference
              <input
                value={form.mapReferenceUrl}
                onChange={(event) => setForm((current) => ({ ...current, mapReferenceUrl: event.target.value }))}
                placeholder="https://maps.app.goo.gl/..."
              />
            </label>
            <div className="form-row">
              <label>
                Bus assignment
                <input
                  value={form.assignedBusId}
                  onChange={(event) => setForm((current) => ({ ...current, assignedBusId: event.target.value }))}
                  placeholder="BUS 101"
                />
              </label>
              <label>
                Trip schedule
                <input
                  value={form.assignedTripScheduleId}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, assignedTripScheduleId: event.target.value }))
                  }
                  placeholder="Morning peak"
                />
              </label>
            </div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.isViceVersa}
                onChange={(event) => setForm((current) => ({ ...current, isViceVersa: event.target.checked }))}
              />
              Supports vice versa direction
            </label>
            {message ? <p className="form-error">{message}</p> : null}
            <button className="primary-action" type="submit">
              {editing ? <Pencil size={17} /> : <Plus size={17} />}
              {editing ? "Update route" : "Add route"}
            </button>
          </form>
        </div>

        <section className={`route-map-card ${isMapFullscreen ? "is-fullscreen" : ""}`}>
          <div className="section-heading compact">
            <div>
              <span>Mapper preview</span>
              <h2>Route line planner</h2>
            </div>
            <button type="button" className="soft-button compact-button" onClick={() => setIsMapFullscreen((value) => !value)}>
              {isMapFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              {isMapFullscreen ? "Back" : "Fullscreen"}
            </button>
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
            <span>AdminRoutes production source</span>
            <h2>Live route groups</h2>
          </div>
        </div>
        <div className="route-group-grid">
          {routeGroups.map((group) => (
            <article key={group.id} className="route-group-card">
              <strong>{group.title}</strong>
              <span>{group.routes.length} directions</span>
              <div>
                {group.routes.map((route) => (
                  <button key={route.id} type="button" className="soft-button compact-button" onClick={() => editRoute(route)}>
                    {route.direction === "reverse" ? "Reverse" : "Forward"} - {(route.waypoints || []).length} pts
                  </button>
                ))}
                {!group.routes.length ? <p className="empty-note">Waiting for AdminRoutes data.</p> : null}
              </div>
            </article>
          ))}
        </div>
        <DataTable
          rows={rows}
          getRowKey={(row) => row.id}
          columns={[
            {
              header: "Route",
              cell: (row) => (
                <div className="route-table-title">
                  <strong>{row.routeName || row.id}</strong>
                  <span>{row.source || "admin"}</span>
                </div>
              )
            },
            { header: "Origin", cell: (row) => row.origin },
            { header: "Destination", cell: (row) => row.destination },
            { header: "Fare", cell: (row) => formatPeso(row.price) },
            { header: "Distance", cell: (row) => (row.distanceKm || row.distance ? `${row.distanceKm || row.distance} km` : "Not set") },
            { header: "Status", cell: (row) => <span className={`status-pill status-${row.status || "active"}`}>{row.status || "active"}</span> },
            {
              header: "Map",
              cell: (row) =>
                row.mapReferenceUrl ? (
                  <a className="table-link" href={row.mapReferenceUrl} target="_blank" rel="noreferrer">
                    Reference <ExternalLink size={13} />
                  </a>
                ) : (
                  "Not set"
                )
            },
            {
              header: "Action",
              cell: (row) => (
                <div className="table-action-row">
                  <button type="button" className="soft-button table-action" onClick={() => editRoute(row)}>
                    <Pencil size={14} /> Edit
                  </button>
                  <button
                    type="button"
                    className="soft-button table-action"
                    onClick={() => setStatus(row, row.status === "active" ? "inactive" : "active")}
                  >
                    {row.status === "active" ? "Disable" : "Activate"}
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
            <span>Advanced reference only</span>
            <h2>Legacy fare matrix</h2>
          </div>
          <button type="button" className="soft-button compact-button" onClick={() => setShowLegacyFareMatrix((value) => !value)}>
            {showLegacyFareMatrix ? "Hide legacy fare matrix" : "Show legacy fare matrix"}
          </button>
        </div>
        {showLegacyFareMatrix ? (
          <DataTable
            rows={[...(legacyForward.data || []), ...(legacyReverse.data || [])]}
            getRowKey={(row) => row.id}
            columns={[
              { header: "Direction", cell: (row) => row.direction },
              { header: "Origin", cell: (row) => row.origin },
              { header: "Destination", cell: (row) => row.destination },
              { header: "Fare", cell: (row) => formatPeso(row.price) },
              { header: "Source", cell: (row) => row.legacyPath || "Routes_Forward/Reverse" }
            ]}
          />
        ) : (
          <p className="empty-note">
            Routes_Forward and Routes_Reverse stay hidden here because they are fare matrix references, not main map route lines.
          </p>
        )}
      </section>
    </AppShell>
  );
}
