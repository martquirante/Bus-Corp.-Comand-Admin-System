"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RouteConfig } from "@pos-bus/shared";
import { Maximize2, Minimize2, Map, Satellite, TrafficCone } from "lucide-react";
import { getRouteDisplayName, normalizeRouteLabel } from "@/utils/routeLines";

type LeafletApi = any;
type LeafletMap = any;
type LeafletLayer = any;

type RouteExtraFields = RouteConfig & {
  lineId?: string;
  trafficDurationMinutes?: number;
};

declare global {
  interface Window {
    L?: LeafletApi;
    __posBusLeafletLoad?: Promise<LeafletApi>;
  }
}

const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const DEFAULT_CENTER: [number, number] = [14.8078, 121.0111];
const OPENROUTESERVICE_KEY = process.env.NEXT_PUBLIC_OPENROUTESERVICE_API_KEY;

const asRouteExtra = (route: RouteConfig): RouteExtraFields => route as RouteExtraFields;

const ensureLeaflet = () => {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Map is not available while the page is loading."));
  }

  if (window.L) return Promise.resolve(window.L);
  if (window.__posBusLeafletLoad) return window.__posBusLeafletLoad;

  window.__posBusLeafletLoad = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }

    const script = document.createElement("script");
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () =>
      window.L ? resolve(window.L) : reject(new Error("Map library did not start."));
    script.onerror = () =>
      reject(new Error("The map service is unavailable right now. Try again later."));
    document.head.appendChild(script);
  });

  return window.__posBusLeafletLoad;
};

const hasCoordinate = (point: { lat?: number; lng?: number }) =>
  typeof point.lat === "number" &&
  typeof point.lng === "number" &&
  Number.isFinite(point.lat) &&
  Number.isFinite(point.lng) &&
  !(point.lat === 0 && point.lng === 0);

const getRoutePoints = (route: RouteConfig) => {
  const waypointPoints = (route.waypoints || [])
    .filter(hasCoordinate)
    .sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0))
    .map((point) => [point.lat as number, point.lng as number] as [number, number]);

  if (waypointPoints.length > 1) return waypointPoints;

  return (route.stops || [])
    .filter(hasCoordinate)
    .sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0))
    .map((point) => [point.lat as number, point.lng as number] as [number, number]);
};

const formatDuration = (minutes?: number) => {
  const mins = Math.round(Number(minutes) || 0);

  if (!mins) return "";
  if (mins < 60) return `${mins} min`;

  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;

  if (rem === 0) return `${hrs} hr`;
  return `${hrs} hr ${rem} min`;
};

const calculateLineDistanceKm = (points: [number, number][], map?: LeafletMap | null) => {
  if (points.length < 2) return undefined;

  let totalMeters = 0;

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];

    if (map?.distance) {
      totalMeters += map.distance(current, next);
    } else {
      totalMeters += haversineMeters(current, next);
    }
  }

  return Number((totalMeters / 1000).toFixed(1));
};

const haversineMeters = ([lat1, lng1]: [number, number], [lat2, lng2]: [number, number]) => {
  const radius = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const estimateTrafficDurationMinutes = (distanceKm?: number) => {
  if (!distanceKm) return undefined;

  const cityBusAverageKph = distanceKm > 40 ? 28 : 22;
  const baseMinutes = (distanceKm / cityBusAverageKph) * 60;
  const trafficBuffer = 1.25;

  return Math.max(1, Math.round(baseMinutes * trafficBuffer));
};

async function fetchFromOsrm(points: [number, number][]) {
  const coords = points.map(([lat, lng]) => `${lng},${lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;

  const response = await fetch(url);
  if (!response.ok) throw new Error("Road route service is unavailable right now.");

  const json = await response.json();
  const route = json?.routes?.[0];
  const coordinates = route?.geometry?.coordinates;

  if (!Array.isArray(coordinates)) {
    throw new Error("Road route service did not return a route line.");
  }

  const baseMinutes =
    typeof route.duration === "number" ? Math.round(route.duration / 60) : undefined;

  const trafficAdjustedMinutes = baseMinutes ? Math.round(baseMinutes * 1.35) : undefined;

  return {
    points: coordinates.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]),
    distanceKm:
      typeof route.distance === "number" ? Number((route.distance / 1000).toFixed(1)) : undefined,
    estimatedDurationMinutes: trafficAdjustedMinutes
  };
}

async function fetchFromOpenRouteService(points: [number, number][]) {
  if (!OPENROUTESERVICE_KEY) {
    throw new Error("OpenRouteService API key is not configured.");
  }

  const response = await fetch("https://api.openrouteservice.org/v2/directions/driving-car/geojson", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: OPENROUTESERVICE_KEY
    },
    body: JSON.stringify({
      coordinates: points.map(([lat, lng]) => [lng, lat])
    })
  });

  if (!response.ok) throw new Error("Road route service is unavailable right now.");

  const json = await response.json();
  const route = json?.features?.[0]?.properties?.segments?.[0];
  const coordinates = json?.features?.[0]?.geometry?.coordinates;

  if (!Array.isArray(coordinates)) {
    throw new Error("Road route service did not return a route line.");
  }

  const baseMinutes = route?.duration ? Math.round(route.duration / 60) : undefined;
  const trafficAdjustedMinutes = baseMinutes ? Math.round(baseMinutes * 1.35) : undefined;

  return {
    points: coordinates.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]),
    distanceKm: route?.distance ? Number((route.distance / 1000).toFixed(1)) : undefined,
    estimatedDurationMinutes: trafficAdjustedMinutes
  };
}

async function fetchRoadGeometry(points: [number, number][]) {
  if (points.length < 2) {
    return {
      points,
      distanceKm: undefined,
      estimatedDurationMinutes: undefined
    };
  }

  try {
    return await fetchFromOsrm(points);
  } catch {
    if (OPENROUTESERVICE_KEY) {
      return fetchFromOpenRouteService(points);
    }

    throw new Error("Road route service is unavailable right now. Your saved route was not changed.");
  }
}

const getRouteColor = (route: RouteConfig) => {
  const routeExtra = asRouteExtra(route);
  const text = `${route.id} ${routeExtra.lineId || ""} ${route.routeName || ""} ${
    route.destination || ""
  }`.toLowerCase();

  if (text.includes("pitx") || text.includes("pitix")) return "#13a46b";
  return "#0f7ad3";
};

export function RoutePreviewMap({
  routes,
  selectedRouteId,
  onRouteMetrics,
  onSaveWaypoints
}: {
  routes: RouteConfig[];
  selectedRouteId?: string | null;
  onRouteMetrics?: (
    routeId: string,
    metrics: { distanceKm?: number; estimatedDurationMinutes?: number }
  ) => void;
  onSaveWaypoints?: (
    routeId: string,
    points: [number, number][],
    distanceKm?: number,
    estimatedDurationMinutes?: number
  ) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LeafletLayer | null>(null);
  const editLayerRef = useRef<LeafletLayer | null>(null);
  const streetLayerRef = useRef<LeafletLayer | null>(null);
  const satelliteLayerRef = useRef<LeafletLayer | null>(null);
  const trafficLayerRef = useRef<LeafletLayer | null>(null);

  const [message, setMessage] = useState<string>("Showing saved waypoints.");
  const [isCalculating, setIsCalculating] = useState(false);
  const [computedRoads, setComputedRoads] = useState<Record<string, [number, number][]>>({});
  const [computedMetrics, setComputedMetrics] = useState<
    Record<string, { distanceKm?: number; estimatedDurationMinutes?: number }>
  >({});
  const [viewMode, setViewMode] = useState<"street" | "satellite">("street");
  const [isTrafficOn, setIsTrafficOn] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editPoints, setEditPoints] = useState<[number, number][]>([]);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);

  const visibleRoutes = useMemo(
    () =>
      routes
        .map((route) => ({ route, points: getRoutePoints(route) }))
        .filter((entry) => entry.points.length > 1 || entry.route.id === selectedRouteId),
    [routes, selectedRouteId]
  );

  const selectedRouteEntry = useMemo(() => {
    if (!visibleRoutes.length) return null;

    if (selectedRouteId) {
      return visibleRoutes.find((entry) => entry.route.id === selectedRouteId) || visibleRoutes[0];
    }

    return visibleRoutes[0];
  }, [selectedRouteId, visibleRoutes]);

  const recalculatePath = async () => {
    const entry = selectedRouteEntry;

    if (!entry) {
      setMessage("No route selected to calculate.");
      return;
    }

    const pointsToCalculate = isEditing && editPoints.length > 1 ? editPoints : entry.points;

    if (pointsToCalculate.length < 2) {
      setMessage("Add at least 2 map points before calculating a road path.");
      return;
    }

    setIsCalculating(true);
    setMessage("Calculating road path preview...");

    try {
      const result = await fetchRoadGeometry(pointsToCalculate);
      const distanceKm =
        result.distanceKm ?? calculateLineDistanceKm(result.points, mapRef.current);
      const estimatedDurationMinutes =
        result.estimatedDurationMinutes ?? estimateTrafficDurationMinutes(distanceKm);

      if (isEditing) {
        setEditPoints(result.points);
        setComputedMetrics((current) => ({
          ...current,
          [entry.route.id]: {
            distanceKm,
            estimatedDurationMinutes
          }
        }));
        setMessage("Road path preview is ready. Review it, then click Save route path.");
      } else {
        setComputedRoads((current) => ({
          ...current,
          [entry.route.id]: result.points
        }));
        setComputedMetrics((current) => ({
          ...current,
          [entry.route.id]: {
            distanceKm,
            estimatedDurationMinutes
          }
        }));
        onRouteMetrics?.(entry.route.id, {
          distanceKm,
          estimatedDurationMinutes
        });
        setMessage("Road path preview is ready. It will not replace saved waypoints until you save it.");
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Road route service is unavailable right now. Your saved route was not changed."
      );
    } finally {
      setIsCalculating(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    ensureLeaflet()
      .then((L) => {
        if (cancelled || !containerRef.current || mapRef.current) return;

        const map = L.map(containerRef.current, {
          zoomControl: false,
          preferCanvas: true
        }).setView(DEFAULT_CENTER, 12);

        L.control.zoom({ position: "bottomright" }).addTo(map);

        streetLayerRef.current = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "(c) OpenStreetMap",
          maxZoom: 19
        }).addTo(map);

        satelliteLayerRef.current = L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          {
            attribution: "Tiles (c) Esri",
            maxZoom: 19
          }
        );

        trafficLayerRef.current = L.tileLayer("https://mt0.google.com/vt/lyrs=m,traffic&x={x}&y={y}&z={z}", {
          attribution: "Traffic layer",
          maxZoom: 20
        });

        mapRef.current = map;

        window.setTimeout(() => map.invalidateSize({ animate: true }), 120);
      })
      .catch(() => setMessage("The map service is unavailable right now. Try again later."));

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    map.off("click");

    map.on("click", (event: any) => {
      if (!isEditing) return;

      const { lat, lng } = event.latlng;

      setEditPoints((previous) => {
        const next = [...previous, [lat, lng]] as [number, number][];
        setSelectedPointIndex(next.length - 1);
        return next;
      });
    });

    return () => {
      map.off("click");
    };
  }, [isEditing]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const timer = window.setTimeout(() => map.invalidateSize({ animate: true }), 120);
    return () => window.clearTimeout(timer);
  }, [isFullscreen, routes.length, selectedRouteId]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsFullscreen(false);
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  const toggleViewMode = (mode: "street" | "satellite") => {
    const map = mapRef.current;
    const street = streetLayerRef.current;
    const satellite = satelliteLayerRef.current;

    if (!map || !street || !satellite) return;

    if (mode === "satellite") {
      if (map.hasLayer(street)) map.removeLayer(street);
      satellite.addTo(map);
    } else {
      if (map.hasLayer(satellite)) map.removeLayer(satellite);
      street.addTo(map);
    }

    setViewMode(mode);
    window.setTimeout(() => map.invalidateSize({ animate: true }), 80);
  };

  const toggleTraffic = () => {
    const map = mapRef.current;
    const traffic = trafficLayerRef.current;

    if (!map || !traffic) {
      setMessage("Traffic layer is not configured yet.");
      return;
    }

    if (isTrafficOn) {
      if (map.hasLayer(traffic)) map.removeLayer(traffic);
      setIsTrafficOn(false);
      setMessage("Traffic layer hidden.");
    } else {
      traffic.addTo(map);
      setIsTrafficOn(true);
      setMessage("Traffic layer enabled if available in your area.");
    }
  };

  useEffect(() => {
    const map = mapRef.current;
    const L = window.L;
    if (!map || !L) return;

    let cancelled = false;

    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }

    if (editLayerRef.current) {
      map.removeLayer(editLayerRef.current);
      editLayerRef.current = null;
    }

    if (isEditing) {
      const editGroup = L.layerGroup().addTo(map);
      editLayerRef.current = editGroup;

      if (editPoints.length > 1) {
        L.polyline(editPoints, {
          color: "#dc3d35",
          weight: 5,
          opacity: 0.95,
          lineCap: "round"
        }).addTo(editGroup);
      }

      editPoints.forEach((point, index) => {
        const isSelected = index === selectedPointIndex;
        const label =
          index === 0 ? "Origin" : index === editPoints.length - 1 ? "Destination" : `${index + 1}`;

        const marker = L.marker(point, {
          draggable: true,
          icon: L.divIcon({
            className: `edit-marker ${isSelected ? "selected" : ""}`,
            html: `<div style="display:grid;place-items:center;min-width:24px;height:24px;padding:0 6px;background:${
              isSelected ? "#ffeb3b" : "#fff"
            };border:2px solid #dc3d35;border-radius:999px;color:#111;font-size:10px;font-weight:900;box-shadow:0 6px 14px rgba(0,0,0,.24);">${label}</div>`,
            iconSize: [32, 28],
            iconAnchor: [16, 14]
          })
        }).addTo(editGroup);

        marker.on("click", (event: any) => {
          L.DomEvent.stopPropagation(event);
          setSelectedPointIndex(index);
        });

        marker.on("dragend", (event: any) => {
          const nextPosition = event.target.getLatLng();

          setEditPoints((previous) => {
            const next = [...previous];
            next[index] = [nextPosition.lat, nextPosition.lng];
            return next;
          });
        });
      });

      if (editPoints.length) {
        map.fitBounds(editPoints, { padding: [42, 42], maxZoom: 15 });
        window.setTimeout(() => map.invalidateSize({ animate: true }), 100);
      }

      return () => {
        cancelled = true;
      };
    }

    const group = L.layerGroup().addTo(map);
    layerRef.current = group;

    if (!visibleRoutes.length) {
      setMessage("No route line yet. Add or sync waypoints to preview this route.");
      map.setView(DEFAULT_CENTER, 12);
      map.invalidateSize({ animate: true });
      return;
    }

    setMessage("Showing saved route path. Recalculate only if you want a new preview.");

    const allBounds: [number, number][] = [];

    for (const entry of visibleRoutes) {
      if (cancelled) break;

      const entryRouteExtra = asRouteExtra(entry.route);
      const isSelected = selectedRouteId
        ? entry.route.id === selectedRouteId
        : visibleRoutes.length === 1;
      const routeColor = getRouteColor(entry.route);
      const routePoints = computedRoads[entry.route.id] || entry.points;

      if (routePoints.length < 2) continue;

      L.polyline(routePoints, {
        color: routeColor,
        weight: isSelected ? 8 : 3,
        opacity: isSelected ? 1 : 0.18,
        lineCap: "round",
        lineJoin: "round",
        dashArray: entry.route.direction === "reverse" ? "10 12" : undefined
      })
        .addTo(group)
        .bindPopup(
          `<strong>${getRouteDisplayName(entry.route)}</strong><br/>${routePoints.length} saved route points`
        );

      routePoints.forEach((point) => allBounds.push(point));

      const first = routePoints[0];
      const last = routePoints[routePoints.length - 1];

      if (first) {
        L.marker(first, {
          icon: L.divIcon({
            className: "route-terminal-marker origin",
            html: `<span>Start: ${normalizeRouteLabel(entry.route.origin || "Origin")}</span>`,
            iconSize: [160, 28],
            iconAnchor: [80, 14]
          })
        }).addTo(group);
      }

      if (last) {
        L.marker(last, {
          icon: L.divIcon({
            className: "route-terminal-marker finish",
            html: `<span>End: ${normalizeRouteLabel(entry.route.destination || "Destination")}</span>`,
            iconSize: [160, 28],
            iconAnchor: [80, 14]
          })
        }).addTo(group);
      }

      const distanceKm =
        computedMetrics[entry.route.id]?.distanceKm ??
        entry.route.distanceKm ??
        entry.route.distance ??
        calculateLineDistanceKm(routePoints, map);

      const estimatedDurationMinutes =
        computedMetrics[entry.route.id]?.estimatedDurationMinutes ??
        entryRouteExtra.trafficDurationMinutes ??
        entry.route.estimatedDurationMinutes ??
        estimateTrafficDurationMinutes(distanceKm);

      onRouteMetrics?.(entry.route.id, {
        distanceKm,
        estimatedDurationMinutes
      });
    }

    if (!cancelled) {
      if (allBounds.length) {
        map.fitBounds(allBounds, { padding: [42, 42], maxZoom: 15 });
      }

      window.setTimeout(() => map.invalidateSize({ animate: true }), 180);
    }

    return () => {
      cancelled = true;
    };
  }, [
    visibleRoutes,
    selectedRouteId,
    computedRoads,
    computedMetrics,
    isEditing,
    editPoints,
    selectedPointIndex,
    onRouteMetrics
  ]);

  const toggleEditMode = () => {
    if (isEditing) {
      setIsEditing(false);
      setEditPoints([]);
      setSelectedPointIndex(null);
      setMessage("Manual route editing cancelled.");
      return;
    }

    let initialPoints: [number, number][] = [];

    if (selectedRouteEntry) {
      initialPoints =
        computedRoads[selectedRouteEntry.route.id] ||
        selectedRouteEntry.points ||
        [];
    }

    setEditPoints(initialPoints);
    setSelectedPointIndex(null);
    setIsEditing(true);
    setMessage("Manual edit mode: click the map to add waypoints, or drag existing points.");
  };

  const removeSelectedPoint = () => {
    if (selectedPointIndex === null) return;

    setEditPoints((previous) => previous.filter((_, index) => index !== selectedPointIndex));
    setSelectedPointIndex(null);
  };

  const saveEditedPath = () => {
    if (!onSaveWaypoints) {
      setMessage("Saving is not supported in this view.");
      return;
    }

    const targetRouteId = selectedRouteEntry?.route.id;

    if (!targetRouteId) {
      setMessage("No route selected to save.");
      return;
    }

    if (editPoints.length < 2) {
      setMessage("Add at least 2 map points before saving.");
      return;
    }

    const distanceKm = calculateLineDistanceKm(editPoints, mapRef.current);
    const estimatedDurationMinutes =
      computedMetrics[targetRouteId]?.estimatedDurationMinutes ||
      estimateTrafficDurationMinutes(distanceKm);

    onSaveWaypoints(targetRouteId, editPoints, distanceKm, estimatedDurationMinutes);

    setComputedRoads((current) => ({
      ...current,
      [targetRouteId]: editPoints
    }));

    setComputedMetrics((current) => ({
      ...current,
      [targetRouteId]: {
        distanceKm,
        estimatedDurationMinutes
      }
    }));

    setIsEditing(false);
    setSelectedPointIndex(null);
    setMessage(
      `Route path saved locally. Distance: ${distanceKm || "N/A"} km${
        estimatedDurationMinutes ? `, Estimated: ${formatDuration(estimatedDurationMinutes)} with traffic` : ""
      }.`
    );
  };

  const activeRouteName = selectedRouteEntry?.route
    ? getRouteDisplayName(selectedRouteEntry.route)
    : "No route selected";

  return (
    <div
      className={`route-preview-map-shell ${isFullscreen ? "is-fullscreen" : ""}`}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        height: isFullscreen ? "100vh" : "100%"
      }}
    >
      <div
        ref={containerRef}
        className="route-preview-map-canvas"
        style={{
          flex: 1,
          cursor: isEditing ? "crosshair" : "grab"
        }}
      />

      <div
        className="route-preview-controls"
        style={{
          padding: "12px",
          display: "flex",
          gap: "8px",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          background: "color-mix(in srgb, var(--surface-strong) 86%, transparent)",
          borderTop: "1px solid var(--line)"
        }}
      >
        <span style={{ fontSize: "13px", color: "var(--muted)" }}>
          <strong style={{ color: "var(--text)" }}>{activeRouteName}</strong>
          {" · "}
          {message}
        </span>

        <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
          {isEditing ? (
            <>
              <button
                type="button"
                className="soft-button"
                onClick={removeSelectedPoint}
                disabled={selectedPointIndex === null}
                style={{
                  padding: "6px 10px",
                  fontSize: "12px",
                  opacity: selectedPointIndex === null ? 0.5 : 1
                }}
              >
                Remove point
              </button>

              <button
                type="button"
                className="soft-button"
                onClick={() => {
                  setEditPoints([]);
                  setSelectedPointIndex(null);
                  setMessage("Unsaved route points cleared.");
                }}
                style={{ padding: "6px 10px", fontSize: "12px" }}
              >
                Clear route
              </button>

              <button
                type="button"
                className="soft-button"
                onClick={recalculatePath}
                disabled={isCalculating || editPoints.length < 2}
                style={{ padding: "6px 12px", fontSize: "12px" }}
              >
                {isCalculating ? "Calculating..." : "Recalculate road path"}
              </button>

              <button
                type="button"
                className="soft-button primary-action"
                onClick={saveEditedPath}
                style={{
                  padding: "6px 12px",
                  fontSize: "12px",
                  background: "#13a46b",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px"
                }}
              >
                Save route path
              </button>

              <button
                type="button"
                className="soft-button"
                onClick={toggleEditMode}
                style={{ padding: "6px 10px", fontSize: "12px" }}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              {visibleRoutes.length > 0 && onSaveWaypoints ? (
                <button
                  type="button"
                  className="soft-button"
                  onClick={toggleEditMode}
                  style={{ padding: "6px 12px", fontSize: "12px" }}
                >
                  Manual edit route
                </button>
              ) : null}

              {visibleRoutes.length > 0 ? (
                <button
                  type="button"
                  className="soft-button"
                  onClick={recalculatePath}
                  disabled={isCalculating}
                  style={{ padding: "6px 12px", fontSize: "12px" }}
                >
                  {isCalculating ? "Calculating..." : "Recalculate path"}
                </button>
              ) : null}
            </>
          )}

          <div style={{ width: "1px", height: "20px", background: "var(--line)", margin: "0 4px" }} />

          <button
            type="button"
            className={`soft-button ${viewMode === "street" ? "active" : ""}`}
            style={{
              padding: "6px 10px",
              background: viewMode === "street" ? "var(--surface-muted)" : "transparent"
            }}
            onClick={() => toggleViewMode("street")}
            title="Street view"
          >
            <Map size={14} />
          </button>

          <button
            type="button"
            className={`soft-button ${viewMode === "satellite" ? "active" : ""}`}
            style={{
              padding: "6px 10px",
              background: viewMode === "satellite" ? "var(--surface-muted)" : "transparent"
            }}
            onClick={() => toggleViewMode("satellite")}
            title="Satellite view"
          >
            <Satellite size={14} />
          </button>

          <button
            type="button"
            className={`soft-button ${isTrafficOn ? "active" : ""}`}
            style={{
              padding: "6px 10px",
              background: isTrafficOn ? "var(--surface-muted)" : "transparent"
            }}
            onClick={toggleTraffic}
            title={isTrafficOn ? "Traffic On" : "Traffic layer if available"}
          >
            <TrafficCone size={14} />
          </button>

          <button
            type="button"
            className="soft-button"
            style={{ padding: "6px 10px" }}
            onClick={() => setIsFullscreen((value) => !value)}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}