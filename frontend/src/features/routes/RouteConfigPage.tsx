"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { RoutePreviewMap, type LatLngPoint } from "@/components/map/RoutePreviewMap";
import { formatNumber } from "@/utils/format";
import { MAIN_TERMINALS } from "@/utils/terminals";
import {
  filterFareStopsBySelectedLineAndDirection,
  getFareStopLineId,
  getPrimaryRouteForLine,
  getRouteDisplayName,
  getRouteLineLabel,
  getRouteStopsLabel,
  groupMainRouteLines,
  isDefaultRoutePlaceholder,
  normalizeRouteLabel
} from "@/utils/routeLines";

type MainRouteLineId = "fvr-pitx" | "fvr-stcruz";

type RouteExtraFields = RouteConfig & {
  lineId?: string;
  routeGroup?: string;
  plannedByAdmin?: boolean;
  source?: "legacy" | "admin" | "default" | "supabase" | string;
  legacyKey?: string;
};

type RoutePayload = Partial<RouteConfig> &
  Record<string, unknown> & {
    lineId?: string;
    routeGroup?: string;
  };

const asRouteExtra = (route?: RouteConfig | null): RouteExtraFields | null =>
  route ? (route as RouteExtraFields) : null;

const formatDuration = (minutesValue?: string | number | null) => {
  const mins = Math.round(Number(minutesValue) || 0);

  if (!mins) return "";
  if (mins < 60) return `${mins} min`;

  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;

  if (rem === 0) return `${hrs} hr`;
  return `${hrs} hr ${rem} min`;
};

const formatWholePeso = (value?: number | string | null) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "Not set";
  return `₱${Math.round(num)}`;
};

const emptyForm = {
  origin: "",
  destination: "",
  price: "",
  distanceKm: "",
  estimatedDurationMinutes: "",
  baseFare: ""
};

const toWholePesoValue = (value: string | number | null | undefined) =>
  Math.round(Number(value) || 0);

const getRoutePolylinePoints = (route?: RouteConfig | null): LatLngPoint[] =>
  (route?.waypoints || [])
    .filter(
      (point) =>
        typeof point.lat === "number" &&
        typeof point.lng === "number" &&
        Number.isFinite(point.lat) &&
        Number.isFinite(point.lng)
    )
    .sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0))
    .map((point) => [point.lat as number, point.lng as number] as LatLngPoint);

const distanceBetweenMeters = ([lat1, lng1]: LatLngPoint, [lat2, lng2]: LatLngPoint) => {
  const radius = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const pointIsOnMainRoute = (point: LatLngPoint, mainRoutePoints: LatLngPoint[]) =>
  mainRoutePoints.some((routePoint) => distanceBetweenMeters(point, routePoint) <= 5);

const getRouteAnchorPoints = (route?: RouteConfig | null): LatLngPoint[] => {
  const points = getRoutePolylinePoints(route);

  if (points.length < 2) return [];
  return [points[0], points[points.length - 1]];
};

const terminalPointForLabel = (label?: string | null): LatLngPoint | null => {
  const normalized = normalizeRouteLabel(label).toUpperCase();

  if (normalized.includes("FVR")) return MAIN_TERMINALS.find((terminal) => terminal.id === "fvr")?.position || null;
  if (normalized.includes("MUZON")) return MAIN_TERMINALS.find((terminal) => terminal.id === "muzon")?.position || null;
  if (normalized.includes("ST. CRUZ") || normalized.includes("ST CRUZ")) {
    return MAIN_TERMINALS.find((terminal) => terminal.id === "st-cruz")?.position || null;
  }
  if (normalized.includes("GMA")) return MAIN_TERMINALS.find((terminal) => terminal.id === "gma")?.position || null;
  if (normalized.includes("PITX") || normalized.includes("PITIX")) {
    return MAIN_TERMINALS.find((terminal) => terminal.id === "pitx")?.position || null;
  }

  return null;
};

const buildRouteWaypoints = (
  points: LatLngPoint[],
  lineId: MainRouteLineId,
  direction: RouteConfig["direction"],
  seed: { origin: string; destination: string }
) =>
  points.map((point, index) => ({
    id: `wp-${Date.now()}-${index}`,
    lat: point[0],
    lng: point[1],
    sequence: index + 1,
    type:
      index === 0
        ? ("origin" as const)
        : index === points.length - 1
          ? ("destination" as const)
          : ("waypoint" as const),
    lineId,
    direction,
    origin: index === 0 ? seed.origin : undefined,
    destination: index === points.length - 1 ? seed.destination : undefined
  }));

const buildFareStopWaypoints = (
  points: LatLngPoint[],
  selectedLineId: MainRouteLineId,
  direction: RouteConfig["direction"],
  origin: string,
  destination: string
) =>
  points.slice(0, 2).map((point, index) => ({
    id: `fare-${Date.now()}-${index}`,
    lat: point[0],
    lng: point[1],
    sequence: index + 1,
    type: index === 0 ? ("origin" as const) : ("destination" as const),
    lineId: selectedLineId,
    direction,
    origin,
    destination
  }));

const getRouteSeed = (
  selectedLineId: MainRouteLineId,
  direction: RouteConfig["direction"]
) => {
  if (selectedLineId === "fvr-pitx") {
    return direction === "forward"
      ? {
          id: "fvr-to-pitx-via-gma",
          routeName: "FVR to PITX via GMA",
          origin: "FVR",
          destination: "PITX",
          reverseRouteId: "pitx-to-fvr-via-gma",
          price: 170,
          lineId: "fvr-pitx",
          routeGroup: "FVR_PITX"
        }
      : {
          id: "pitx-to-fvr-via-gma",
          routeName: "PITX to FVR via GMA",
          origin: "PITX",
          destination: "FVR",
          reverseRouteId: "fvr-to-pitx-via-gma",
          price: 170,
          lineId: "fvr-pitx",
          routeGroup: "FVR_PITX"
        };
  }

  return direction === "forward"
    ? {
        id: "fvr-to-st-cruz",
        routeName: "FVR to ST. CRUZ",
        origin: "FVR",
        destination: "ST. CRUZ",
        reverseRouteId: "st-cruz-to-fvr",
        price: 100,
        lineId: "fvr-stcruz",
        routeGroup: "FVR_ST_CRUZ"
      }
    : {
        id: "st-cruz-to-fvr",
        routeName: "ST. CRUZ to FVR",
        origin: "ST. CRUZ",
        destination: "FVR",
        reverseRouteId: "fvr-to-st-cruz",
        price: 100,
        lineId: "fvr-stcruz",
        routeGroup: "FVR_ST_CRUZ"
      };
};

export function RouteConfigPage() {
  const [direction, setDirection] = useState<RouteConfig["direction"]>("forward");
  const [editing, setEditing] = useState<RouteConfig | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<MainRouteLineId>("fvr-pitx");
  const [showHiddenRoutes, setShowHiddenRoutes] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [showAllRoutesOnMap, setShowAllRoutesOnMap] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [fareStopDraftPoints, setFareStopDraftPoints] = useState<LatLngPoint[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);
  const [routeMetrics, setRouteMetrics] = useState<
    Record<string, { distanceKm?: number; estimatedDurationMinutes?: number }>
  >({});
  const [deleteConfirmRow, setDeleteConfirmRow] = useState<RouteConfig | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const editorRef = useRef<HTMLDivElement | null>(null);

  const loadRoutes = useCallback(() => api.routes(), []);
  const loadLegacyForward = useCallback(() => api.getLegacyRoutesForward(), []);
  const loadLegacyReverse = useCallback(() => api.getLegacyRoutesReverse(), []);

  const routes = useApiResource(loadRoutes);
  const legacyForward = useApiResource(loadLegacyForward);
  const legacyReverse = useApiResource(loadLegacyReverse);

  const rows = useMemo(() => routes.data || [], [routes.data]);
  const savedRows = useMemo(
    () => rows.filter((route) => !isDefaultRoutePlaceholder(route)),
    [rows]
  );
  const routeLines = useMemo(() => groupMainRouteLines(rows), [rows]);
  const visibleLines = routeLines.filter((line) => line.id !== "hidden");
  const hiddenLine = routeLines.find((line) => line.id === "hidden");

  const selectedLine =
    visibleLines.find((line) => line.id === selectedLineId) || visibleLines[0] || null;

  const selectedRoute = getPrimaryRouteForLine(selectedLine, direction);
  const selectedRouteSeed = getRouteSeed(selectedLineId, direction);
  const editingExtra = asRouteExtra(editing);

  const allLegacy = useMemo(
    () => [...(legacyForward.data || []), ...(legacyReverse.data || [])],
    [legacyForward.data, legacyReverse.data]
  );

  const visibleFareMatrixRows = useMemo(
    () => filterFareStopsBySelectedLineAndDirection(allLegacy, selectedLineId, direction),
    [allLegacy, selectedLineId, direction]
  );

  const mapRoutes = showAllRoutesOnMap ? savedRows : selectedRoute ? [selectedRoute] : [];
  const activeSelectedRouteId = selectedRoute?.id || null;
  const routeSeedControlPoints = [
    terminalPointForLabel(selectedRouteSeed.origin),
    terminalPointForLabel(selectedRouteSeed.destination)
  ].filter((point): point is LatLngPoint => Boolean(point));
  const isFareStopEditor = showEditor && editingExtra?.source !== "admin";
  const activeFareStopMapId = isFareStopEditor ? editing?.id || "draft-fare-stop" : null;

  useEffect(() => {
    if (!activeSelectedRouteId) return;

    const metrics = routeMetrics[activeSelectedRouteId];
    if (!metrics) return;

    setForm((current) => {
      const nextDistance = metrics.distanceKm ? String(metrics.distanceKm) : current.distanceKm;
      const nextDuration = metrics.estimatedDurationMinutes
        ? String(metrics.estimatedDurationMinutes)
        : current.estimatedDurationMinutes;

      if (
        current.distanceKm === nextDistance &&
        current.estimatedDurationMinutes === nextDuration
      ) {
        return current;
      }

      return {
        ...current,
        distanceKm: nextDistance,
        estimatedDurationMinutes: nextDuration
      };
    });
  }, [activeSelectedRouteId, routeMetrics]);

  useEffect(() => {
    if (activeSelectedRouteId && selectedRouteId !== activeSelectedRouteId) {
      setSelectedRouteId(activeSelectedRouteId);
    }

    if (!activeSelectedRouteId && selectedRouteId) {
      setSelectedRouteId(null);
    }
  }, [activeSelectedRouteId, selectedRouteId]);

  useEffect(() => {
    if (!showEditor) return;

    window.setTimeout(() => {
      editorRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }, 80);
  }, [showEditor, editing?.id]);

  const handleRouteMetrics = useCallback(
    (
      routeId: string,
      metrics: { distanceKm?: number; estimatedDurationMinutes?: number }
    ) => {
      setRouteMetrics((current) => {
        const previous = current[routeId] || {};

        const nextDistance = metrics.distanceKm ?? previous.distanceKm;
        const nextDuration =
          metrics.estimatedDurationMinutes ?? previous.estimatedDurationMinutes;

        if (
          previous.distanceKm === nextDistance &&
          previous.estimatedDurationMinutes === nextDuration
        ) {
          return current;
        }

        return {
          ...current,
          [routeId]: {
            distanceKm: nextDistance,
            estimatedDurationMinutes: nextDuration
          }
        };
      });
    },
    []
  );

  const handleFareStopMetrics = useCallback(
    (metrics: { distanceKm?: number; estimatedDurationMinutes?: number }) => {
      setForm((current) => {
        const nextDistance = metrics.distanceKm ? String(metrics.distanceKm) : current.distanceKm;
        const nextDuration = metrics.estimatedDurationMinutes
          ? String(metrics.estimatedDurationMinutes)
          : current.estimatedDurationMinutes;

        if (
          current.distanceKm === nextDistance &&
          current.estimatedDurationMinutes === nextDuration
        ) {
          return current;
        }

        return {
          ...current,
          distanceKm: nextDistance,
          estimatedDurationMinutes: nextDuration
        };
      });
    },
    []
  );

  const refreshAllRoutes = async () => {
    await routes.refresh();
    await legacyForward.refresh();
    await legacyReverse.refresh();
  };

  const selectRouteLine = (lineId: MainRouteLineId) => {
    setSelectedLineId(lineId);
    setShowEditor(false);
    setEditing(null);
    setForm(emptyForm);
    setFareStopDraftPoints([]);
    setMessage(null);
    setDeleteConfirmRow(null);

    const line = routeLines.find((item) => item.id === lineId);
    const route = line ? getPrimaryRouteForLine(line, direction) : null;

    setSelectedRouteId(route?.id || null);
  };

  const switchDirection = (dir: RouteConfig["direction"]) => {
    setDirection(dir);
    setDeleteConfirmRow(null);

    const route = getPrimaryRouteForLine(selectedLine, dir);
    setSelectedRouteId(route?.id || null);

    if (showEditor) {
      setShowEditor(false);
      setEditing(null);
      setForm(emptyForm);
      setFareStopDraftPoints([]);
      setMessage(null);
    }
  };

  const openEditorForFareStop = (route: RouteConfig) => {
    const detectedLineId = getFareStopLineId(route);
    const nextLineId: MainRouteLineId =
      detectedLineId === "fvr-pitx" || detectedLineId === "fvr-stcruz"
        ? detectedLineId
        : selectedLineId;

    const line = routeLines.find((item) => item.id === nextLineId);
    const mainRouteForFareStop = line ? getPrimaryRouteForLine(line, route.direction) : null;

    setSelectedLineId(nextLineId);
    setEditing(route);
    setSelectedRouteId(mainRouteForFareStop?.id || null);
    setDirection(route.direction);
    setShowEditor(true);
    setMessage(null);
    setDeleteConfirmRow(null);

    setForm({
      origin: normalizeRouteLabel(route.origin),
      destination: normalizeRouteLabel(route.destination),
      price: String(toWholePesoValue(route.price)),
      distanceKm:
        route.distanceKm || route.distance ? String(route.distanceKm || route.distance) : "",
      estimatedDurationMinutes: route.estimatedDurationMinutes
        ? String(route.estimatedDurationMinutes)
        : "",
      baseFare: route.baseFare
        ? String(toWholePesoValue(route.baseFare))
        : String(toWholePesoValue(route.price))
    });
    setFareStopDraftPoints(getRouteAnchorPoints(route));
  };

  const openEditorForAdminRoute = (route: RouteConfig) => {
    setEditing(route);
    setSelectedRouteId(route.id);
    setDirection(route.direction);
    setShowEditor(true);
    setMessage(null);
    setDeleteConfirmRow(null);

    setForm({
      origin: normalizeRouteLabel(route.origin),
      destination: normalizeRouteLabel(route.destination),
      price: String(toWholePesoValue(route.price)),
      distanceKm:
        route.distanceKm || route.distance ? String(route.distanceKm || route.distance) : "",
      estimatedDurationMinutes: route.estimatedDurationMinutes
        ? String(route.estimatedDurationMinutes)
        : "",
      baseFare: route.baseFare
        ? String(toWholePesoValue(route.baseFare))
        : String(toWholePesoValue(route.price))
    });
    setFareStopDraftPoints([]);
  };

  const openCreateFareStop = () => {
    setEditing(null);
    setSelectedRouteId(selectedRoute?.id || null);
    setShowEditor(true);
    setMessageIsError(false);
    setMessage(
      `Adding a new ${direction} fare stop for ${getRouteLineLabel(selectedLineId)}. Fill in the drop-off and fare, then save.`
    );
    setDeleteConfirmRow(null);

    setForm({
      ...emptyForm,
      origin:
        direction === "forward"
          ? "FVR"
          : selectedLineId === "fvr-pitx"
            ? "PITX"
            : "ST. CRUZ",
      destination: direction === "forward" ? "" : "FVR"
    });
    setFareStopDraftPoints([]);
  };

  const closeEditor = () => {
    setEditing(null);
    setForm(emptyForm);
    setFareStopDraftPoints([]);
    setShowEditor(false);
    setMessage(null);
  };

  const requestDeleteFareStop = (row: RouteConfig) => {
    setDeleteConfirmRow(row);
    setMessage(null);
  };

  const cancelDelete = () => setDeleteConfirmRow(null);

  const confirmDeleteFareStop = async () => {
    const rowExtra = asRouteExtra(deleteConfirmRow);
    if (!deleteConfirmRow || !rowExtra?.legacyKey) return;

    setIsDeleting(true);
    setMessage(null);

    try {
      await api.deleteLegacyRoute(deleteConfirmRow.direction, rowExtra.legacyKey);

      setDeleteConfirmRow(null);
      setMessageIsError(false);
      setMessage("Fare stop deleted. Conductors will no longer see this destination.");
      await refreshAllRoutes();
    } catch {
      setMessageIsError(true);
      setMessage("Could not delete fare stop. Please try again.");
      setDeleteConfirmRow(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setMessageIsError(false);

    const normalizedOrigin = normalizeRouteLabel(form.origin);
    const normalizedDestination = normalizeRouteLabel(form.destination);
    const isFareStopSave = editingExtra?.source !== "admin";

    if (isFareStopSave && selectedRoute && fareStopDraftPoints.length < 2) {
      setMessageIsError(true);
      setMessage("Map point A and B on the blue main route before saving this fare stop.");
      return;
    }

    if (isFareStopSave && !selectedRoute) {
      setMessageIsError(true);
      setMessage("Map the main route line first before assigning fare stop segments.");
      return;
    }

    if (isFareStopSave && selectedRoute) {
      const mainRoutePoints = getRoutePolylinePoints(selectedRoute);
      const allPointsFollowMainRoute = fareStopDraftPoints
        .slice(0, 2)
        .every((point) => pointIsOnMainRoute(point, mainRoutePoints));

      if (!allPointsFollowMainRoute) {
        setMessageIsError(true);
        setMessage("Fare stop A and B must be snapped to the blue main route before saving.");
        return;
      }
    }

    const fareStopWaypoints =
      isFareStopSave && fareStopDraftPoints.length >= 2
        ? buildFareStopWaypoints(
            fareStopDraftPoints,
            selectedLineId,
            direction,
            normalizedOrigin,
            normalizedDestination
          )
        : undefined;

    const payload: RoutePayload = {
      direction,
      lineId: selectedLineId,
      routeGroup: selectedLineId === "fvr-pitx" ? "FVR_PITX" : "FVR_ST_CRUZ",
      routeName:
        editingExtra?.source === "admin"
          ? editing?.routeName || selectedLine?.label || `${form.origin} to ${form.destination}`
          : `${form.origin} to ${form.destination}`,
      origin: normalizedOrigin,
      destination: normalizedDestination,
      price: toWholePesoValue(form.price),
      baseFare: toWholePesoValue(form.baseFare || form.price),
      distanceKm: form.distanceKm ? Number(form.distanceKm) : undefined,
      distance: form.distanceKm ? Number(form.distanceKm) : undefined,
      estimatedDurationMinutes: form.estimatedDurationMinutes
        ? Number(form.estimatedDurationMinutes)
        : undefined,
      isViceVersa: true,
      status: editing?.status || "active",
      ...(fareStopWaypoints
        ? {
            waypoints: fareStopWaypoints,
            stops: fareStopWaypoints
          }
        : {})
    };

    try {
      if (editingExtra?.source === "legacy" && editingExtra.legacyKey && editing) {
        await api.updateLegacyRoute(editing.direction, editingExtra.legacyKey, payload);
        setMessage("Fare stop updated. Conductors will see the updated fare matrix.");
      } else if (editingExtra?.source === "admin" && editing) {
        await api.updateRoute(editing.id, payload);
        setMessage("Route line updated. The live map will use the latest route data.");
      } else {
        await api.createLegacyRoute(direction, payload);
        setMessage("New fare stop saved. Conductors can now select this destination.");
      }

      closeEditor();
      await refreshAllRoutes();
    } catch {
      setMessageIsError(true);
      setMessage("Something went wrong while saving. Please review the form and try again.");
    }
  };

  const setStatus = async (route: RouteConfig, status: RouteConfig["status"]) => {
    if (!status) return;

    setMessage(null);

    try {
      await api.updateRouteStatus(route.id, status);
      await routes.refresh();

      setMessageIsError(false);
      setMessage(status === "active" ? "Route is now visible." : "Route moved to hidden routes.");
    } catch {
      setMessageIsError(true);
      setMessage("We could not update the route status. Please try again.");
    }
  };

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

  const highlightRouteId =
    editingExtra?.source === "legacy"
      ? selectedRoute?.id
      : selectedRouteId || selectedRoute?.id;

  return (
    <AppShell title="Route Config" kicker="Main line planner and conductor fare matrix">
      {message ? (
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
      ) : null}

      <section className="legacy-route-config-layout">
        <div className="command-card route-map-workbench">
          <div className="section-heading compact">
            <div>
              <span>Route mapper</span>
              <h2>Main saved route preview</h2>
            </div>

            <div
              style={{
                display: "flex",
                gap: "8px",
                alignItems: "center",
                flexWrap: "wrap",
                justifyContent: "flex-end"
              }}
            >
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
            editableRouteId={selectedRoute?.id || selectedRouteSeed.id}
            draftRouteName={selectedRouteSeed.routeName}
            seedControlPoints={routeSeedControlPoints}
            fareStops={visibleFareMatrixRows}
            activeFareStopId={activeFareStopMapId}
            fareStopDraftPoints={isFareStopEditor ? fareStopDraftPoints : []}
            fareStopLabels={{
              origin: form.origin || selectedRouteSeed.origin,
              destination: form.destination || selectedRouteSeed.destination
            }}
            onFareStopDraftChange={isFareStopEditor ? setFareStopDraftPoints : undefined}
            onFareStopMetrics={isFareStopEditor ? handleFareStopMetrics : undefined}
            onRouteMetrics={handleRouteMetrics}
            onSaveWaypoints={async (
              routeId,
              points,
              distanceKm,
              estimatedDurationMinutes
            ) => {
              const isNewRoute = !selectedRoute || isDefaultRoutePlaceholder(selectedRoute);
              let targetRouteId = routeId;

              if (isNewRoute) {
                targetRouteId = selectedRouteSeed.id;
                await api.createRoute({
                  id: targetRouteId,
                  routeId: targetRouteId,
                  routeName: selectedRouteSeed.routeName,
                  origin: selectedRouteSeed.origin,
                  destination: selectedRouteSeed.destination,
                  direction,
                  lineId: selectedRouteSeed.lineId,
                  routeGroup: selectedRouteSeed.routeGroup,
                  price: selectedRouteSeed.price,
                  baseFare: selectedRouteSeed.price,
                  isViceVersa: true,
                  reverseRouteId: selectedRouteSeed.reverseRouteId,
                  status: "active",
                  stops: [],
                  waypoints: []
                } as Omit<RouteConfig, "id"> & Record<string, unknown>);
              }

              const waypoints = buildRouteWaypoints(
                points,
                selectedLineId,
                direction,
                selectedRouteSeed
              );
              const reverseDirection: RouteConfig["direction"] =
                direction === "forward" ? "reverse" : "forward";
              const reverseSeed = getRouteSeed(selectedLineId, reverseDirection);
              const reverseRouteExists = rows.some((route) => route.id === reverseSeed.id);
              const reversedPoints = [...points].reverse();
              const reverseWaypoints = buildRouteWaypoints(
                reversedPoints,
                selectedLineId,
                reverseDirection,
                reverseSeed
              );

              try {
                const saveReverseRoute = async () => {
                  if (!reverseRouteExists) {
                    await api.createRoute({
                      id: reverseSeed.id,
                      routeId: reverseSeed.id,
                      routeName: reverseSeed.routeName,
                      origin: reverseSeed.origin,
                      destination: reverseSeed.destination,
                      direction: reverseDirection,
                      lineId: reverseSeed.lineId,
                      routeGroup: reverseSeed.routeGroup,
                      price: reverseSeed.price,
                      baseFare: reverseSeed.price,
                      isViceVersa: true,
                      reverseRouteId: reverseSeed.reverseRouteId,
                      status: "active",
                      stops: [],
                      waypoints: []
                    } as Omit<RouteConfig, "id"> & Record<string, unknown>);
                  }

                  return api.updateRoutePath(reverseSeed.id, {
                    routeName: reverseSeed.routeName,
                    origin: reverseSeed.origin,
                    destination: reverseSeed.destination,
                    direction: reverseDirection,
                    reverseRouteId: reverseSeed.reverseRouteId,
                    price: reverseSeed.price,
                    baseFare: reverseSeed.price,
                    isViceVersa: true,
                    status: "active",
                    waypoints: reverseWaypoints,
                    distanceKm,
                    ...(estimatedDurationMinutes ? { estimatedDurationMinutes } : {}),
                    routeGeometrySource: "osrm",
                    plannedByAdmin: true,
                    lineId: selectedLineId,
                    routeGroup: selectedLineId === "fvr-pitx" ? "FVR_PITX" : "FVR_ST_CRUZ"
                  });
                };

                await Promise.all([
                  api.updateRoutePath(targetRouteId, {
                    routeName: selectedRouteSeed.routeName,
                    origin: selectedRouteSeed.origin,
                    destination: selectedRouteSeed.destination,
                    direction,
                    reverseRouteId: selectedRouteSeed.reverseRouteId,
                    price: selectedRouteSeed.price,
                    baseFare: selectedRouteSeed.price,
                    isViceVersa: true,
                    status: "active",
                    waypoints,
                    distanceKm,
                    ...(estimatedDurationMinutes ? { estimatedDurationMinutes } : {}),
                    routeGeometrySource: "osrm",
                    plannedByAdmin: true,
                    lineId: selectedLineId,
                    routeGroup: selectedLineId === "fvr-pitx" ? "FVR_PITX" : "FVR_ST_CRUZ"
                  }),
                  saveReverseRoute()
                ]);

                setMessageIsError(false);
                setMessage("Route path saved. Reverse direction was updated automatically.");
                void routes.refresh().catch(() => undefined);
                if (isNewRoute) setSelectedRouteId(targetRouteId);
              } catch {
                setMessageIsError(true);
                setMessage("Could not save route path. Please try again.");
                throw new Error("Could not save route path.");
              }
            }}
          />

          <div className="route-line-tabs">
            {visibleLines.map((line) => (
              <button
                key={line.id}
                type="button"
                className={line.id === selectedLineId ? "active" : ""}
                onClick={() => selectRouteLine(line.id as MainRouteLineId)}
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

          <div className="route-line-list">
            {visibleLines.map((line) => {
              const activeRoute = getPrimaryRouteForLine(line, direction);

              return (
                <article
                  key={line.id}
                  className={`route-line-card ${line.id === selectedLineId ? "selected" : ""}`}
                  onClick={() => selectRouteLine(line.id as MainRouteLineId)}
                >
                  <div>
                    <strong>{line.shortLabel}</strong>
                    <span>
                      {activeRoute
                        ? `${direction === "forward" ? "Forward" : "Reverse"} route ready`
                        : `No ${direction} direction yet`}
                    </span>
                  </div>

                  <div className="route-chip-row">
                    {line.chips.map((chip, index) => (
                      <span key={`${chip}-${index}`}>{chip}</span>
                    ))}
                  </div>

                  <footer>
                    <span>{activeRoute ? formatWholePeso(activeRoute.price) : "Not set"}</span>
                    <button
                      type="button"
                      className="soft-button table-action"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedLineId(line.id as MainRouteLineId);

                        if (activeRoute) {
                          setSelectedRouteId(activeRoute.id);
                          setMessage("Selected route is now shown on the map.");
                        } else {
                          setSelectedRouteId(null);
                          setMessage(
                            direction === "reverse"
                              ? "No reverse route yet. Click 'Map Custom Route' to start drawing."
                              : "No forward route yet. Click 'Map Custom Route' to start drawing."
                          );
                        }
                      }}
                    >
                      <MapPinned size={14} /> Preview
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

      <section className="command-card selected-route-summary" style={{ marginBottom: 18 }}>
        <div className="section-heading compact">
          <div>
            <span>Selected route summary</span>
            <h2>
              {selectedRoute
                ? getRouteDisplayName(selectedRoute)
                : `${getRouteLineLabel(selectedLineId)} has no ${direction} route yet`}
            </h2>
          </div>
        </div>

        <dl>
          <div>
            <dt>Line</dt>
            <dd>{getRouteLineLabel(selectedLineId)}</dd>
          </div>
          <div>
            <dt>Direction</dt>
            <dd>{direction}</dd>
          </div>
          <div>
            <dt>Stops</dt>
            <dd>{selectedRoute ? getRouteStopsLabel(selectedRoute) : `${selectedRouteSeed.origin} to ${selectedRouteSeed.destination}`}</dd>
          </div>
          <div>
            <dt>Fare</dt>
            <dd>{selectedRoute ? formatWholePeso(selectedRoute.price) : formatWholePeso(selectedRouteSeed.price)}</dd>
          </div>
          <div>
            <dt>Distance</dt>
            <dd>
              {selectedRoute?.distanceKm || selectedRoute?.distance
                ? `${formatNumber(selectedRoute.distanceKm || selectedRoute.distance || 0)} km`
                : "Auto-computed by map"}
            </dd>
          </div>
          <div>
            <dt>Duration</dt>
            <dd>
              {selectedRoute?.estimatedDurationMinutes
                ? formatDuration(selectedRoute.estimatedDurationMinutes)
                : "Auto-computed by map"}
            </dd>
          </div>
          <div>
            <dt>Waypoints</dt>
            <dd>{formatNumber(selectedRoute?.waypoints?.length || 0)}</dd>
          </div>
        </dl>
      </section>

      {showEditor ? (
        <section ref={editorRef} className="route-detail-grid">
          <div className="command-card">
            <div className="section-heading compact">
              <div>
                <span>{editing ? "Edit selected fare stop" : "Add new fare stop"}</span>
                <h2>Fare route editor</h2>
              </div>
              <Waypoints size={21} />
            </div>

            <form className="stacked-form" onSubmit={submit}>
              <div className="form-readonly-header">
                <label>
                  Selected line
                  <input value={getRouteLineLabel(selectedLineId)} readOnly className="locked-input" />
                </label>

                <label>
                  Direction
                  <input value={direction} readOnly className="locked-input" />
                </label>

                {editingExtra?.source === "legacy" && form.destination ? (
                  <p className="form-hint friendly-message" style={{ marginTop: 4 }}>
                    Editing fare stop: {form.origin} to {form.destination}
                  </p>
                ) : null}
              </div>

              {isFareStopEditor ? (
                <div className="fare-map-assignment">
                  <strong>Map passenger segment on the blue line</strong>
                  <span>
                    {fareStopDraftPoints.length >= 2
                      ? "A/B ready. Purple line will follow the main route only."
                      : "Click two points on the map: A for origin, B for destination/drop-off."}
                  </span>
                </div>
              ) : null}

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
                  Fare whole peso
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

                <label>
                  Base fare whole peso
                  <input
                    value={form.baseFare}
                    onChange={(event) => setForm((current) => ({ ...current, baseFare: event.target.value }))}
                    type="number"
                    min="0"
                    step="1"
                    placeholder="15"
                  />
                </label>
              </div>

              <div className="form-row">
                <label>
                  Distance auto-computed
                  <input
                    value={form.distanceKm ? `${Number(form.distanceKm).toFixed(1)} km` : ""}
                    readOnly
                    placeholder="Auto-computed from map"
                    className="locked-input"
                  />
                </label>

                <label>
                  Duration auto-computed
                  <input
                    value={form.estimatedDurationMinutes ? formatDuration(form.estimatedDurationMinutes) : ""}
                    readOnly
                    placeholder="Auto-computed from map"
                    className="locked-input"
                  />
                </label>
              </div>

              {form.estimatedDurationMinutes ? (
                <p className="form-hint friendly-message" style={{ fontSize: "0.82rem" }}>
                  Estimated: {formatDuration(form.estimatedDurationMinutes)} with traffic
                </p>
              ) : null}

              <div className="inline-actions">
                <button className="primary-action" type="submit">
                  {editing ? <Save size={17} /> : <Plus size={17} />}
                  {editing ? "Save changes" : "Add fare stop"}
                </button>

                <button type="button" className="soft-button" onClick={closeEditor}>
                  Close editor
                </button>

                {editingExtra?.source === "admin" && editing ? (
                  <button type="button" className="soft-button" onClick={() => syncRoute(editing)}>
                    <RefreshCw size={16} /> Sync route
                  </button>
                ) : null}
              </div>
            </form>
          </div>
        </section>
      ) : null}

      <section className="command-card fare-matrix-panel">
        <div className="section-heading compact">
          <div>
            <span>
              Showing fare stops for: {getRouteLineLabel(selectedLineId)} ({direction === "forward" ? "Forward" : "Reverse"})
            </span>
            <h2>Fare Stop Matrix</h2>
          </div>
        </div>

        {deleteConfirmRow ? (
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
                {normalizeRouteLabel(deleteConfirmRow.origin)} to {normalizeRouteLabel(deleteConfirmRow.destination)}
              </strong>
            </p>

            <div className="inline-actions">
              <button
                type="button"
                className="primary-action"
                style={{ background: "var(--red)", boxShadow: "none" }}
                onClick={confirmDeleteFareStop}
                disabled={isDeleting}
              >
                <Trash2 size={15} />
                {isDeleting ? "Deleting..." : "Delete fare stop"}
              </button>

              <button type="button" className="soft-button" onClick={cancelDelete} disabled={isDeleting}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {visibleFareMatrixRows.length === 0 ? (
          <p className="friendly-message">
            No fare stops found for <strong>{getRouteLineLabel(selectedLineId)} ({direction})</strong>.
            Click Add drop-off fare below to create one.
          </p>
        ) : (
          <DataTable
            rows={visibleFareMatrixRows}
            getRowKey={(row) => row.id}
            columns={[
              {
                header: "Direction",
                cell: (row) => (
                  <span className={`status-pill status-${row.direction === "forward" ? "active" : "pending"}`}>
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
                    {row.direction === "forward" ? "Routes_Forward" : "Routes_Reverse"}
                  </span>
                )
              },
              {
                header: "Action",
                cell: (row) => (
                  <div className="table-action-row">
                    <button type="button" className="soft-button table-action" onClick={() => openEditorForFareStop(row)}>
                      <Pencil size={14} /> Edit / map fare stop
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
            <Plus size={17} /> Add drop-off fare
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
                  <span className={`status-pill status-${row.status || "inactive"}`}>
                    {row.status || "inactive"}
                  </span>
                )
              },
              {
                header: "Action",
                cell: (row) => (
                  <div className="table-action-row">
                    <button type="button" className="soft-button table-action" onClick={() => openEditorForAdminRoute(row)}>
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
