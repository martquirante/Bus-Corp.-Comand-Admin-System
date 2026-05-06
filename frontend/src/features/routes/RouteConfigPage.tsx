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
  Trash2,
  Waypoints
} from "lucide-react";
import { api } from "@/services/api";
import { useApiResource } from "@/hooks/useApiResource";
import { AppShell } from "@/components/layout/AppShell";
import { DataTable } from "@/components/ui/DataTable";
import { RoutePreviewMap } from "@/components/map/RoutePreviewMap";
import { formatNumber } from "@/utils/format";
import {
  ROUTE_GOOGLE_MAP_REFS,
  filterFareStopsBySelectedLine,
  getFareStopLineId,
  getPrimaryRouteForLine,
  getRouteDisplayName,
  getRouteStopsLabel,
  groupMainRouteLines,
  normalizeRouteLabel
} from "@/utils/routeLines";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDuration = (minutesStr: string | number) => {
  const mins = Number(minutesStr);
  if (!mins || isNaN(mins)) return "";
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  if (rem === 0) return `${hrs} hr`;
  return `${hrs} hr ${rem} min`;
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
  status: "active",
  mapReferenceUrl: ""
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export function RouteConfigPage() {
  const [direction, setDirection] = useState<RouteConfig["direction"]>("forward");
  const [editing, setEditing] = useState<RouteConfig | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<"fvr-pitx" | "fvr-stcruz">("fvr-pitx");
  const [showHiddenRoutes, setShowHiddenRoutes] = useState(false);
  // Editor is HIDDEN by default – only opens on "Edit fare stop" / "Add fare stop"
  const [showEditor, setShowEditor] = useState(false);
  const [showAllRoutesOnMap, setShowAllRoutesOnMap] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);
  const [routeMetrics, setRouteMetrics] = useState<
    Record<string, { distanceKm?: number; estimatedDurationMinutes?: number }>
  >({});

  // ─── Delete confirmation state ─────────────────────────────────────────────
  const [deleteConfirmRow, setDeleteConfirmRow] = useState<RouteConfig | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const selectedLine =
    visibleLines.find((line) => line.id === selectedLineId) || visibleLines[0];
  const selectedRoute = getPrimaryRouteForLine(selectedLine, direction);

  const allLegacy = useMemo(
    () => [...(legacyForward.data || []), ...(legacyReverse.data || [])],
    [legacyForward.data, legacyReverse.data]
  );

  // Fare Stop Matrix – filtered by selected LINE then by DIRECTION (separate tabs)
  const visibleFareMatrixRows = useMemo(
    () =>
      filterFareStopsBySelectedLine(allLegacy, selectedLineId).filter(
        (row) => row.direction === direction
      ),
    [allLegacy, selectedLineId, direction]
  );

  // Sync computed metrics into form (read-only distance/duration)
  useEffect(() => {
    if (!selectedRoute) return;
    const metrics = routeMetrics[selectedRoute.id];
    if (!metrics) return;
    setForm((current) => ({
      ...current,
      distanceKm:
        current.distanceKm || (metrics.distanceKm ? String(metrics.distanceKm) : ""),
      estimatedDurationMinutes:
        current.estimatedDurationMinutes ||
        (metrics.estimatedDurationMinutes
          ? String(metrics.estimatedDurationMinutes)
          : "")
    }));
  }, [selectedRoute?.id, routeMetrics]);

  const mapRoutes = useMemo(
    () => (showAllRoutesOnMap ? rows : selectedRoute ? [selectedRoute] : []),
    [showAllRoutesOnMap, rows, selectedRoute]
  );

  // ─── Route line selection ─────────────────────────────────────────────────
  // Does NOT open the editor – selecting a route line only updates the map/matrix.
  const selectRouteLine = (lineId: "fvr-pitx" | "fvr-stcruz") => {
    setSelectedLineId(lineId);
    setShowEditor(false);
    setEditing(null);
    setMessage(null);
    setDeleteConfirmRow(null);
    const line = routeLines.find((item) => item.id === lineId);
    const route = line ? getPrimaryRouteForLine(line, direction) : null;
    if (route) setSelectedRouteId(route.id);
  };

  // ─── Direction tab switching ──────────────────────────────────────────────
  // Does NOT open the editor – just swaps direction view.
  const switchDirection = (dir: RouteConfig["direction"]) => {
    setDirection(dir);
    setDeleteConfirmRow(null);
    const route = getPrimaryRouteForLine(selectedLine, dir);
    if (route) setSelectedRouteId(route.id);
    // Close editor when switching direction to avoid stale edit state
    if (showEditor) {
      setShowEditor(false);
      setEditing(null);
      setForm(emptyForm);
      setMessage(null);
    }
  };

  // ─── Fill form and OPEN editor (Edit buttons only) ───────────────────────
  const fillFormFromRoute = (route: RouteConfig) => {
    setEditing(route);
    setSelectedRouteId(route.id);
    setDirection(route.direction);
    setShowEditor(true);
    setMessage(null);
    setDeleteConfirmRow(null);

    if (route.source === "legacy") {
      const detectedLineId = getFareStopLineId(route);
      if (detectedLineId === "fvr-pitx" || detectedLineId === "fvr-stcruz") {
        setSelectedLineId(detectedLineId);
      }
    }

    // Use route's mapReferenceUrl; fall back to the canonical ref for the line
    const lineRef = ROUTE_GOOGLE_MAP_REFS[selectedLineId];
    setForm({
      origin: normalizeRouteLabel(route.origin),
      destination: normalizeRouteLabel(route.destination),
      price: String(route.price || ""),
      distanceKm:
        route.distanceKm || route.distance ? String(route.distanceKm || route.distance) : "",
      estimatedDurationMinutes: route.estimatedDurationMinutes
        ? String(route.estimatedDurationMinutes)
        : "",
      baseFare: route.baseFare ? String(route.baseFare) : String(route.price || ""),
      status: route.status || "active",
      mapReferenceUrl: route.mapReferenceUrl || lineRef || ""
    });
  };

  // ─── Open editor in CREATE mode (Add fare stop) ───────────────────────────
  const openCreateFareStop = () => {
    setEditing(null);
    setSelectedRouteId(null);
    setShowEditor(true);
    setMessage(null);
    setDeleteConfirmRow(null);
    // Pre-fill the canonical Google Maps reference for the active line
    const lineRef = ROUTE_GOOGLE_MAP_REFS[selectedLineId] || "";
    setForm({ ...emptyForm, mapReferenceUrl: lineRef });
  };

  const closeEditor = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowEditor(false);
    setMessage(null);
  };

  // ─── Delete fare stop ─────────────────────────────────────────────────────
  const requestDeleteFareStop = (row: RouteConfig) => {
    setDeleteConfirmRow(row);
    setMessage(null);
  };

  const cancelDelete = () => setDeleteConfirmRow(null);

  const confirmDeleteFareStop = async () => {
    if (!deleteConfirmRow || !deleteConfirmRow.legacyKey) return;
    setIsDeleting(true);
    setMessage(null);
    try {
      await api.deleteLegacyRoute(deleteConfirmRow.direction, deleteConfirmRow.legacyKey);
      setDeleteConfirmRow(null);
      setMessageIsError(false);
      setMessage("Fare stop deleted. Conductors will no longer see this destination.");
      await legacyForward.refresh();
      await legacyReverse.refresh();
    } catch {
      setMessageIsError(true);
      setMessage("Could not delete fare stop. Please try again.");
      setDeleteConfirmRow(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // ─── Save fare stop (create or update) ───────────────────────────────────
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setMessageIsError(false);

    const routePayload = {
      direction,
      routeName:
        editing?.source === "legacy"
          ? editing.routeName
          : editing?.routeName ||
            selectedLine?.label ||
            `${form.origin} to ${form.destination}`,
      origin: normalizeRouteLabel(form.origin),
      destination: normalizeRouteLabel(form.destination),
      price: Math.round(Number(form.price) || 0),
      distanceKm: form.distanceKm ? Number(form.distanceKm) : undefined,
      estimatedDurationMinutes: form.estimatedDurationMinutes
        ? Number(form.estimatedDurationMinutes)
        : undefined,
      baseFare: Math.round(Number(form.baseFare || form.price) || 0),
      isViceVersa: true,
      mapReferenceUrl: form.mapReferenceUrl || ROUTE_GOOGLE_MAP_REFS[selectedLineId] || "",
      lineId: selectedLineId
    };

    try {
      if (editing?.source === "legacy" && editing.legacyKey) {
        // Edit existing fare stop row in Routes_Forward / Routes_Reverse
        await api.updateLegacyRoute(editing.direction, editing.legacyKey, routePayload);
        setMessage("Fare stop updated. Conductors will see the updated fare matrix.");
      } else if (editing) {
        // Edit AdminRoutes entry
        await api.updateRoute(editing.id, routePayload);
        setMessage("Route line updated. The live map will use the latest route data.");
      } else {
        // NEW fare stop – push to the correct legacy collection
        await api.createLegacyRoute(direction, routePayload);
        setMessage("New fare stop saved. Conductors can now select this destination.");
      }

      closeEditor();
      await routes.refresh();
      await legacyForward.refresh();
      await legacyReverse.refresh();
    } catch {
      setMessageIsError(true);
      setMessage("Something went wrong while saving. Please review the form and try again.");
    }
  };

  // ─── Status toggle (AdminRoutes) ──────────────────────────────────────────
  const setStatus = async (route: RouteConfig, status: RouteConfig["status"]) => {
    if (!status) return;
    setMessage(null);
    try {
      await api.updateRouteStatus(route.id, status);
      await routes.refresh();
      setMessageIsError(false);
      setMessage(
        status === "active" ? "Route is now visible." : "Route moved to hidden routes."
      );
    } catch {
      setMessageIsError(true);
      setMessage("We could not update the route status. Please try again.");
    }
  };

  // ─── Sync to Supabase ─────────────────────────────────────────────────────
  const syncRoute = async (route: RouteConfig) => {
    setMessage(null);
    try {
      await api.syncRouteToSupabase(route.id);
      await routes.refresh();
      setMessageIsError(false);
      setMessage("Route synced successfully.");
    } catch {
      setMessageIsError(true);
      setMessage("Route sync is temporarily unavailable. Please try again later.");
    }
  };

  // ─── Map highlight ────────────────────────────────────────────────────────
  const highlightRouteId =
    editing?.source === "legacy"
      ? selectedRoute?.id
      : selectedRouteId || selectedRoute?.id;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <AppShell title="Route Config" kicker="Main line planner and fare route editor">

      {/* ── Global message banner ── */}
      {message && (
        <div
          className="friendly-message"
          style={{
            marginBottom: "14px",
            color: messageIsError ? "var(--red)" : undefined,
            borderColor: messageIsError ? "rgba(220,61,53,0.3)" : undefined,
            background: messageIsError ? "rgba(220,61,53,0.06)" : undefined
          }}
        >
          {message}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          TOP SECTION: Map + Route Panel (always visible)
      ═══════════════════════════════════════════════════════════ */}
      <section className="legacy-route-config-layout">

        {/* ── Map workbench ── */}
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
                [routeId]: { ...current[routeId], ...metrics }
              }))
            }
            onSaveWaypoints={async (
              routeId,
              points,
              distanceKm,
              estimatedDurationMinutes
            ) => {
              const waypoints = points.map((p, i) => ({
                id: `wp-${Date.now()}-${i}`,
                lat: p[0],
                lng: p[1],
                sequence: i,
                type:
                  i === 0
                    ? ("origin" as const)
                    : i === points.length - 1
                    ? ("destination" as const)
                    : ("waypoint" as const)
              }));
              const lineRef = ROUTE_GOOGLE_MAP_REFS[selectedLineId];
              try {
                // Use explicit "path" endpoint so only path fields are updated
                await api.updateRoutePath(routeId, {
                  waypoints,
                  distanceKm,
                  ...(estimatedDurationMinutes ? { estimatedDurationMinutes } : {}),
                  ...(lineRef ? { googleMapReferenceUrl: lineRef } : {})
                });
                setMessageIsError(false);
                setMessage("Route path saved to Firebase AdminRoutes. Live Fleet Map will use this path.");
                await routes.refresh();
              } catch {
                setMessageIsError(true);
                setMessage("Failed to save route path. Your saved route was not changed.");
              }
            }}
          />

          {/* Route line tabs (selector cards) */}
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

        {/* ── Active route panel (right sidebar) ── */}
        <aside className="command-card active-route-panel">
          <div className="route-panel-header">
            <div>
              <span>Active routes</span>
              <h2>2 main route lines</h2>
            </div>
            <RouteIcon size={22} />
          </div>

          {/* Forward / Reverse tabs */}
          <div className="segmented-control compact-tabs" role="tablist" aria-label="Route direction">
            <button
              type="button"
              className={direction === "forward" ? "active" : ""}
              onClick={() => switchDirection("forward")}
            >
              Forward
            </button>
            <button
              type="button"
              className={direction === "reverse" ? "active" : ""}
              onClick={() => switchDirection("reverse")}
            >
              Reverse
            </button>
          </div>

          {/* Route line cards */}
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
                    <span>
                      {activeRoute ? formatWholePeso(activeRoute.price) : "No fare"}
                    </span>
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
            onClick={() => setShowHiddenRoutes((v) => !v)}
          >
            {showHiddenRoutes ? <EyeOff size={16} /> : <Eye size={16} />}
            {showHiddenRoutes
              ? "Hide extra route lines"
              : "Manage extra route lines"}
          </button>
        </aside>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          FARE ROUTE EDITOR — hidden by default
          Opens only on "Edit fare stop" or "Add fare stop"
      ═══════════════════════════════════════════════════════════ */}
      {showEditor && (
        <section className="route-detail-grid">
          <div className="command-card">
            <div className="section-heading compact">
              <div>
                <span>
                  {editing ? "Edit selected fare stop" : "Add new fare stop"}
                </span>
                <h2>Fare route editor</h2>
              </div>
              <Waypoints size={21} />
            </div>

            <form className="stacked-form" onSubmit={submit}>
              {/* Read-only header – line + direction */}
              <div className="form-readonly-header">
                <label>
                  Selected line
                  <input
                    value={selectedLine?.label || ""}
                    readOnly
                    className="locked-input"
                  />
                </label>
                <label>
                  Direction
                  <input
                    value={direction}
                    readOnly
                    className="locked-input"
                  />
                </label>
                {editing?.source === "legacy" && form.destination && (
                  <p className="form-hint friendly-message" style={{ marginTop: 4 }}>
                    ✓ Editing fare stop: {form.origin} → {form.destination}
                  </p>
                )}
              </div>

              {/* Editable fields */}
              <div className="form-row">
                <label>
                  Origin
                  <input
                    value={form.origin}
                    onChange={(e) =>
                      setForm((c) => ({ ...c, origin: e.target.value }))
                    }
                    placeholder="FVR"
                    required
                  />
                </label>
                <label>
                  Destination / Drop-off
                  <input
                    value={form.destination}
                    onChange={(e) =>
                      setForm((c) => ({ ...c, destination: e.target.value }))
                    }
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
                    onChange={(e) =>
                      setForm((c) => ({ ...c, price: e.target.value }))
                    }
                    type="number"
                    min="1"
                    step="1"
                    placeholder="25"
                    required
                  />
                </label>
              </div>

              {/* Read-only computed fields */}
              <div className="form-row">
                <label>
                  Distance (auto-computed)
                  <input
                    value={
                      form.distanceKm
                        ? `${Number(form.distanceKm).toFixed(1)} km`
                        : ""
                    }
                    readOnly
                    placeholder="Auto-computed from route"
                    className="locked-input"
                  />
                </label>
                <label>
                  Duration (auto-computed)
                  <input
                    value={
                      form.estimatedDurationMinutes
                        ? formatDuration(form.estimatedDurationMinutes)
                        : ""
                    }
                    readOnly
                    placeholder="Auto-computed from route"
                    className="locked-input"
                  />
                </label>
              </div>

              {/* Google Maps reference */}
              <label>
                Google Maps Link Reference
                <input
                  type="url"
                  value={form.mapReferenceUrl}
                  onChange={(e) =>
                    setForm((c) => ({ ...c, mapReferenceUrl: e.target.value }))
                  }
                  placeholder="https://maps.app.goo.gl/..."
                />
              </label>
              {form.mapReferenceUrl && (
                <p className="form-hint friendly-message" style={{ fontSize: "0.82rem" }}>
                  Google Maps link is saved as reference. To match it exactly, plot the
                  route manually or use a configured routing API.
                </p>
              )}

              {form.estimatedDurationMinutes && (
                <p className="form-hint friendly-message" style={{ fontSize: "0.82rem" }}>
                  📍 Estimated: {formatDuration(form.estimatedDurationMinutes)} with traffic
                </p>
              )}

              <div className="inline-actions">
                <button className="primary-action" type="submit">
                  {editing ? <Save size={17} /> : <Plus size={17} />}
                  {editing ? "Save changes" : "Add fare stop"}
                </button>

                <button
                  type="button"
                  className="soft-button"
                  onClick={closeEditor}
                >
                  Close editor
                </button>

                {editing && editing.source !== "legacy" && (
                  <button
                    type="button"
                    className="soft-button"
                    onClick={() => syncRoute(editing)}
                  >
                    <RefreshCw size={16} /> Sync route
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Selected route summary */}
          <aside className="command-card selected-route-summary">
            <div className="section-heading compact">
              <div>
                <span>Selected route</span>
                <h2>
                  {selectedRoute
                    ? getRouteDisplayName(selectedRoute)
                    : "No route selected"}
                </h2>
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
                <dd>
                  {selectedRoute
                    ? formatWholePeso(selectedRoute.price)
                    : "Not set"}
                </dd>
              </div>
              <div>
                <dt>Distance</dt>
                <dd>
                  {form.distanceKm
                    ? `${formatNumber(Number(form.distanceKm))} km`
                    : selectedRoute?.distanceKm || selectedRoute?.distance
                    ? `${formatNumber(
                        (selectedRoute.distanceKm || selectedRoute.distance || 0)
                      )} km`
                    : "Not set"}
                </dd>
              </div>
              <div>
                <dt>Duration</dt>
                <dd>
                  {form.estimatedDurationMinutes
                    ? formatDuration(form.estimatedDurationMinutes)
                    : selectedRoute?.estimatedDurationMinutes
                    ? formatDuration(selectedRoute.estimatedDurationMinutes)
                    : "Not set"}
                </dd>
              </div>
              <div>
                <dt>Waypoints</dt>
                <dd>{formatNumber(selectedRoute?.waypoints?.length || 0)}</dd>
              </div>
              <div>
                <dt>Map reference</dt>
                <dd style={{ wordBreak: "break-all", fontSize: "0.76rem" }}>
                  {selectedRoute?.mapReferenceUrl
                    ? selectedRoute.mapReferenceUrl
                    : ROUTE_GOOGLE_MAP_REFS[selectedLineId] || "Not set"}
                </dd>
              </div>
            </dl>
            {selectedRoute && (
              <button
                type="button"
                className="soft-button"
                onClick={() => fillFormFromRoute(selectedRoute)}
              >
                <Pencil size={15} /> Edit selected route
              </button>
            )}
          </aside>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════
          FARE STOP MATRIX
      ═══════════════════════════════════════════════════════════ */}
      <section className="command-card fare-matrix-panel">
        <div className="section-heading compact">
          <div>
            <span>
              Showing fare stops for: {selectedLine?.label} (
              {direction === "forward" ? "Forward" : "Reverse"})
            </span>
            <h2>Fare Stop Matrix</h2>
          </div>
        </div>

        {/* ── Delete confirmation ── */}
        {deleteConfirmRow && (
          <div
            className="command-card"
            style={{
              border: "1px solid rgba(220,61,53,0.4)",
              background: "rgba(220,61,53,0.06)",
              marginBottom: "14px",
              padding: "14px"
            }}
          >
            <p style={{ margin: "0 0 8px", fontWeight: 700 }}>
              Delete this fare stop?
            </p>
            <p style={{ margin: "0 0 12px", color: "var(--muted)" }}>
              Conductors will no longer see this destination.
              <br />
              <strong style={{ color: "var(--text)" }}>
                {normalizeRouteLabel(deleteConfirmRow.origin)} →{" "}
                {normalizeRouteLabel(deleteConfirmRow.destination)}
              </strong>
            </p>
            <div className="inline-actions">
              <button
                type="button"
                className="primary-action"
                style={{
                  background: "var(--red)",
                  boxShadow: "none"
                }}
                onClick={confirmDeleteFareStop}
                disabled={isDeleting}
              >
                <Trash2 size={15} />
                {isDeleting ? "Deleting…" : "Delete fare stop"}
              </button>
              <button
                type="button"
                className="soft-button"
                onClick={cancelDelete}
                disabled={isDeleting}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {visibleFareMatrixRows.length === 0 ? (
          <p className="friendly-message">
            No fare stops found for{" "}
            <strong>
              {selectedLine?.label} ({direction})
            </strong>
            . Click &ldquo;Add fare stop&rdquo; below to create one.
          </p>
        ) : (
          <DataTable
            rows={visibleFareMatrixRows}
            getRowKey={(row) => row.id}
            columns={[
              {
                header: "Direction",
                cell: (row) => (
                  <span
                    className={`status-pill status-${
                      row.direction === "forward" ? "active" : "pending"
                    }`}
                  >
                    {row.direction}
                  </span>
                )
              },
              {
                header: "Origin",
                cell: (row) => normalizeRouteLabel(row.origin)
              },
              {
                header: "Destination / Drop-off",
                cell: (row) => normalizeRouteLabel(row.destination)
              },
              {
                header: "Fare",
                cell: (row) => (
                  <strong style={{ color: "var(--green)" }}>
                    {formatWholePeso(row.price)}
                  </strong>
                )
              },
              {
                header: "Source",
                cell: (row) => (
                  <span style={{ fontSize: "0.76rem", color: "var(--muted)" }}>
                    {row.direction === "forward"
                      ? "Routes_Forward"
                      : "Routes_Reverse"}
                  </span>
                )
              },
              {
                header: "Action",
                cell: (row) => (
                  <div className="table-action-row">
                    <button
                      type="button"
                      className="soft-button table-action"
                      onClick={() => fillFormFromRoute(row)}
                    >
                      <Pencil size={14} /> Edit fare stop
                    </button>
                    <button
                      type="button"
                      className="soft-button table-action"
                      style={{ color: "var(--red)" }}
                      onClick={() => requestDeleteFareStop(row)}
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
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

      {/* ═══════════════════════════════════════════════════════════
          HIDDEN / EXTRA ROUTES (advanced)
      ═══════════════════════════════════════════════════════════ */}
      {showHiddenRoutes && (
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
              {
                header: "Route",
                cell: (row) => <strong>{getRouteDisplayName(row)}</strong>
              },
              {
                header: "Origin",
                cell: (row) => normalizeRouteLabel(row.origin)
              },
              {
                header: "Destination",
                cell: (row) => normalizeRouteLabel(row.destination)
              },
              {
                header: "Fare",
                cell: (row) => formatWholePeso(row.price)
              },
              {
                header: "Status",
                cell: (row) => (
                  <span
                    className={`status-pill status-${row.status || "inactive"}`}
                  >
                    {row.status || "inactive"}
                  </span>
                )
              },
              {
                header: "Action",
                cell: (row) => (
                  <div className="table-action-row">
                    <button
                      type="button"
                      className="soft-button table-action"
                      onClick={() => fillFormFromRoute(row)}
                    >
                      <Pencil size={14} /> Edit
                    </button>
                    <button
                      type="button"
                      className="soft-button table-action"
                      onClick={() => setStatus(row, "active")}
                    >
                      <Eye size={14} /> Show
                    </button>
                  </div>
                )
              }
            ]}
          />
        </section>
      )}
    </AppShell>
  );
}