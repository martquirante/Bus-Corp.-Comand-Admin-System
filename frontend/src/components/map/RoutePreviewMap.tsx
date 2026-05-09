"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RouteConfig } from "@pos-bus/shared";
import {
  Check,
  GripVertical,
  Map,
  Maximize2,
  Minimize2,
  Satellite,
  Search,
  Trash2,
  Undo2,
  X
} from "lucide-react";
import { getRouteDisplayName, normalizeRouteLabel } from "@/utils/routeLines";
import { MAIN_TERMINALS, TERMINAL_BOUNDS, TERMINAL_ICON_ASSET } from "@/utils/terminals";

export type LatLngPoint = [number, number];

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
  bringToBack?: () => LeafletLayer;
  redraw?: () => LeafletLayer;
  setZIndex?: (zIndex: number) => LeafletLayer;
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
    options?: { zoomControl?: boolean; preferCanvas?: boolean; fadeAnimation?: boolean }
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

export type RoadGeometryResult = {
  points: LatLngPoint[];
  snappedControlPoints?: LatLngPoint[];
  distanceKm?: number;
  estimatedDurationMinutes?: number;
  warning?: string;
  isStraightLineFallback?: boolean;
};

type PendingSearchPoint = {
  point: LatLngPoint;
  label: string;
};

type FareStopSegment = {
  route: RouteConfig;
  anchors: [LatLngPoint, LatLngPoint];
  segment: LatLngPoint[];
  distanceKm?: number;
};

const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const DEFAULT_CENTER: LatLngPoint = [14.8078, 121.0111];
const OPENROUTESERVICE_KEY = process.env.NEXT_PUBLIC_OPENROUTESERVICE_API_KEY;
const MAIN_ROUTE_COLOR = "#0f7ad3";
const FARE_STOP_COLOR = "#7c3aed";
const MAX_FARE_STOP_SNAP_METERS = 300;

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

const getFareStopAnchors = (route: RouteConfig): [LatLngPoint, LatLngPoint] | null => {
  const points = getRoutePoints(route);
  if (points.length < 2) return null;

  return [points[0], points[points.length - 1]];
};

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

export const calculateLineDistanceKm = (points: LatLngPoint[], map?: LeafletMap | null) => {
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

export const estimateTrafficDurationMinutes = (distanceKm?: number) => {
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
  if (json.code !== "Ok" || !json.routes || json.routes.length === 0) {
    throw new Error("Could not find a valid road route.");
  }

  const route = json.routes[0];
  const coordinates = route.geometry.coordinates;

  if (!Array.isArray(coordinates)) {
    throw new Error("Road route service did not return a route line.");
  }

  const baseMinutes = typeof route.duration === "number" ? Math.round(route.duration / 60) : undefined;
  const trafficAdjustedMinutes = baseMinutes ? Math.round(baseMinutes * 1.35) : undefined;
  const routeDistanceKm = typeof route.distance === "number" ? Number((route.distance / 1000).toFixed(1)) : undefined;

  return {
    points: coordinates.map(([lng, lat]: [number, number]) => [lat, lng] as LatLngPoint),
    snappedControlPoints: Array.isArray(json.waypoints)
      ? json.waypoints
          .map((waypoint: { location?: [number, number] }) => waypoint.location)
          .filter((location: unknown): location is [number, number] => Array.isArray(location))
          .map((location: [number, number]) => {
            const [lng, lat] = location;
            return [lat, lng] as LatLngPoint;
          })
      : undefined,
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
    warning: "Road API is offline. Showing straight lines until the provider recovers.",
    isStraightLineFallback: true
  };
};

export async function fetchRoadGeometry(points: LatLngPoint[]): Promise<RoadGeometryResult> {
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

const shortPlaceName = (value: string) => {
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.slice(0, 3).join(", ");
};

const formatPointLabel = ([lat, lng]: LatLngPoint) =>
  `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

const pointsAreNearlyEqual = (left: LatLngPoint[], right: LatLngPoint[]) =>
  left.length === right.length &&
  left.every((point, index) => haversineMeters(point, right[index]) < 1.5);

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

const closestPointOnRoute = (routePoints: LatLngPoint[], point: LatLngPoint) => {
  if (!routePoints.length) return null;

  return routePoints.reduce(
    (best, routePoint, index) => {
      const distanceMeters = haversineMeters(routePoint, point);
      return distanceMeters < best.distanceMeters
        ? { point: routePoint, index, distanceMeters }
        : best;
    },
    {
      point: routePoints[0],
      index: 0,
      distanceMeters: Number.POSITIVE_INFINITY
    }
  );
};

const routeSegmentBetween = (
  routePoints: LatLngPoint[],
  from: LatLngPoint,
  to: LatLngPoint
) => {
  if (routePoints.length < 2) {
    return {
      anchors: [from, to] as [LatLngPoint, LatLngPoint],
      segment: [from, to]
    };
  }

  const start = closestPointOnRoute(routePoints, from);
  const end = closestPointOnRoute(routePoints, to);

  if (!start || !end) {
    return {
      anchors: [from, to] as [LatLngPoint, LatLngPoint],
      segment: [from, to]
    };
  }

  const lower = Math.min(start.index, end.index);
  const upper = Math.max(start.index, end.index);
  const segment = routePoints.slice(lower, upper + 1);
  const orderedSegment = start.index <= end.index ? segment : segment.reverse();

  return {
    anchors: [start.point, end.point] as [LatLngPoint, LatLngPoint],
    segment: orderedSegment.length > 1 ? orderedSegment : [start.point, end.point]
  };
};

const sampleControlPoints = (points: LatLngPoint[], maxPoints = 14) => {
  if (points.length <= maxPoints) return points;

  const indexes = new Set<number>();
  const lastIndex = points.length - 1;

  for (let index = 0; index < maxPoints; index += 1) {
    indexes.add(Math.round((lastIndex * index) / (maxPoints - 1)));
  }

  return [...indexes].sort((a, b) => a - b).map((index) => points[index]);
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
  editableRouteId,
  draftRouteName,
  seedControlPoints = [],
  fareStops = [],
  activeFareStopId,
  fareStopDraftPoints = [],
  fareStopLabels,
  onFareStopDraftChange,
  onFareStopMetrics,
  onRouteMetrics,
  onSaveWaypoints
}: {
  routes: RouteConfig[];
  selectedRouteId?: string | null;
  editableRouteId?: string | null;
  draftRouteName?: string;
  seedControlPoints?: LatLngPoint[];
  fareStops?: RouteConfig[];
  activeFareStopId?: string | null;
  fareStopDraftPoints?: LatLngPoint[];
  fareStopLabels?: { origin?: string; destination?: string };
  onFareStopDraftChange?: (points: LatLngPoint[]) => void;
  onFareStopMetrics?: (metrics: { distanceKm?: number; estimatedDurationMinutes?: number }) => void;
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
  const shellRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LeafletLayer | null>(null);
  const editLayerRef = useRef<LeafletLayer | null>(null);
  const streetLayerRef = useRef<LeafletLayer | null>(null);
  const satelliteLayerRef = useRef<LeafletLayer | null>(null);
  const metricsCallbackRef = useRef<typeof onRouteMetrics>(onRouteMetrics);

  const [message, setMessage] = useState<string>("Showing saved waypoints.");
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"street" | "satellite">("street");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [controlPoints, setControlPoints] = useState<LatLngPoint[]>([]);
  const [snappedPath, setSnappedPath] = useState<LatLngPoint[]>([]);
  const [editPointLabels, setEditPointLabels] = useState<string[]>([]);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const [selectedFarePointIndex, setSelectedFarePointIndex] = useState<number | null>(null);
  const [draggedPointIndex, setDraggedPointIndex] = useState<number | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [pendingSearchPoint, setPendingSearchPoint] = useState<PendingSearchPoint | null>(null);
  const [fallbackWarning, setFallbackWarning] = useState<string | null>(null);
  const [currentMetrics, setCurrentMetrics] = useState<{
    distanceKm?: number;
    estimatedDurationMinutes?: number;
  }>({});

  const isFareStopMapping = Boolean(onFareStopDraftChange && activeFareStopId);

  useEffect(() => {
    metricsCallbackRef.current = onRouteMetrics;
  }, [onRouteMetrics]);

  const visibleRoutes = useMemo(
    () =>
      routes
        .map((route) => {
          const points = getRoutePoints(route);
          return { route, points };
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

  const mainRoutePoints = useMemo(
    () => selectedRouteEntry?.points || [],
    [selectedRouteEntry]
  );

  const fareStopSegments = useMemo<FareStopSegment[]>(
    () => {
      if (mainRoutePoints.length < 2) return [];

      const segments: FareStopSegment[] = [];

      fareStops.forEach((route) => {
        const anchors = getFareStopAnchors(route);
        if (!anchors) return;

        const snapped = routeSegmentBetween(mainRoutePoints, anchors[0], anchors[1]);

        segments.push({
          route,
          anchors: snapped.anchors,
          segment: snapped.segment,
          distanceKm: calculateLineDistanceKm(snapped.segment)
        });
      });

      return segments;
    },
    [fareStops, mainRoutePoints]
  );

  const activeFareStopSegment = useMemo(() => {
    if (fareStopDraftPoints.length < 2 || mainRoutePoints.length < 2) return null;
    return routeSegmentBetween(mainRoutePoints, fareStopDraftPoints[0], fareStopDraftPoints[1]);
  }, [fareStopDraftPoints, mainRoutePoints]);

  useEffect(() => {
    if (!onFareStopMetrics) return;

    if (!activeFareStopSegment || activeFareStopSegment.segment.length < 2) {
      onFareStopMetrics({});
      return;
    }

    const distanceKm = calculateLineDistanceKm(activeFareStopSegment.segment, mapRef.current);
    onFareStopMetrics({
      distanceKm,
      estimatedDurationMinutes: estimateTrafficDurationMinutes(distanceKm)
    });
  }, [activeFareStopSegment, onFareStopMetrics]);

  useEffect(() => {
    if (!isEditing) return;

    if (controlPoints.length < 2) {
      setSnappedPath(controlPoints);
      setCurrentMetrics({});
      return;
    }

    const timer = window.setTimeout(async () => {
      setIsCalculating(true);
      setMessage("Snapping route to roads with OSRM...");

      try {
        const result = await fetchRoadGeometry(controlPoints);

        setSnappedPath(result.points);
        if (
          result.snappedControlPoints?.length === controlPoints.length &&
          !pointsAreNearlyEqual(result.snappedControlPoints, controlPoints)
        ) {
          setControlPoints(result.snappedControlPoints);
          setEditPointLabels((previous) =>
            previous.map((label, index) =>
              label === formatPointLabel(controlPoints[index])
                ? formatPointLabel(result.snappedControlPoints?.[index] || controlPoints[index])
                : label
            )
          );
        }
        setFallbackWarning(result.warning || null);
        setMessage(
          result.isStraightLineFallback
            ? "Road snap unavailable. Save is blocked until the road router responds."
            : "Route is snapped to the road. Click or drag points to refine."
        );

        const distanceKm = result.distanceKm || calculateLineDistanceKm(result.points);
        const estimatedDurationMinutes =
          result.estimatedDurationMinutes || estimateTrafficDurationMinutes(distanceKm);

        setCurrentMetrics({ distanceKm, estimatedDurationMinutes });
      } catch {
        setSnappedPath(controlPoints);
        setFallbackWarning("Road API unavailable.");
        setMessage("Road API unavailable. Showing straight lines.");
      } finally {
        setIsCalculating(false);
      }
    }, 600);

    return () => window.clearTimeout(timer);
  }, [controlPoints, isEditing]);

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

  const addEditPoint = useCallback(
    (point: LatLngPoint, label?: string) => {
      const nextIndex = controlPoints.length >= 2 ? controlPoints.length - 1 : controlPoints.length;
      const pointLabel = label || formatPointLabel(point);

      setControlPoints((previous) => {
        if (previous.length < 2) return [...previous, point];
        const next = [...previous];
        next.splice(next.length - 1, 0, point);
        return next;
      });
      setEditPointLabels((previous) => {
        if (previous.length < 2) return [...previous, pointLabel];
        const next = [...previous];
        next.splice(next.length - 1, 0, pointLabel);
        return next;
      });
      setSelectedPointIndex(nextIndex);
      setShowClearConfirm(false);

      if (!label) {
        updatePointLabelFromGeocode(nextIndex, point);
      }
    },
    [
      controlPoints.length,
      setControlPoints,
      setEditPointLabels,
      setSelectedPointIndex,
      setShowClearConfirm,
      updatePointLabelFromGeocode
    ]
  );

  const setFareStopPoint = useCallback(
    (point: LatLngPoint, index?: number) => {
      if (!onFareStopDraftChange) return;

      if (mainRoutePoints.length < 2) {
        setMessage("Map the main blue route first before assigning fare stop A/B.");
        return;
      }

      const snap = closestPointOnRoute(mainRoutePoints, point);
      if (!snap) return;

      if (snap.distanceMeters > MAX_FARE_STOP_SNAP_METERS) {
        setMessage("Fare Stop Matrix points must be placed on or very near the blue main route.");
        return;
      }

      const next = [...fareStopDraftPoints];

      if (typeof index === "number") {
        next[index] = snap.point;
        setSelectedFarePointIndex(index);
      } else if (next.length < 2) {
        next.push(snap.point);
        setSelectedFarePointIndex(next.length - 1);
      } else {
        next[1] = snap.point;
        setSelectedFarePointIndex(1);
      }

      onFareStopDraftChange(next.slice(0, 2));
      setMessage(
        next.length >= 2
          ? "Fare stop segment follows the blue main route only."
          : "Point A set. Click the blue route again for point B."
      );
    },
    [
      fareStopDraftPoints,
      mainRoutePoints,
      onFareStopDraftChange,
      setMessage,
      setSelectedFarePointIndex
    ]
  );

  const updateEditPoint = useCallback(
    (index: number, point: LatLngPoint) => {
      setControlPoints((previous) => {
        const next = [...previous];
        next[index] = point;
        return next;
      });
      setEditPointLabels((previous) => {
        const next = [...previous];
        next[index] = formatPointLabel(point);
        return next;
      });
      updatePointLabelFromGeocode(index, point);
    },
    [setControlPoints, setEditPointLabels, updatePointLabelFromGeocode]
  );

  const removePointAtIndex = useCallback((index: number) => {
    setControlPoints((previous) => previous.filter((_, pointIndex) => pointIndex !== index));
    setEditPointLabels((previous) => previous.filter((_, pointIndex) => pointIndex !== index));
    setSelectedPointIndex(null);
    setShowClearConfirm(false);
  }, [setControlPoints, setEditPointLabels, setSelectedPointIndex, setShowClearConfirm]);

  const reorderPoint = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;

    setControlPoints((previous) => {
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
  }, [
    setControlPoints,
    setDraggedPointIndex,
    setEditPointLabels,
    setSelectedPointIndex
  ]);

  const undoLastPoint = useCallback(() => {
    if (controlPoints.length <= 2) return;
    removePointAtIndex(controlPoints.length - 2);
    setMessage("Last via point removed.");
  }, [controlPoints.length, removePointAtIndex, setMessage]);

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
          ? "Select a search result to place it on the map."
          : "No place found. Try a more specific place name."
      );
    } catch {
      setMessage("Search is unavailable right now. You can still click the map.");
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
    setFallbackWarning(null);

    const map = mapRef.current;
    if (map) {
      map.flyTo(point, 15);
    }

    setMessage(`${label} selected. Confirm on the map.`);
    setSearchResults([]);
    setSearchQuery("");
  };

  const confirmPendingSearchPoint = useCallback(() => {
    if (!pendingSearchPoint) return;

    if (isFareStopMapping) {
      setFareStopPoint(pendingSearchPoint.point);
      setMessage(`${pendingSearchPoint.label} snapped to the main route.`);
    } else {
      addEditPoint(pendingSearchPoint.point, pendingSearchPoint.label);
      setMessage(`${pendingSearchPoint.label} added as a control point.`);
    }

    setPendingSearchPoint(null);
  }, [
    addEditPoint,
    isFareStopMapping,
    pendingSearchPoint,
    setFareStopPoint,
    setMessage,
    setPendingSearchPoint
  ]);

  const cancelPendingSearchPoint = useCallback(() => {
    setPendingSearchPoint(null);
    setMessage("Search preview cancelled.");
  }, [setMessage, setPendingSearchPoint]);

  const drawTerminalMarkers = useCallback((L: LeafletApi, target: LeafletLayerTarget) => {
    MAIN_TERMINALS.forEach((terminal) => {
      L.marker(terminal.position, {
        icon: L.divIcon({
          className: "route-config-terminal-icon-shell",
          html: `
            <div class="route-config-terminal-marker terminal-${terminal.id}">
              <img src="${TERMINAL_ICON_ASSET}" alt="" />
              <strong>${escapeHtml(terminal.label)}</strong>
            </div>
          `,
          iconSize: [88, 78],
          iconAnchor: [44, 56],
          popupAnchor: [0, -44]
        })
      })
        .addTo(target)
        .bindPopup(
          `<div class="leaflet-command-popup"><strong>${escapeHtml(terminal.name)}</strong><span>${escapeHtml(terminal.plusCode)}</span><p>${escapeHtml(terminal.address)}</p></div>`
        );
    });
  }, []);

  const ensureVisibleBaseLayer = useCallback(() => {
    const map = mapRef.current;
    const street = streetLayerRef.current;
    const satellite = satelliteLayerRef.current;

    if (!map || !street || !satellite) return;

    const activateBaseLayer = (layer: LeafletLayer) => {
      if (!map.hasLayer(layer)) layer.addTo(map);
      layer.setZIndex?.(1);
      layer.bringToBack?.();
      layer.redraw?.();
    };

    if (viewMode === "satellite") {
      if (map.hasLayer(street)) map.removeLayer(street);
      activateBaseLayer(satellite);
      return;
    }

    if (map.hasLayer(satellite)) map.removeLayer(satellite);
    activateBaseLayer(street);
  }, [viewMode]);

  useEffect(() => {
    let cancelled = false;

    ensureLeaflet()
      .then((L) => {
        if (cancelled || !containerRef.current || mapRef.current) return;

        const map = L.map(containerRef.current, {
          zoomControl: false,
          preferCanvas: false,
          fadeAnimation: false
        }).setView(DEFAULT_CENTER, 12);

        L.control.zoom({ position: "bottomright" }).addTo(map);

        streetLayerRef.current = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "(c) OpenStreetMap contributors",
          className: "route-map-base-tile-layer",
          crossOrigin: true,
          keepBuffer: 4,
          maxZoom: 19,
          updateWhenIdle: false,
          zIndex: 1
        }).addTo(map);

        satelliteLayerRef.current = L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          {
            attribution: "Tiles (c) Esri",
            className: "route-map-base-tile-layer",
            crossOrigin: true,
            keepBuffer: 4,
            maxZoom: 19,
            updateWhenIdle: false,
            zIndex: 1
          }
        );

        mapRef.current = map;

        window.setTimeout(() => map.invalidateSize({ animate: true }), 120);
      })
      .catch(() => setMessage("The map service is unavailable right now. Try again later."));

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    ensureVisibleBaseLayer();
    const map = mapRef.current;
    if (!map) return;

    const timer = window.setTimeout(() => map.invalidateSize({ animate: true }), 80);
    return () => window.clearTimeout(timer);
  }, [ensureVisibleBaseLayer]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleClick = (event: LeafletMapMouseEvent) => {
      const { lat, lng } = event.latlng;

      if (isEditing) {
        addEditPoint([lat, lng]);
        return;
      }

      if (isFareStopMapping) {
        setFareStopPoint([lat, lng]);
      }
    };

    map.on("click", handleClick);

    return () => {
      map.off("click", handleClick);
    };
  }, [addEditPoint, isEditing, isFareStopMapping, setFareStopPoint]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    ensureVisibleBaseLayer();
    const timer = window.setTimeout(() => {
      ensureVisibleBaseLayer();
      map.invalidateSize({ animate: true });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [activeFareStopId, ensureVisibleBaseLayer, isFullscreen, routes.length, selectedRouteId]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsFullscreen(false);
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === shellRef.current);
      ensureVisibleBaseLayer();
      window.setTimeout(() => {
        ensureVisibleBaseLayer();
        mapRef.current?.invalidateSize({ animate: true });
      }, 120);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [ensureVisibleBaseLayer]);

  const toggleMapFullscreen = async () => {
    const shell = shellRef.current;
    if (!shell) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      } else {
        await shell.requestFullscreen();
        setIsFullscreen(true);
      }
    } catch {
      setIsFullscreen((value) => !value);
    } finally {
      ensureVisibleBaseLayer();
      window.setTimeout(() => {
        ensureVisibleBaseLayer();
        mapRef.current?.invalidateSize({ animate: true });
      }, 160);
    }
  };

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
  }, [isEditing, undoLastPoint]);

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

  useEffect(() => {
    const map = mapRef.current;
    const L = (window as LeafletWindow).L;
    if (!map || !L) return;

    let cancelled = false;
    ensureVisibleBaseLayer();

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

      drawTerminalMarkers(L, editGroup);

      if (snappedPath.length > 1) {
        L.polyline(snappedPath, {
          color: MAIN_ROUTE_COLOR,
          weight: 7,
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
            `<div class="search-preview-popup"><strong>${escapeHtml(pendingSearchPoint.label)}</strong><div><button type="button" data-route-preview-action="add">Add point</button><button type="button" data-route-preview-action="cancel">Cancel</button></div></div>`,
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

      controlPoints.forEach((point, index) => {
        const isSelected = index === selectedPointIndex;
        const role = getMarkerRole(index, controlPoints.length);
        const label = index === 0 ? "Start" : index === controlPoints.length - 1 ? "End" : `${index + 1}`;

        const marker = L.marker(point, {
          draggable: role === "waypoint",
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

      const bounds = controlPoints.length ? controlPoints : seedControlPoints;
      if (bounds.length) {
        if (draggedPointIndex === null) {
          map.fitBounds(bounds, { padding: [42, 42], maxZoom: 15 });
        }
      } else {
        map.fitBounds(TERMINAL_BOUNDS, { padding: [42, 42], maxZoom: 11 });
      }

      window.setTimeout(() => map.invalidateSize({ animate: true }), 100);

      return () => {
        cancelled = true;
      };
    }

    const group = L.layerGroup().addTo(map);
    layerRef.current = group;
    drawTerminalMarkers(L, group);

    const allBounds: LatLngPoint[] = [...TERMINAL_BOUNDS];
    let drawnRouteCount = 0;

    for (const entry of visibleRoutes) {
      if (cancelled) break;

      const entryRouteExtra = asRouteExtra(entry.route);
      const isSelected = selectedRouteId
        ? entry.route.id === selectedRouteId
        : visibleRoutes.length === 1;
      const routePoints = entry.points;

      if (routePoints.length < 2) continue;
      drawnRouteCount += 1;

      L.polyline(routePoints, {
        color: MAIN_ROUTE_COLOR,
        weight: isSelected ? 8 : 4,
        opacity: isSelected ? 1 : 0.24,
        lineCap: "round",
        lineJoin: "round"
      })
        .addTo(group)
        .bindPopup(
          `<strong>${escapeHtml(getRouteDisplayName(entry.route))}</strong><br/>Main route line<br/>${routePoints.length} saved road points`
        );

      routePoints.forEach((point) => allBounds.push(point));

      const first = routePoints[0];
      const last = routePoints[routePoints.length - 1];

      if (first) {
        L.marker(first, {
          icon: L.divIcon({
            className: "route-terminal-marker origin",
            html: `<span>Start: ${escapeHtml(normalizeRouteLabel(entry.route.origin || "Origin"))}</span>`,
            iconSize: [170, 28],
            iconAnchor: [85, 14]
          })
        }).addTo(group);
      }

      if (last) {
        L.marker(last, {
          icon: L.divIcon({
            className: "route-terminal-marker finish",
            html: `<span>End: ${escapeHtml(normalizeRouteLabel(entry.route.destination || "Destination"))}</span>`,
            iconSize: [170, 28],
            iconAnchor: [85, 14]
          })
        }).addTo(group);
      }

      const distanceKm = entry.route.distanceKm ?? entry.route.distance ?? calculateLineDistanceKm(routePoints, map);
      const estimatedDurationMinutes =
        entryRouteExtra.trafficDurationMinutes ??
        entry.route.estimatedDurationMinutes ??
        estimateTrafficDurationMinutes(distanceKm);

      metricsCallbackRef.current?.(entry.route.id, {
        distanceKm,
        estimatedDurationMinutes
      });
    }

    fareStopSegments.forEach((fareStop) => {
      const isActive = fareStop.route.id === activeFareStopId;

      L.polyline(fareStop.segment, {
        color: FARE_STOP_COLOR,
        weight: isActive ? 7 : 5,
        opacity: isActive ? 0.94 : 0.52,
        lineCap: "round",
        lineJoin: "round"
      })
        .addTo(group)
        .bindPopup(
          `<strong>${escapeHtml(normalizeRouteLabel(fareStop.route.origin))} to ${escapeHtml(normalizeRouteLabel(fareStop.route.destination))}</strong><br/>Fare Stop Matrix segment<br/>${fareStop.distanceKm || "Mapped"} km along main route`
        );

      fareStop.anchors.forEach((point, index) => {
        L.marker(point, {
          icon: L.divIcon({
            className: `fare-stop-anchor-marker ${index === 0 ? "point-a" : "point-b"}`,
            html: `<span>${index === 0 ? "A" : "B"}</span>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
          })
        }).addTo(group);
        allBounds.push(point);
      });
    });

    if (activeFareStopSegment) {
      L.polyline(activeFareStopSegment.segment, {
        color: FARE_STOP_COLOR,
        weight: 8,
        opacity: 0.96,
        lineCap: "round",
        lineJoin: "round"
      }).addTo(group);
    }

    if (isFareStopMapping) {
      if (pendingSearchPoint) {
        const previewMarker = L.marker(pendingSearchPoint.point, {
          icon: L.divIcon({
            className: "search-preview-marker",
            html: `<div class="search-preview-dot"></div>`,
            iconSize: [34, 34],
            iconAnchor: [17, 17]
          })
        })
          .addTo(group)
          .bindPopup(
            `<div class="search-preview-popup"><strong>${escapeHtml(pendingSearchPoint.label)}</strong><div><button type="button" data-route-preview-action="add">Set A/B</button><button type="button" data-route-preview-action="cancel">Cancel</button></div></div>`,
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

      fareStopDraftPoints.forEach((point, index) => {
        const marker = L.marker(point, {
          draggable: true,
          icon: L.divIcon({
            className: `fare-stop-anchor-marker draft ${index === 0 ? "point-a" : "point-b"} ${
              selectedFarePointIndex === index ? "selected" : ""
            }`,
            html: `<span>${index === 0 ? "A" : "B"}</span>`,
            iconSize: [34, 34],
            iconAnchor: [17, 17]
          })
        }).addTo(group);

        marker.on("click", (event: unknown) => {
          L.DomEvent.stopPropagation(event);
          setSelectedFarePointIndex(index);
        });

        marker.on("dragend", (event: LeafletMarkerEvent) => {
          const nextPosition = event.target.getLatLng();
          setFareStopPoint([nextPosition.lat, nextPosition.lng], index);
        });

        allBounds.push(point);
      });
    }

    if (!cancelled) {
      if (drawnRouteCount > 0 || fareStopSegments.length || fareStopDraftPoints.length) {
        map.fitBounds(allBounds, { padding: [46, 46], maxZoom: 15 });
        setMessage(
          isFareStopMapping
            ? "Click the blue route to set A and B. Purple line follows the main route only."
            : "Showing saved main route and fare stop segments."
        );
      } else {
        setMessage("No main route path yet. Click Map Custom Route to start from the terminals.");
        map.fitBounds(TERMINAL_BOUNDS, { padding: [42, 42], maxZoom: 11 });
      }

      window.setTimeout(() => map.invalidateSize({ animate: true }), 180);
    }

    return () => {
      cancelled = true;
    };
  }, [
    activeFareStopId,
    activeFareStopSegment,
    cancelPendingSearchPoint,
    confirmPendingSearchPoint,
    controlPoints,
    drawTerminalMarkers,
    draggedPointIndex,
    fareStopDraftPoints,
    fareStopSegments,
    isEditing,
    isFareStopMapping,
    mainRoutePoints,
    pendingSearchPoint,
    seedControlPoints,
    selectedFarePointIndex,
    selectedPointIndex,
    selectedRouteId,
    setFareStopPoint,
    snappedPath,
    updateEditPoint,
    visibleRoutes,
    ensureVisibleBaseLayer
  ]);

  const toggleEditMode = () => {
    if (isEditing) {
      setIsEditing(false);
      setControlPoints([]);
      setSnappedPath([]);
      setEditPointLabels([]);
      setSelectedPointIndex(null);
      setSearchResults([]);
      setPendingSearchPoint(null);
      setShowClearConfirm(false);
      setFallbackWarning(null);
      setMessage("Route editing cancelled.");
      return;
    }

    const existingPoints = selectedRouteEntry?.points || [];
    const initialPoints = existingPoints.length
      ? sampleControlPoints(existingPoints)
      : seedControlPoints;

    setControlPoints(initialPoints);
    setSnappedPath(existingPoints.length ? existingPoints : initialPoints);
    setEditPointLabels(initialPoints.map((point, index) => {
      if (index === 0) return "Start terminal";
      if (index === initialPoints.length - 1) return "End terminal";
      return formatPointLabel(point);
    }));
    setSelectedPointIndex(initialPoints.length ? initialPoints.length - 1 : null);
    setPendingSearchPoint(null);
    setShowClearConfirm(false);
    setFallbackWarning(null);
    setIsEditing(true);
    setMessage(
      existingPoints.length
        ? "Editing saved route. Drag points or search places to adjust the road path."
        : "Draft route started from terminal endpoints. Add points so OSRM follows the right roads."
    );
  };

  const saveEditedPath = async () => {
    const routeIdForSave = editableRouteId || selectedRouteId;
    if (!onSaveWaypoints || !routeIdForSave) return;

    if (snappedPath.length < 2) {
      setMessage("Add at least 2 map points on the road before saving.");
      return;
    }

    setIsSaving(true);
    setFallbackWarning(null);
    setMessage("Saving road-snapped route path...");

    try {
      const distanceKm = currentMetrics.distanceKm || calculateLineDistanceKm(snappedPath, mapRef.current);
      const estimatedDurationMinutes =
        currentMetrics.estimatedDurationMinutes || estimateTrafficDurationMinutes(distanceKm);

      await onSaveWaypoints(routeIdForSave, snappedPath, distanceKm, estimatedDurationMinutes);

      setIsEditing(false);
      setSelectedPointIndex(null);
      setSearchResults([]);
      setPendingSearchPoint(null);
      setShowClearConfirm(false);
      setMessage("Route path saved. Reverse direction will follow the same road path in reverse.");
    } catch {
      setMessage("Could not save route path. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const activeRouteName = selectedRouteEntry?.route
    ? getRouteDisplayName(selectedRouteEntry.route)
    : draftRouteName || "New main route";

  const showSearchPanel = isEditing || isFareStopMapping;
  const canSaveRoute = isEditing && !isSaving && !isCalculating && snappedPath.length >= 2 && !fallbackWarning;
  const viaPointCount = Math.max(controlPoints.length - 2, 0);

  return (
    <div ref={shellRef} className={`route-preview-map-shell ${isFullscreen ? "is-fullscreen" : ""}`}>
      <div
        ref={containerRef}
        className={`route-preview-map-canvas ${isEditing || isFareStopMapping ? "is-editing" : ""}`}
      />

      <div className={`route-mapper-toolbar ${isEditing ? "is-plotting" : ""}`}>
        <div className="route-mapper-toolbar-title">
          <Map size={18} />
          <strong>Route Mapper</strong>
          <span>{isEditing ? `${viaPointCount} via points` : "Ready"}</span>
        </div>

        <div className="route-mapper-toolbar-actions">
          {isEditing ? (
            <>
              <button
                type="button"
                className="route-toolbar-danger"
                onClick={() => setShowClearConfirm(true)}
                disabled={!controlPoints.length}
              >
                <X size={15} />
                Clear plot
              </button>

              {showClearConfirm ? (
                <span className="route-toolbar-confirm">
                  Clear?
                  <button
                    type="button"
                    onClick={() => {
                      setControlPoints(seedControlPoints);
                      setSnappedPath(seedControlPoints);
                      setEditPointLabels(seedControlPoints.map((_, index) =>
                        index === 0 ? "Start terminal" : "End terminal"
                      ));
                      setSelectedPointIndex(seedControlPoints.length ? seedControlPoints.length - 1 : null);
                      setSearchResults([]);
                      setPendingSearchPoint(null);
                      setShowClearConfirm(false);
                      setFallbackWarning(null);
                      setMessage("Plot cleared. Click the map to route through roads.");
                    }}
                  >
                    Yes
                  </button>
                  <button type="button" onClick={() => setShowClearConfirm(false)}>
                    No
                  </button>
                </span>
              ) : null}

              <button type="button" onClick={undoLastPoint} disabled={controlPoints.length <= 2}>
                <Undo2 size={15} />
                Undo
              </button>

              <button
                type="button"
                className="route-toolbar-primary"
                onClick={saveEditedPath}
                disabled={!canSaveRoute}
              >
                <Check size={16} />
                {isSaving ? "Saving..." : isCalculating ? "Routing..." : "Finish plotting"}
              </button>
            </>
          ) : onSaveWaypoints ? (
            <button type="button" className="route-toolbar-primary" onClick={toggleEditMode}>
              <Map size={16} />
              Plot main route
            </button>
          ) : null}

          {isEditing ? (
            <button type="button" onClick={toggleEditMode}>
              Cancel
            </button>
          ) : null}

          <span className="route-toolbar-divider" />

          <button
            type="button"
            className={viewMode === "street" ? "active" : ""}
            onClick={() => toggleViewMode("street")}
            title="Street map"
          >
            <Map size={15} />
            Map
          </button>

          <button
            type="button"
            className={viewMode === "satellite" ? "active" : ""}
            onClick={() => toggleViewMode("satellite")}
            title="Satellite map"
          >
            <Satellite size={15} />
            Sat
          </button>

          {!isFullscreen ? (
            <button
              type="button"
              onClick={toggleMapFullscreen}
              title="Fullscreen map"
            >
              <Maximize2 size={15} />
              Fullscreen
            </button>
          ) : null}
        </div>
      </div>

      <div className="route-preview-legend">
        <span><i className="legend-main-route" /> Main route</span>
        <span><i className="legend-fare-stop" /> Fare stop segment</span>
        <span><i className="legend-terminal" /> Terminal</span>
        <span><i className="legend-draft-point" /> Editable point</span>
      </div>

      {showSearchPanel ? (
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
                    <Map size={12} />
                    {isFareStopMapping ? "Use on main line" : "Use as route point"}
                  </strong>
                  <span>
                    {shortPlaceName(result.display_name)}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          <p>
            {isFareStopMapping ? (
              <>
                <b>Fare Stop Matrix:</b> A and B snap to the blue main route only.
              </>
            ) : (
              <>
                <b>Auto-snap mode:</b> Click roads or search places. OSRM calculates the real street path.
              </>
            )}
          </p>
        </div>
      ) : null}

      {isEditing ? (
        <aside className="route-waypoint-sidebar" aria-label="Manual route waypoint list">
          <header>
            <strong>Control Points</strong>
            <span>{controlPoints.length} points</span>
          </header>

          {controlPoints.length ? (
            <ol>
              {controlPoints.map((point, index) => (
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
                  <span className={`waypoint-sequence ${getMarkerRole(index, controlPoints.length)}`}>
                    {index + 1}
                  </span>
                  <span className="waypoint-label">
                    {editPointLabels[index] || formatPointLabel(point)}
                  </span>
                  <button
                    type="button"
                    className="waypoint-remove-button"
                    disabled={index === 0 || index === controlPoints.length - 1}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (index === 0 || index === controlPoints.length - 1) return;
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
            <p>No control points yet. Click the map to start.</p>
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
          </div>
        ) : null}

        <div className="route-preview-action-row">
          {isFareStopMapping ? (
            <>
              <span className="fare-stop-map-status">
                {fareStopLabels?.origin || "A"} to {fareStopLabels?.destination || "B"} / {fareStopDraftPoints.length}/2 points
              </span>
              <button
                type="button"
                className="soft-button"
                onClick={() => {
                  onFareStopDraftChange?.([]);
                  setSelectedFarePointIndex(null);
                  setMessage("Fare stop A/B cleared. Click the blue route to remap.");
                }}
                disabled={!fareStopDraftPoints.length}
              >
                Clear A/B
              </button>
            </>
          ) : null}

          {isEditing ? (
            <>
              <button
                type="button"
                className="soft-button"
                onClick={() => setShowClearConfirm(true)}
                disabled={!controlPoints.length}
              >
                Clear route
              </button>

              {showClearConfirm ? (
                <span className="route-clear-confirm">
                  Clear all points?
                  <button
                    type="button"
                    onClick={() => {
                      setControlPoints([]);
                      setSnappedPath([]);
                      setEditPointLabels([]);
                      setSelectedPointIndex(null);
                      setSearchResults([]);
                      setPendingSearchPoint(null);
                      setShowClearConfirm(false);
                      setFallbackWarning(null);
                      setMessage("Cleared. Ready to map a new route.");
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
                disabled={controlPoints.length <= 2}
              >
                <Undo2 size={14} />
                Undo
              </button>

              <button
                type="button"
                className="soft-button primary-action"
                onClick={saveEditedPath}
                disabled={!canSaveRoute}
              >
                {isSaving ? "Saving map..." : isCalculating ? "Snapping..." : "Save Route Path"}
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
              {onSaveWaypoints ? (
                <button
                  type="button"
                  className="soft-button primary-action"
                  onClick={toggleEditMode}
                >
                  Map Custom Route
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
            className={`soft-button ${isFullscreen ? "active primary-action" : ""}`}
            onClick={toggleMapFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen map"}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            <span style={{ marginLeft: 4 }}>{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
