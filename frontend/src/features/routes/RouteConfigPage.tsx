"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { RouteConfig } from "@pos-bus/shared";
import {
  Eye,
  EyeOff,
  MapPinned,
  Pencil,
  Plus,
  RefreshCw,
  Route as RouteIcon,
  Save,
  Waypoints
} from "lucide-react";
import { api } from "@/services/api";
import { useApiResource } from "@/hooks/useApiResource";
import { AppShell } from "@/components/layout/AppShell";
import { DataTable } from "@/components/ui/DataTable";
import { RoutePreviewMap } from "@/components/map/RoutePreviewMap";
import { formatNumber, formatPeso } from "@/utils/format";
import { formatFarePeso } from "@/utils/ltfrbFare";
import {
  getPrimaryRouteForLine,
  getRouteDisplayName,
  getRouteStopsLabel,
  groupMainRouteLines,
  normalizeRouteLabel,
  filterFareStopsBySelectedLine,
  getFareStopLineId
} from "@/utils/routeLines";

const defaultRouteStops: Record<string, string[]> = {
  "fvr-pitx": [
    "FVR Terminal",
    "GMA Kamuning",
    "Cubao",
    "Ortigas",
    "Guadalupe",
    "Ayala",
    "MOA",
    "PITX"
  ],
  "fvr-stcruz": ["FVR Terminal", "Muzon", "ST. CRUZ"]
};

const getSuggestedStops = (route: RouteConfig) => {
  if (route.stops?.length) {
    return route.stops.map((stop) => normalizeRouteLabel(stop.name)).filter(Boolean).join(", ");
  }

  const lower = `${route.origin} ${route.destination}`.toLowerCase();
  if (lower.includes("pitx") || lower.includes("gma")) return defaultRouteStops["fvr-pitx"].join(", ");
  if (lower.includes("st. cruz") || lower.includes("muzon") || lower.includes("sjdm")) return defaultRouteStops["fvr-stcruz"].join(", ");
  return (route.stops || []).map((stop) => normalizeRouteLabel(stop.name)).filter(Boolean).join(", ");
};

const formatDuration = (minutesStr: string | number) => {
  const mins = Number(minutesStr);
  if (!mins || isNaN(mins)) return "";
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  if (remainingMins === 0) return `${hrs} hr`;
  return `${hrs} hr ${remainingMins} min`;
};

const formatWholePeso = (value?: number | string | null) => {
  const num = Number(value);
  if (isNaN(num)) return "Not set";
  return `₱${Math.round(num)}`;
};

const emptyForm = {
  origin: "",
  destination: "",
  price: "",
  distanceKm: "",
  estimatedDurationMinutes: "",
  baseFare: "",
  farePerKm: "",
  status: "active",
  mapReferenceUrl: ""
};

export function RouteConfigPage() {
  const [direction, setDirection] = useState<RouteConfig["direction"]>("forward");
  const [editing, setEditing] = useState<RouteConfig | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<"fvr-pitx" | "fvr-stcruz">("fvr-pitx");
  const [showHiddenRoutes, setShowHiddenRoutes] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [showAllRoutesOnMap, setShowAllRoutesOnMap] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState<string | null>(null);
  const [routeMetrics, setRouteMetrics] = useState<Record<string, { distanceKm?: number; estimatedDurationMinutes?: number }>>({});

  const loadRoutes = useCallback(() => api.routes(), []);
  const loadLegacyForward = useCallback(() => api.getLegacyRoutesForward(), []);
  const loadLegacyReverse = useCallback(() => api.getLegacyRoutesReverse(), []);

  const routes = useApiResource(loadRoutes);
  const legacyForward = useApiResource(loadLegacyForward);
  const legacyReverse = useApiResource(loadLegacyReverse);

  const rows = useMemo(() => routes.data || [], [routes.data]);
  const routeLines = useMemo(() => groupMainRouteLines(rows), [rows]);
  const visibleLines = routeLines.filter((line) => line.id !== "hidden");
  const hiddenLine = routeLines.find((line) => line.id === "hidden");

  const selectedLine = visibleLines.find((line) => line.id === selectedLineId) || visibleLines[0];
  const selectedRoute = getPrimaryRouteForLine(selectedLine, direction);

  const allLegacy = useMemo(() => [...(legacyForward.data || []), ...(legacyReverse.data || [])], [legacyForward.data, legacyReverse.data]);
  const visibleFareMatrixRows = useMemo(
    () => filterFareStopsBySelectedLine(allLegacy, selectedLineId).filter((row) => row.direction === direction),
    [allLegacy, selectedLineId, direction]
  );

  useEffect(() => {
    if (!selectedRoute) return;
    const metrics = routeMetrics[selectedRoute.id];
    if (!metrics) return;

    setForm((current) => ({
      ...current,
      distanceKm: current.distanceKm || (metrics.distanceKm ? String(metrics.distanceKm) : ""),
      estimatedDurationMinutes:
        current.estimatedDurationMinutes || (metrics.estimatedDurationMinutes ? String(metrics.estimatedDurationMinutes) : "")
    }));
  }, [selectedRoute?.id, routeMetrics]);

  const mapRoutes = useMemo(() => showAllRoutesOnMap ? rows : (selectedRoute ? [selectedRoute] : []), [showAllRoutesOnMap, rows, selectedRoute]);

  const fillFormFromRoute = (route: RouteConfig) => {
    setEditing(route);
    setSelectedRouteId(route.id);
    setDirection(route.direction);
    setShowEditor(true);

    if (route.source === "legacy") {
      const detectedLineId = getFareStopLineId(route);
      if (detectedLineId === "fvr-pitx" || detectedLineId === "fvr-stcruz") {
        setSelectedLineId(detectedLineId);
        setMessage(null);
      } else {
        setMessage("This fare stop is not linked to a main line yet.");
      }
    } else {
      setMessage(null);
    }

    setForm({
      origin: normalizeRouteLabel(route.origin),
      destination: normalizeRouteLabel(route.destination),
      price: String(route.price || ""),
      distanceKm: route.distanceKm || route.distance ? String(route.distanceKm || route.distance) : "",
      estimatedDurationMinutes: route.estimatedDurationMinutes ? String(route.estimatedDurationMinutes) : "",
      baseFare: route.baseFare ? String(route.baseFare) : String(route.price || ""),
      farePerKm: route.farePerKm ? String(route.farePerKm) : "",
      status: route.status || "active",
      mapReferenceUrl: route.mapReferenceUrl || ""
    });
  };

  const selectRouteLine = (lineId: "fvr-pitx" | "fvr-stcruz") => {
    setSelectedLineId(lineId);
    const line = routeLines.find((item) => item.id === lineId);
    const route = line ? getPrimaryRouteForLine(line, direction) : null;

    if (route) fillFormFromRoute(route);
    else {
      setEditing(null);
      setSelectedRouteId(null);
      setForm(emptyForm);
      setShowEditor(false);
    }
  };

  const openCreateFareStop = () => {
    setEditing(null);
    setSelectedRouteId(null);
    setForm(emptyForm);
    setShowEditor(true);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    const routePayload = {
      direction,
      routeName: editing?.source === "legacy" ? editing.routeName : (editing?.routeName || selectedLine?.label || `${form.origin} to ${form.destination}`),
      origin: normalizeRouteLabel(form.origin),
      destination: normalizeRouteLabel(form.destination),
      price: Math.round(Number(form.price) || 0),
      distanceKm: form.distanceKm ? Number(form.distanceKm) : undefined,
      estimatedDurationMinutes: form.estimatedDurationMinutes ? Number(form.estimatedDurationMinutes) : undefined,
      baseFare: Math.round(Number(form.baseFare || form.price) || 0),
      isViceVersa: true,
      mapReferenceUrl: form.mapReferenceUrl || ""
    };

    try {
      if (editing?.source === "legacy" && editing.legacyKey) {
        await api.updateLegacyRoute(editing.direction, editing.legacyKey, routePayload);
        setMessage("Fare stop updated. Conductors will see the updated fare matrix.");
      } else if (editing) {
        await api.updateRoute(editing.id, routePayload);
        setMessage("Route line updated. The live map will use the latest route data.");
      } else {
        await api.createRoute(routePayload);
        setMessage("New route saved as active route data.");
      }

      setEditing(null);
      setForm(emptyForm);
      setShowEditor(false);
      await routes.refresh();
      await legacyForward.refresh();
      await legacyReverse.refresh();
    } catch {
      setMessage("Something went wrong while saving. Please review the form and try again.");
    }
  };

  const setStatus = async (route: RouteConfig, status: RouteConfig["status"]) => {
    if (!status) return;
    setMessage(null);

    try {
      await api.updateRouteStatus(route.id, status);
      await routes.refresh();
      setMessage(status === "active" ? "Route is now visible." : "Route moved to hidden routes.");
    } catch {
      setMessage("We could not update the route status. Please try again.");
    }
  };

  const syncRoute = async (route: RouteConfig) => {
    setMessage(null);

    try {
      await api.syncRouteToSupabase(route.id);
      await routes.refresh();
      setMessage("Route synced successfully.");
    } catch {
      setMessage("Route sync is temporarily unavailable. Please try again later.");
    }
  };

  const highlightRouteId = editing?.source === "legacy" ? selectedRoute?.id : (selectedRouteId || selectedRoute?.id);

  return (
    <AppShell title="Route Config" kicker="Main line planner and fare route editor">
      <section className="legacy-route-config-layout">
        <div className="command-card route-map-workbench">
          <div className="section-heading compact">
            <div>
              <span>Route mapper</span>
              <h2>Main road-aligned route preview</h2>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <div className="segmented-control compact-tabs" style={{ margin: 0 }}>
                <button
                  type="button"
                  className={!showAllRoutesOnMap ? "active" : ""}
                  onClick={() => setShowAllRoutesOnMap(false)}
                  style={{ padding: "4px 8px", fontSize: "12px" }}
                >
                  Selected route
                </button>
                <button
                  type="button"
                  className={showAllRoutesOnMap ? "active" : ""}
                  onClick={() => setShowAllRoutesOnMap(true)}
                  style={{ padding: "4px 8px", fontSize: "12px" }}
                >
                  All saved routes
                </button>
              </div>
              <MapPinned size={22} />
            </div>
          </div>

          <RoutePreviewMap
            routes={mapRoutes}
            selectedRouteId={highlightRouteId}
            onRouteMetrics={(routeId, metrics) =>
              setRouteMetrics((current) => ({
                ...current,
                [routeId]: {
                  ...current[routeId],
                  ...metrics
                }
              }))
            }
            onSaveWaypoints={async (routeId, points, distanceKm, estimatedDurationMinutes) => {
              const waypoints = points.map((p, i) => ({
                id: `wp-${Date.now()}-${i}`,
                lat: p[0],
                lng: p[1],
                sequence: i,
                type: i === 0 ? "origin" : i === points.length - 1 ? "destination" : "waypoint"
              }));
              try {
                await api.updateRoute(routeId, {
                  waypoints,
                  distanceKm,
                  ...(estimatedDurationMinutes ? { estimatedDurationMinutes } : {})
                });
                setMessage("Route path saved successfully.");
                await routes.refresh();
              } catch {
                setMessage("Failed to save route path.");
              }
            }}
          />

          <div className="route-line-tabs">
            {visibleLines.map((line) => (
              <button
                key={line.id}
                type="button"
                className={line.id === selectedLineId ? "active" : ""}
                onClick={() => selectRouteLine(line.id as "fvr-pitx" | "fvr-stcruz")}
              >
                <strong>{line.label}</strong>
                <span>{line.description}</span>
              </button>
            ))}
          </div>
        </div>

        <aside className="command-card active-route-panel">
          <div className="route-panel-header">
            <div>
              <span>Active routes</span>
              <h2>2 main route lines</h2>
            </div>
            <RouteIcon size={22} />
          </div>

          <div className="segmented-control compact-tabs" role="tablist" aria-label="Route direction">
            <button
              type="button"
              className={direction === "forward" ? "active" : ""}
              onClick={() => {
                setDirection("forward");
                const route = getPrimaryRouteForLine(selectedLine, "forward");
                if (route) fillFormFromRoute(route);
              }}
            >
              Forward
            </button>
            <button
              type="button"
              className={direction === "reverse" ? "active" : ""}
              onClick={() => {
                setDirection("reverse");
                const route = getPrimaryRouteForLine(selectedLine, "reverse");
                if (route) fillFormFromRoute(route);
              }}
            >
              Reverse
            </button>
          </div>

          <div className="route-line-list">
            {visibleLines.map((line) => {
              const activeRoute = getPrimaryRouteForLine(line, direction);

              return (
                <article
                  key={line.id}
                  className={`route-line-card ${line.id === selectedLineId ? "selected" : ""}`}
                  onClick={() => selectRouteLine(line.id as "fvr-pitx" | "fvr-stcruz")}
                >
                  <div>
                    <strong>{line.shortLabel}</strong>
                    <span>{line.routes.length} active direction records</span>
                  </div>

                  <div className="route-chip-row">
                    {line.chips.map((chip, index) => (
                      <span key={`${chip}-${index}`}>{chip}</span>
                    ))}
                  </div>

                  <footer>
                    <span>{activeRoute ? formatWholePeso(activeRoute.price) : "No fare"}</span>
                    <button
                      type="button"
                      className="soft-button table-action"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (activeRoute) fillFormFromRoute(activeRoute);
                      }}
                    >
                      <Pencil size={14} /> Edit
                    </button>
                  </footer>
                </article>
              );
            })}
          </div>

          <button
            type="button"
            className="soft-button advanced-route-toggle"
            onClick={() => setShowHiddenRoutes((value) => !value)}
          >
            {showHiddenRoutes ? <EyeOff size={16} /> : <Eye size={16} />}
            {showHiddenRoutes ? "Hide extra route lines" : "Manage extra route lines"}
          </button>
        </aside>
      </section>

      {showEditor ? (
        <section className="route-detail-grid">
          <div className="command-card">
            <div className="section-heading compact">
              <div>
                <span>{editing ? "Edit selected route" : "Add route segment"}</span>
                <h2>Fare route editor</h2>
              </div>
              <Waypoints size={21} />
            </div>

            <form className="stacked-form" onSubmit={submit}>
            <div className="form-readonly-header">
              <label>
                Selected line
                <input
                  value={selectedLine?.label || ""}
                  readOnly
                  placeholder="FVR ↔ PITX"
                  className="locked-input"
                />
              </label>
              <label>
                Direction
                <input
                  value={direction}
                  readOnly
                  placeholder="forward"
                  className="locked-input"
                />
              </label>
              {editing?.source === "legacy" && form.destination && (
                <p className="form-hint friendly-message" style={{ marginTop: "4px", color: "#13a46b", fontWeight: 500 }}>
                  ✓ Editing fare stop: {form.origin} → {form.destination}
                </p>
              )}
            </div>

            <div className="form-row">
              <label>
                Origin
                <input
                  value={form.origin}
                  onChange={(event) => setForm((current) => ({ ...current, origin: event.target.value }))}
                  placeholder="FVR"
                  required
                />
              </label>
              <label>
                Destination / Drop-off
                <input
                  value={form.destination}
                  onChange={(event) => setForm((current) => ({ ...current, destination: event.target.value }))}
                  placeholder="PITX"
                  required
                />
              </label>
            </div>

            <div className="form-row">
              <label>
                Fare (whole peso)
                <input
                  value={form.price}
                  onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
                  type="number"
                  min="1"
                  step="1"
                  placeholder="25"
                  required
                />
              </label>
            </div>

            <div className="form-row">
              <label>
                Distance
                <input
                  value={form.distanceKm}
                  readOnly
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="Auto-computed from route"
                />
              </label>
              <label>
                Duration
                <input
                  value={form.estimatedDurationMinutes ? formatDuration(form.estimatedDurationMinutes) : ""}
                  readOnly
                  type="text"
                  placeholder="Auto-computed from route"
                />
              </label>
            </div>

            <div className="form-row">
              <label>
                Google Maps Link (Reference)
                <input
                  type="url"
                  value={form.mapReferenceUrl}
                  onChange={(event) => setForm((current) => ({ ...current, mapReferenceUrl: event.target.value }))}
                  placeholder="https://maps.app.goo.gl/..."
                />
              </label>
            </div>

            {form.mapReferenceUrl && (
              <p className="form-hint friendly-message">
                Google Maps link is saved as reference. To match it exactly, plot the waypoints manually or use Google Routes API.
              </p>
            )}

            {form.estimatedDurationMinutes && (
              <p className="form-hint friendly-message">
                📍 Estimated: {formatDuration(form.estimatedDurationMinutes)} with traffic
              </p>
            )}

            {message ? <p className="form-error friendly-message">{message}</p> : null}

            <div className="inline-actions">
              <button className="primary-action" type="submit">
                {editing ? <Save size={17} /> : <Plus size={17} />}
                {editing ? "Save route changes" : "Add route"}
              </button>

              <button
                type="button"
                className="soft-button"
                onClick={() => {
                  setEditing(null);
                  setForm(emptyForm);
                  setShowEditor(false);
                  setMessage(null);
                }}
              >
                Close editor
              </button>

              {editing ? (
                <button type="button" className="soft-button" onClick={() => syncRoute(editing)}>
                  <RefreshCw size={16} /> Sync route
                </button>
              ) : null}
            </div>
          </form>
        </div>

        <aside className="command-card selected-route-summary">
          <div className="section-heading compact">
            <div>
              <span>Selected route</span>
              <h2>{selectedRoute ? getRouteDisplayName(selectedRoute) : "No route selected"}</h2>
            </div>
          </div>

          <dl>
            <div>
              <dt>Direction</dt>
              <dd>{selectedRoute?.direction || direction}</dd>
            </div>
            <div>
              <dt>Stops</dt>
              <dd>{getRouteStopsLabel(selectedRoute)}</dd>
            </div>
            <div>
              <dt>Fare</dt>
              <dd>{selectedRoute ? formatWholePeso(selectedRoute.price) : "Not set"}</dd>
            </div>
            <div>
              <dt>Distance</dt>
              <dd>
                {form.distanceKm ? `${formatNumber(Number(form.distanceKm))} km` : selectedRoute?.distanceKm || selectedRoute?.distance
                  ? `${formatNumber(selectedRoute.distanceKm || selectedRoute.distance || 0)} km`
                  : "Not set"}
              </dd>
            </div>
            <div>
              <dt>Duration</dt>
              <dd>{form.estimatedDurationMinutes ? formatDuration(form.estimatedDurationMinutes) : selectedRoute?.estimatedDurationMinutes ? formatDuration(selectedRoute.estimatedDurationMinutes) : "Not set"}</dd>
            </div>
            <div>
              <dt>Waypoints</dt>
              <dd>{formatNumber(selectedRoute?.waypoints?.length || 0)}</dd>
            </div>
          </dl>

          {selectedRoute ? (
            <button type="button" className="soft-button" onClick={() => fillFormFromRoute(selectedRoute)}>
              <Pencil size={15} /> Edit selected route
            </button>
          ) : null}
        </aside>
        </section>
      ) : null}

      <section className="command-card fare-matrix-panel">
        <div className="section-heading compact">
          <div>
            <span>Showing fare stops for: {selectedLine?.label} ({direction})</span>
            <h2>Fare Stop Matrix</h2>
          </div>
        </div>

        {visibleFareMatrixRows.length === 0 ? (
          <p className="friendly-message">No fare stops found for this line and direction yet.</p>
        ) : (
          <DataTable
            rows={visibleFareMatrixRows}
            getRowKey={(row) => row.id}
            columns={[
              { header: "Direction", cell: (row) => row.direction },
              { header: "Origin", cell: (row) => normalizeRouteLabel(row.origin) },
              { header: "Destination / Drop-off", cell: (row) => normalizeRouteLabel(row.destination) },
              { header: "Fare", cell: (row) => formatWholePeso(row.price) },
              { header: "Source", cell: (row) => row.legacyPath || "Routes_Forward/Reverse" },
              {
                header: "Action",
                cell: (row) => (
                  <button type="button" className="soft-button table-action" onClick={() => fillFormFromRoute(row)}>
                    <Pencil size={14} /> Edit fare stop
                  </button>
                )
              }
            ]}
          />
        )}

        <div className="inline-actions" style={{ marginTop: "16px" }}>
          <button type="button" className="soft-button" onClick={openCreateFareStop}>
            <Plus size={17} /> Add fare stop
          </button>
        </div>
      </section>

      {showHiddenRoutes ? (
        <section className="command-card">
          <div className="section-heading compact">
            <div>
              <span>Advanced</span>
              <h2>Hidden / extra route lines</h2>
            </div>
          </div>

          <DataTable
            rows={hiddenLine?.routes || []}
            getRowKey={(row) => row.id}
            columns={[
              { header: "Route", cell: (row) => <strong>{getRouteDisplayName(row)}</strong> },
              { header: "Origin", cell: (row) => normalizeRouteLabel(row.origin) },
              { header: "Destination", cell: (row) => normalizeRouteLabel(row.destination) },
              { header: "Fare", cell: (row) => formatWholePeso(row.price) },
              { header: "Status", cell: (row) => <span className={`status-pill status-${row.status || "inactive"}`}>{row.status || "inactive"}</span> },
              {
                header: "Action",
                cell: (row) => (
                  <div className="table-action-row">
                    <button type="button" className="soft-button table-action" onClick={() => fillFormFromRoute(row)}>
                      <Pencil size={14} /> Edit
                    </button>
                    <button type="button" className="soft-button table-action" onClick={() => setStatus(row, "active")}>
                      <Eye size={14} /> Show
                    </button>
                  </div>
                )
              }
            ]}
          />
        </section>
      ) : null}
    </AppShell>
  );
}