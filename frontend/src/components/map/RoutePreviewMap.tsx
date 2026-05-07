"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RouteConfig } from "@pos-bus/shared";
import {
  GripVertical,
  LocateFixed,
  Map,
  Maximize2,
  Minimize2,
  Plus,
  Satellite,
  Search,
  TrafficCone,
  Trash2,
  Undo2,
  X
} from "lucide-react";
import { getRouteDisplayName, normalizeRouteLabel } from "@/utils/routeLines";

type LeafletLatLng = {
  lat: number;
  lng: number;
};

type LeafletMapMouseEvent = {
  latlng: LeafletLatLng;
};

type LeafletMarkerEvent = {
  target: {
    getLatLng: () => LeafletLatLng;
  };
};

type LeafletPopupEvent = {
  popup?: {
    getElement?: () => HTMLElement | null;
  };
};

type LeafletLayerTarget = LeafletMap | LeafletLayer;

type LeafletLayer = {
  addTo: (target: LeafletLayerTarget) => LeafletLayer;
  bindPopup: (content: string, options?: Record<string, unknown>) => LeafletLayer;
};

type LeafletMarker = LeafletLayer & {
  addTo: (target: LeafletLayerTarget) => LeafletMarker;
  bindPopup: (content: string, options?: Record<string, unknown>) => LeafletMarker;
  openPopup: () => LeafletMarker;
  on: (event: string, handler: (event: LeafletMarkerEvent & LeafletPopupEvent) => void) => LeafletMarker;
};

type LeafletMap = {
  setView: (center: LatLngPoint, zoom: number) => LeafletMap;
  flyTo: (center: LatLngPoint, zoom: number, options?: Record<string, unknown>) => LeafletMap;
  fitBounds: (
    points: LatLngPoint[],
    options?: { padding?: [number, number]; maxZoom?: number }
  ) => LeafletMap;
  invalidateSize: (options?: { animate?: boolean }) => void;
  distance?: (from: LatLngPoint, to: LatLngPoint) => number;
  getZoom?: () => number;
  hasLayer: (layer: LeafletLayer) => boolean;
  removeLayer: (layer: LeafletLayer) => void;
  on: (event: string, handler: (event: LeafletMapMouseEvent) => void) => void;
  off: (event: string, handler: (event: LeafletMapMouseEvent) => void) => void;
};

type LeafletApi = {
  map: (
    element: HTMLElement,
    options?: { zoomControl?: boolean; preferCanvas?: boolean }
  ) => LeafletMap;
  control: {
    zoom: (options?: { position?: string }) => { addTo: (map: LeafletMap) => void };
  };
  tileLayer: (url: string, options?: Record<string, unknown>) => LeafletLayer;
  layerGroup: () => LeafletLayer;
  polyline: (points: LatLngPoint[], options?: Record<string, unknown>) => LeafletLayer;
  marker: (
    point: LatLngPoint,
    options?: { draggable?: boolean; icon?: unknown }
  ) => LeafletMarker;
  divIcon: (options?: Record<string, unknown>) => unknown;
  DomEvent: {
    stopPropagation: (event: unknown) => void;
  };
};

type LeafletWindow = Window & {
  L?: LeafletApi;
  __posBusLeafletLoad?: Promise<LeafletApi>;
};

type LatLngPoint = [number, number];

type RouteExtraFields = RouteConfig & {
  lineId?: string;
  trafficDurationMinutes?: number;
};

type SearchResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  class?: string;
};

type RoadGeometryResult = {
  points: LatLngPoint[];
  distanceKm?: number;
  estimatedDurationMinutes?: number;
  warning?: string;
  isStraightLineFallback?: boolean;
};

type PendingSearchPoint = {
  point: LatLngPoint;
  label: string;
};

type StraightLineSaveState = {
  routeId: string;
  points: LatLngPoint[];
  distanceKm?: number;
  estimatedDurationMinutes?: number;
};

const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const DEFAULT_CENTER: LatLngPoint = [14.8078, 121.0111];
const OPENROUTESERVICE_KEY = process.env.NEXT_PUBLIC_OPENROUTESERVICE_API_KEY;

const asRouteExtra = (route: RouteConfig): RouteExtraFields => route as RouteExtraFields;

const ensureLeaflet = () => {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Map is not available while the page is loading."));
  }

  const leafletWindow = window as LeafletWindow;
  if (leafletWindow.L) return Promise.resolve(leafletWindow.L);
  if (leafletWindow.__posBusLeafletLoad) return leafletWindow.__posBusLeafletLoad;

  leafletWindow.__posBusLeafletLoad = new Promise<LeafletApi>((resolve, reject) => {
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
      leafletWindow.L ? resolve(leafletWindow.L) : reject(new Error("Map library did not start."));
    script.onerror = () =>
      reject(new Error("The map service is unavailable right now. Try again later."));
    document.head.appendChild(script);
  });

  return leafletWindow.__posBusLeafletLoad;
};

const hasCoordinate = (point: { lat?: number; lng?: number }) =>
  typeof point.lat === "number" &&
  typeof point.lng === "number" &&
  Number.isFinite(point.lat) &&
  Number.isFinite(point.lng) &&
  !(point.lat === 0 && point.lng === 0);

const sortBySavedOrder = <T extends { sequence?: number }>(points: T[]) =>
  points
    .map((point, index) => ({ point, index }))
    .sort((a, b) => {
      const sequenceA = Number.isFinite(Number(a.point.sequence))
        ? Number(a.point.sequence)
        : a.index + 1;
      const sequenceB = Number.isFinite(Number(b.point.sequence))
        ? Number(b.point.sequence)
        : b.index + 1;

      return sequenceA - sequenceB;
    })
    .map(({ point }) => point);

const getRoutePoints = (route: RouteConfig): LatLngPoint[] => {
  const waypointPoints = sortBySavedOrder((route.waypoints || []).filter(hasCoordinate))
    .map((point) => [point.lat as number, point.lng as number] as LatLngPoint);

  if (waypointPoints.length > 1) return waypointPoints;

  return sortBySavedOrder((route.stops || []).filter(hasCoordinate))
    .map((point) => [point.lat as number, point.lng as number] as LatLngPoint);
};

const getPointSignature = (points: LatLngPoint[]) =>
  points
    .map(([lat, lng], index) => `${index + 1}:${lat.toFixed(6)},${lng.toFixed(6)}`)
    .join("|");

const haversineMeters = ([lat1, lng1]: LatLngPoint, [lat2, lng2]: LatLngPoint) => {
  const radius = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const calculateLineDistanceKm = (points: LatLngPoint[], map?: LeafletMap | null) => {
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

const estimateTrafficDurationMinutes = (distanceKm?: number) => {
  if (!distanceKm) return undefined;

  const cityBusAverageKph = distanceKm > 40 ? 28 : 22;
  const baseMinutes = (distanceKm / cityBusAverageKph) * 60;
  const trafficBuffer = 1.25;

  return Math.max(1, Math.round(baseMinutes * trafficBuffer));
};

async function fetchFromOsrm(points: LatLngPoint[]): Promise<RoadGeometryResult> {
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
  const routeDistanceKm =
    typeof route.distance === "number" ? Number((route.distance / 1000).toFixed(1)) : undefined;
  const straightLineKm = Number(
    (haversineMeters(points[0], points[points.length - 1]) / 1000).toFixed(1)
  );

  if (routeDistanceKm && straightLineKm && routeDistanceKm > straightLineKm * 2) {
    throw new Error("Road route service returned an unlikely route line.");
  }

  return {
    points: coordinates.map(([lng, lat]: [number, number]) => [lat, lng] as LatLngPoint),
    distanceKm: routeDistanceKm,
    estimatedDurationMinutes: trafficAdjustedMinutes
  };
}

async function fetchFromOpenRouteService(points: LatLngPoint[]): Promise<RoadGeometryResult> {
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
    points: coordinates.map(([lng, lat]: [number, number]) => [lat, lng] as LatLngPoint),
    distanceKm: route?.distance ? Number((route.distance / 1000).toFixed(1)) : undefined,
    estimatedDurationMinutes: trafficAdjustedMinutes
  };
}

const straightLineFallback = (points: LatLngPoint[]): RoadGeometryResult => {
  const distanceKm = calculateLineDistanceKm(points);

  return {
    points,
    distanceKm,
    estimatedDurationMinutes: estimateTrafficDurationMinutes(distanceKm),
    warning: "Road path service unavailable — showing straight-line preview. Save anyway?",
    isStraightLineFallback: true
  };
};

async function fetchRoadGeometry(points: LatLngPoint[]): Promise<RoadGeometryResult> {
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
      try {
        return await fetchFromOpenRouteService(points);
      } catch {
        return straightLineFallback(points);
      }
    }

    return straightLineFallback(points);
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

const shortPlaceName = (value: string) => {
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.slice(0, 3).join(", ");
};

const formatPointLabel = ([lat, lng]: LatLngPoint) =>
  `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const getMarkerRole = (index: number, total: number) => {
  if (index === 0) return "origin";
  if (index === total - 1) return "destination";
  return "waypoint";
};

async function reverseGeocodePoint(point: LatLngPoint) {
  const params = new URLSearchParams({
    format: "json",
    lat: String(point[0]),
    lon: String(point[1]),
    zoom: "18",
    addressdetails: "0"
  });

  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) return "";

  const result = (await response.json()) as { display_name?: string };
  return result.display_name ? shortPlaceName(result.display_name) : "";
}

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
    points: LatLngPoint[],
    distanceKm?: number,
    estimatedDurationMinutes?: number
  ) => Promise<void> | void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LeafletLayer | null>(null);
  const editLayerRef = useRef<LeafletLayer | null>(null);
  const streetLayerRef = useRef<LeafletLayer | null>(null);
  const satelliteLayerRef = useRef<LeafletLayer | null>(null);
  const trafficLayerRef = useRef<LeafletLayer | null>(null);
  const metricsCallbackRef = useRef<typeof onRouteMetrics>(onRouteMetrics);

  const [message, setMessage] = useState<string>("Showing saved waypoints.");
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [computedRoads, setComputedRoads] = useState<Record<string, LatLngPoint[]>>({});
  const [computedRoadBaseSignatures, setComputedRoadBaseSignatures] = useState<
    Record<string, string>
  >({});
  const [computedMetrics, setComputedMetrics] = useState<
    Record<string, { distanceKm?: number; estimatedDurationMinutes?: number }>
  >({});
  const [computedMetricBaseSignatures, setComputedMetricBaseSignatures] = useState<
    Record<string, string>
  >({});
  const [viewMode, setViewMode] = useState<"street" | "satellite">("street");
  const [isTrafficOn, setIsTrafficOn] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editPoints, setEditPoints] = useState<LatLngPoint[]>([]);
  const [editPointLabels, setEditPointLabels] = useState<string[]>([]);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const [draggedPointIndex, setDraggedPointIndex] = useState<number | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [pendingSearchPoint, setPendingSearchPoint] = useState<PendingSearchPoint | null>(null);
  const [straightLineSave, setStraightLineSave] = useState<StraightLineSaveState | null>(null);
  const [fallbackWarning, setFallbackWarning] = useState<string | null>(null);

  useEffect(() => {
    metricsCallbackRef.current = onRouteMetrics;
  }, [onRouteMetrics]);

  const visibleRoutes = useMemo(
    () =>
      routes
        .map((route) => {
          const points = getRoutePoints(route);

          return {
            route,
            points,
            signature: getPointSignature(points)
          };
        })
        .filter((entry) => entry.points.length > 1 || entry.route.id === selectedRouteId),
    [routes, selectedRouteId]
  );

  const selectedRouteEntry = useMemo(() => {
    if (!visibleRoutes.length) return null;

    if (selectedRouteId) {
      return visibleRoutes.find((entry) => entry.route.id === selectedRouteId) || null;
    }

    return visibleRoutes[0];
  }, [selectedRouteId, visibleRoutes]);

  const updatePointLabelFromGeocode = useCallback((index: number, point: LatLngPoint) => {
    void reverseGeocodePoint(point)
      .then((label) => {
        if (!label) return;

        setEditPointLabels((previous) => {
          if (!previous[index]) return previous;

          const next = [...previous];
          next[index] = label;
          return next;
        });
      })
      .catch(() => undefined);
  }, [setEditPointLabels]);

  const addEditPoint = useCallback((point: LatLngPoint, label?: string) => {
    const nextIndex = editPoints.length;
    const pointLabel = label || formatPointLabel(point);

    setEditPoints((previous) => [...previous, point]);
    setEditPointLabels((previous) => [...previous, pointLabel]);
    setSelectedPointIndex(nextIndex);
    setShowClearConfirm(false);
    setStraightLineSave(null);
    setFallbackWarning(null);

    if (!label) {
      updatePointLabelFromGeocode(nextIndex, point);
    }
  }, [
    editPoints.length,
    setEditPoints,
    setEditPointLabels,
    setSelectedPointIndex,
    setShowClearConfirm,
    setStraightLineSave,
    setFallbackWarning,
    updatePointLabelFromGeocode
  ]);

  const updateEditPoint = useCallback((index: number, point: LatLngPoint) => {
    setEditPoints((previous) => {
      const next = [...previous];
      next[index] = point;
      return next;
    });
    setEditPointLabels((previous) => {
      const next = [...previous];
      next[index] = formatPointLabel(point);
      return next;
    });
    setStraightLineSave(null);
    setFallbackWarning(null);
    updatePointLabelFromGeocode(index, point);
  }, [
    setEditPoints,
    setEditPointLabels,
    setStraightLineSave,
    setFallbackWarning,
    updatePointLabelFromGeocode
  ]);

  const removePointAtIndex = useCallback((index: number) => {
    setEditPoints((previous) => previous.filter((_, pointIndex) => pointIndex !== index));
    setEditPointLabels((previous) => previous.filter((_, pointIndex) => pointIndex !== index));
    setSelectedPointIndex(null);
    setShowClearConfirm(false);
    setStraightLineSave(null);
    setFallbackWarning(null);
  }, [
    setEditPoints,
    setEditPointLabels,
    setSelectedPointIndex,
    setShowClearConfirm,
    setStraightLineSave,
    setFallbackWarning
  ]);

  const reorderPoint = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;

    setEditPoints((previous) => {
      const next = [...previous];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    setEditPointLabels((previous) => {
      const next = [...previous];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    setSelectedPointIndex(toIndex);
    setDraggedPointIndex(null);
    setStraightLineSave(null);
    setFallbackWarning(null);
  }, [
    setEditPoints,
    setEditPointLabels,
    setSelectedPointIndex,
    setDraggedPointIndex,
    setStraightLineSave,
    setFallbackWarning
  ]);

  const undoLastPoint = useCallback(() => {
    if (!editPoints.length) return;
    removePointAtIndex(editPoints.length - 1);
    setMessage("Last route point removed.");
  }, [editPoints.length, removePointAtIndex, setMessage]);

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
    setStraightLineSave(null);
    setFallbackWarning(null);
    setMessage("Calculating road path preview...");

    try {
      const result = await fetchRoadGeometry(pointsToCalculate);
      const distanceKm =
        result.distanceKm ?? calculateLineDistanceKm(result.points, mapRef.current);
      const estimatedDurationMinutes =
        result.estimatedDurationMinutes ?? estimateTrafficDurationMinutes(distanceKm);
      const warning = result.warning || null;

      setFallbackWarning(warning);

      if (isEditing) {
        setEditPoints(result.points);
        setEditPointLabels(result.points.map(formatPointLabel));
        setComputedMetricBaseSignatures((current) => ({
          ...current,
          [entry.route.id]: getPointSignature(result.points)
        }));
        setComputedMetrics((current) => ({
          ...current,
          [entry.route.id]: {
            distanceKm,
            estimatedDurationMinutes
          }
        }));
        if (result.isStraightLineFallback) {
          setStraightLineSave({
            routeId: entry.route.id,
            points: result.points,
            distanceKm,
            estimatedDurationMinutes
          });
          setMessage(result.warning || "Road path service unavailable. Review before saving.");
        } else {
          setMessage("Road path preview is ready. Review it, then click Save route path.");
        }
      } else {
        setComputedRoads((current) => ({
          ...current,
          [entry.route.id]: result.points
        }));
        setComputedRoadBaseSignatures((current) => ({
          ...current,
          [entry.route.id]: entry.signature
        }));
        setComputedMetricBaseSignatures((current) => ({
          ...current,
          [entry.route.id]: entry.signature
        }));
        setComputedMetrics((current) => ({
          ...current,
          [entry.route.id]: {
            distanceKm,
            estimatedDurationMinutes
          }
        }));
        metricsCallbackRef.current?.(entry.route.id, {
          distanceKm,
          estimatedDurationMinutes
        });
        setMessage(
          result.warning ||
            "Road path preview is ready. It will not replace saved waypoints until you save it."
        );
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

  const searchPlaces = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();

    const query = searchQuery.trim();

    if (!query) {
      setMessage("Type a place or stop name first.");
      return;
    }

    setIsSearching(true);
    setSearchResults([]);
    setMessage("Searching place...");

    try {
      const params = new URLSearchParams({
        format: "json",
        q: `${query}, Philippines`,
        limit: "6",
        addressdetails: "1"
      });

      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
        headers: {
          Accept: "application/json"
        }
      });

      if (!response.ok) {
        throw new Error("Search is unavailable right now.");
      }

      const results = (await response.json()) as SearchResult[];

      setSearchResults(results);
      setMessage(
        results.length
          ? "Select a search result to add it as a route point."
          : "No place found. Try a more specific place name."
      );
    } catch {
      setMessage("Search is unavailable right now. You can still click the map to add points.");
    } finally {
      setIsSearching(false);
    }
  };

  const previewSearchResult = (result: SearchResult) => {
    const lat = Number(result.lat);
    const lng = Number(result.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setMessage("This search result has no usable map location.");
      return;
    }

    const point: LatLngPoint = [lat, lng];
    const label = shortPlaceName(result.display_name);

    setPendingSearchPoint({ point, label });
    setStraightLineSave(null);
    setFallbackWarning(null);

    const map = mapRef.current;
    if (map) {
      map.flyTo(point, 15);
    }

    setMessage(`${label} selected. Confirm Add as waypoint on the map.`);
    setSearchResults([]);
    setSearchQuery("");
  };

  const confirmPendingSearchPoint = useCallback(() => {
    if (!pendingSearchPoint) return;

    addEditPoint(pendingSearchPoint.point, pendingSearchPoint.label);
    setMessage(`${pendingSearchPoint.label} added as a route waypoint.`);
    setPendingSearchPoint(null);
  }, [addEditPoint, pendingSearchPoint, setMessage, setPendingSearchPoint]);

  const cancelPendingSearchPoint = useCallback(() => {
    setPendingSearchPoint(null);
    setMessage("Search preview cancelled.");
  }, [setMessage, setPendingSearchPoint]);

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

    const handleClick = (event: LeafletMapMouseEvent) => {
      if (!isEditing) return;

      const { lat, lng } = event.latlng;

      addEditPoint([lat, lng]);
    };

    map.on("click", handleClick);

    return () => {
      map.off("click", handleClick);
    };
  }, [addEditPoint, isEditing]);

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

  useEffect(() => {
    if (!isEditing) return;

    const handleUndoShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        undoLastPoint();
      }
    };

    window.addEventListener("keydown", handleUndoShortcut);
    return () => window.removeEventListener("keydown", handleUndoShortcut);
  }, [isEditing, editPoints.length, undoLastPoint]);

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
    const L = (window as LeafletWindow).L;
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
          lineCap: "round",
          lineJoin: "round"
        }).addTo(editGroup);
      }

      if (pendingSearchPoint) {
        const previewMarker = L.marker(pendingSearchPoint.point, {
          icon: L.divIcon({
            className: "search-preview-marker",
            html: `<div class="search-preview-dot"></div>`,
            iconSize: [34, 34],
            iconAnchor: [17, 17]
          })
        })
          .addTo(editGroup)
          .bindPopup(
            `<div class="search-preview-popup"><strong>${escapeHtml(pendingSearchPoint.label)}</strong><div><button type="button" data-route-preview-action="add">Add as waypoint</button><button type="button" data-route-preview-action="cancel">Cancel</button></div></div>`,
            { closeButton: false, autoClose: false, closeOnClick: false }
          );

        previewMarker.on("popupopen", (event: LeafletPopupEvent) => {
          const element = event.popup?.getElement?.();
          const addButton = element?.querySelector('[data-route-preview-action="add"]');
          const cancelButton = element?.querySelector('[data-route-preview-action="cancel"]');

          if (addButton instanceof HTMLButtonElement) {
            addButton.addEventListener("click", confirmPendingSearchPoint);
          }
          if (cancelButton instanceof HTMLButtonElement) {
            cancelButton.addEventListener("click", cancelPendingSearchPoint);
          }
        });

        previewMarker.openPopup();
      }

      editPoints.forEach((point, index) => {
        const isSelected = index === selectedPointIndex;
        const role = getMarkerRole(index, editPoints.length);
        const label = index === 0 ? "Start" : index === editPoints.length - 1 ? "End" : `${index + 1}`;

        const marker = L.marker(point, {
          draggable: true,
          icon: L.divIcon({
            className: `edit-marker ${role} ${isSelected ? "selected" : ""}`,
            html: `<div class="edit-marker-label">${label}</div>`,
            iconSize: [38, 32],
            iconAnchor: [19, 16]
          })
        }).addTo(editGroup);

        marker.on("click", (event: unknown) => {
          L.DomEvent.stopPropagation(event);
          setSelectedPointIndex(index);
        });

        marker.on("dragend", (event: LeafletMarkerEvent) => {
          const nextPosition = event.target.getLatLng();

          updateEditPoint(index, [nextPosition.lat, nextPosition.lng]);
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

    const allBounds: LatLngPoint[] = [];
    let drawnRouteCount = 0;

    for (const entry of visibleRoutes) {
      if (cancelled) break;

      const entryRouteExtra = asRouteExtra(entry.route);
      const isSelected = selectedRouteId
        ? entry.route.id === selectedRouteId
        : visibleRoutes.length === 1;
      const routeColor = getRouteColor(entry.route);
      const previewRoadPoints =
        computedRoadBaseSignatures[entry.route.id] === entry.signature
          ? computedRoads[entry.route.id]
          : undefined;
      const previewMetrics =
        computedMetricBaseSignatures[entry.route.id] === entry.signature
          ? computedMetrics[entry.route.id]
          : undefined;
      const routePoints = previewRoadPoints || entry.points;

      if (routePoints.length < 2) continue;
      drawnRouteCount += 1;

      L.polyline(routePoints, {
        color: routeColor,
        weight: isSelected ? 8 : 3,
        opacity: isSelected ? 1 : 0.18,
        lineCap: "round",
        lineJoin: "round"
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
            iconSize: [170, 28],
            iconAnchor: [85, 14]
          })
        }).addTo(group);
      }

      if (last) {
        L.marker(last, {
          icon: L.divIcon({
            className: "route-terminal-marker finish",
            html: `<span>End: ${normalizeRouteLabel(entry.route.destination || "Destination")}</span>`,
            iconSize: [170, 28],
            iconAnchor: [85, 14]
          })
        }).addTo(group);
      }

      const distanceKm =
        previewMetrics?.distanceKm ??
        entry.route.distanceKm ??
        entry.route.distance ??
        calculateLineDistanceKm(routePoints, map);

      const estimatedDurationMinutes =
        previewMetrics?.estimatedDurationMinutes ??
        entryRouteExtra.trafficDurationMinutes ??
        entry.route.estimatedDurationMinutes ??
        estimateTrafficDurationMinutes(distanceKm);

      metricsCallbackRef.current?.(entry.route.id, {
        distanceKm,
        estimatedDurationMinutes
      });
    }

    if (!cancelled) {
      if (allBounds.length) {
        map.fitBounds(allBounds, { padding: [42, 42], maxZoom: 15 });
        setMessage("Showing saved route path. Recalculate only if you want a new preview.");
      } else if (drawnRouteCount === 0) {
        setMessage("No saved route path yet. Use reference route path or Manual edit route to add points.");
        map.setView(DEFAULT_CENTER, 12);
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
    computedRoadBaseSignatures,
    computedMetrics,
    computedMetricBaseSignatures,
    isEditing,
    editPoints,
    confirmPendingSearchPoint,
    cancelPendingSearchPoint,
    pendingSearchPoint,
    selectedPointIndex,
    updateEditPoint
  ]);

  const toggleEditMode = () => {
    if (isEditing) {
      setIsEditing(false);
      setEditPoints([]);
      setEditPointLabels([]);
      setSelectedPointIndex(null);
      setSearchResults([]);
      setPendingSearchPoint(null);
      setShowClearConfirm(false);
      setStraightLineSave(null);
      setFallbackWarning(null);
      setMessage("Manual route editing cancelled.");
      return;
    }

    let initialPoints: LatLngPoint[] = [];

    if (selectedRouteEntry) {
      const previewRoadPoints =
        computedRoadBaseSignatures[selectedRouteEntry.route.id] === selectedRouteEntry.signature
          ? computedRoads[selectedRouteEntry.route.id]
          : undefined;

      initialPoints = previewRoadPoints || selectedRouteEntry.points || [];
    }

    setEditPoints(initialPoints);
    setEditPointLabels(initialPoints.map(formatPointLabel));
    setSelectedPointIndex(null);
    setPendingSearchPoint(null);
    setShowClearConfirm(false);
    setStraightLineSave(null);
    setFallbackWarning(null);
    setIsEditing(true);
    setMessage("Manual edit mode: click the map or search a place to add route points.");
  };

  const removeSelectedPoint = () => {
    if (selectedPointIndex === null) return;

    removePointAtIndex(selectedPointIndex);
  };

  const saveEditedPath = async () => {
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

    setIsSaving(true);
    setStraightLineSave(null);
    setFallbackWarning(null);
    setMessage("Snapping to road...");

    try {
      const result = await fetchRoadGeometry(editPoints);
      const distanceKm =
        result.distanceKm ?? calculateLineDistanceKm(result.points, mapRef.current);
      const estimatedDurationMinutes =
        result.estimatedDurationMinutes ?? estimateTrafficDurationMinutes(distanceKm);

      setEditPoints(result.points);
      setEditPointLabels(result.points.map(formatPointLabel));

      if (result.isStraightLineFallback) {
        setStraightLineSave({
          routeId: targetRouteId,
          points: result.points,
          distanceKm,
          estimatedDurationMinutes
        });
        setFallbackWarning(result.warning || "Road path service unavailable. Save anyway?");
        setMessage(result.warning || "Road path service unavailable. Save anyway?");
        return;
      }

      await onSaveWaypoints(targetRouteId, result.points, distanceKm, estimatedDurationMinutes);

      setComputedRoads((current) => ({
        ...current,
        [targetRouteId]: result.points
      }));
      setComputedRoadBaseSignatures((current) => ({
        ...current,
        [targetRouteId]: selectedRouteEntry?.signature || ""
      }));

      setComputedMetrics((current) => ({
        ...current,
        [targetRouteId]: {
          distanceKm,
          estimatedDurationMinutes
        }
      }));
      setComputedMetricBaseSignatures((current) => ({
        ...current,
        [targetRouteId]: selectedRouteEntry?.signature || ""
      }));

      setIsEditing(false);
      setSelectedPointIndex(null);
      setSearchResults([]);
      setPendingSearchPoint(null);
      setShowClearConfirm(false);
      setMessage("Route path saved. Live Fleet Map will use this route.");
    } catch {
      setMessage("Could not save route path. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveStraightLineFallback = async () => {
    if (!onSaveWaypoints || !straightLineSave) return;

    setIsSaving(true);
    setMessage("Saving straight-line route path...");

    try {
      await onSaveWaypoints(
        straightLineSave.routeId,
        straightLineSave.points,
        straightLineSave.distanceKm,
        straightLineSave.estimatedDurationMinutes
      );

      setComputedRoads((current) => ({
        ...current,
        [straightLineSave.routeId]: straightLineSave.points
      }));
      setStraightLineSave(null);
      setFallbackWarning(null);
      setIsEditing(false);
      setSelectedPointIndex(null);
      setSearchResults([]);
      setPendingSearchPoint(null);
      setShowClearConfirm(false);
      setMessage("Straight-line route path saved. Review it again when road snapping is available.");
    } catch {
      setMessage("Could not save route path. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const activeRouteName = selectedRouteEntry?.route
    ? getRouteDisplayName(selectedRouteEntry.route)
    : "No route selected";

  return (
    <div className={`route-preview-map-shell ${isFullscreen ? "is-fullscreen" : ""}`}>
      <div
        ref={containerRef}
        className={`route-preview-map-canvas ${isEditing ? "is-editing" : ""}`}
      />

      {isEditing ? (
        <div className="route-edit-search-panel">
          <form onSubmit={searchPlaces} className="route-edit-search-form">
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search stop/place, e.g. SM City Fairview"
            />

            <button
              type="submit"
              className="soft-button"
              disabled={isSearching}
            >
              <Search size={14} />
              {isSearching ? "Searching..." : "Search"}
            </button>
          </form>

          {searchResults.length ? (
            <div className="route-edit-search-results">
              {searchResults.map((result) => (
                <button
                  key={result.place_id}
                  type="button"
                  onClick={() => previewSearchResult(result)}
                >
                  <strong>
                    <Plus size={12} />
                    Add as route point
                  </strong>
                  <span>
                    {shortPlaceName(result.display_name)}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          <p>
            Search is optional. You can still click the map or drag points manually.
          </p>
        </div>
      ) : null}

      {isEditing ? (
        <aside className="route-waypoint-sidebar" aria-label="Manual route waypoint list">
          <header>
            <strong>Waypoints</strong>
            <span>{editPoints.length} points</span>
          </header>

          {editPoints.length ? (
            <ol>
              {editPoints.map((point, index) => (
                <li
                  key={`${index}-${point[0].toFixed(5)}-${point[1].toFixed(5)}`}
                  className={index === selectedPointIndex ? "selected" : ""}
                  draggable
                  onClick={() => setSelectedPointIndex(index)}
                  onDragStart={() => setDraggedPointIndex(index)}
                  onDragEnd={() => setDraggedPointIndex(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (draggedPointIndex !== null) reorderPoint(draggedPointIndex, index);
                  }}
                >
                  <GripVertical size={14} aria-hidden="true" />
                  <span className={`waypoint-sequence ${getMarkerRole(index, editPoints.length)}`}>
                    {index + 1}
                  </span>
                  <span className="waypoint-label">
                    {editPointLabels[index] || formatPointLabel(point)}
                  </span>
                  <button
                    type="button"
                    className="waypoint-remove-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      removePointAtIndex(index);
                    }}
                  >
                    <Trash2 size={13} />
                    Remove
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p>No route points yet.</p>
          )}
        </aside>
      ) : null}

      <div className="route-preview-controls">
        <span className="route-preview-message">
          <strong>{activeRouteName}</strong>
          {" - "}
          {message}
        </span>

        {fallbackWarning ? (
          <div className="route-fallback-warning" role="alert">
            <span>{fallbackWarning}</span>
            {straightLineSave ? (
              <>
                <button type="button" className="soft-button" onClick={saveStraightLineFallback} disabled={isSaving}>
                  Save straight-line
                </button>
                <button
                  type="button"
                  className="soft-button"
                  onClick={() => {
                    setStraightLineSave(null);
                    setFallbackWarning(null);
                    setMessage("Straight-line save cancelled.");
                  }}
                  disabled={isSaving}
                >
                  Cancel
                </button>
              </>
            ) : null}
          </div>
        ) : null}

        <div className="route-preview-action-row">
          {isEditing ? (
            <>
              <span className="route-edit-point-count">
                {editPoints.length} points
              </span>

              <button
                type="button"
                className="soft-button"
                onClick={removeSelectedPoint}
                disabled={selectedPointIndex === null}
              >
                <Trash2 size={14} />
                Delete point
              </button>

              <button
                type="button"
                className="soft-button"
                onClick={() => setShowClearConfirm(true)}
                disabled={!editPoints.length}
              >
                Clear route
              </button>

              {showClearConfirm ? (
                <span className="route-clear-confirm">
                  Clear all {editPoints.length} points?
                  <button
                    type="button"
                    onClick={() => {
                      setEditPoints([]);
                      setEditPointLabels([]);
                      setSelectedPointIndex(null);
                      setSearchResults([]);
                      setPendingSearchPoint(null);
                      setShowClearConfirm(false);
                      setStraightLineSave(null);
                      setFallbackWarning(null);
                      setMessage("Unsaved route points cleared.");
                    }}
                  >
                    Confirm
                  </button>
                  <button type="button" onClick={() => setShowClearConfirm(false)}>
                    Cancel
                  </button>
                </span>
              ) : null}

              <button
                type="button"
                className="soft-button"
                onClick={undoLastPoint}
                disabled={!editPoints.length}
              >
                <Undo2 size={14} />
                Undo
              </button>

              <button
                type="button"
                className="soft-button"
                onClick={recalculatePath}
                disabled={isCalculating || isSaving || editPoints.length < 2}
              >
                <LocateFixed size={14} />
                {isCalculating ? "Calculating..." : "Recalculate road path"}
              </button>

              <button
                type="button"
                className="soft-button primary-action"
                onClick={saveEditedPath}
                disabled={isSaving}
              >
                {isSaving ? "Snapping..." : "Save route path"}
              </button>

              <button
                type="button"
                className="soft-button"
                onClick={toggleEditMode}
              >
                <X size={14} />
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
                >
                  <LocateFixed size={14} />
                  {isCalculating ? "Calculating..." : "Recalculate road path"}
                </button>
              ) : null}
            </>
          )}

          <div className="route-preview-divider" />

          <button
            type="button"
            className={`soft-button ${viewMode === "street" ? "active" : ""}`}
            onClick={() => toggleViewMode("street")}
            title="Street view"
          >
            <Map size={14} />
          </button>

          <button
            type="button"
            className={`soft-button ${viewMode === "satellite" ? "active" : ""}`}
            onClick={() => toggleViewMode("satellite")}
            title="Satellite view"
          >
            <Satellite size={14} />
          </button>

          <button
            type="button"
            className={`soft-button ${isTrafficOn ? "active" : ""}`}
            onClick={toggleTraffic}
            title={isTrafficOn ? "Traffic On" : "Traffic layer if available"}
          >
            <TrafficCone size={14} />
          </button>

          <button
            type="button"
            className="soft-button"
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
