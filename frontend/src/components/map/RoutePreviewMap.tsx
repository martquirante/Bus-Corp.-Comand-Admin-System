"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { RouteConfig } from "@pos-bus/shared";
import {
  LocateFixed,
  Map,
  Maximize2,
  Minimize2,
  Plus,
  Satellite,
  Search,
  TrafficCone,
  Trash2
} from "lucide-react";
import { getRouteDisplayName, normalizeRouteLabel } from "@/utils/routeLines";

type LeafletApi = any;
type LeafletMap = any;
type LeafletLayer = any;

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

declare global {
  interface Window {
    L?: LeafletApi;
    __posBusLeafletLoad?: Promise<LeafletApi>;
  }
}

const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const DEFAULT_CENTER: LatLngPoint = [14.8078, 121.0111];
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

async function fetchFromOsrm(points: LatLngPoint[]) {
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
    points: coordinates.map(([lng, lat]: [number, number]) => [lat, lng] as LatLngPoint),
    distanceKm:
      typeof route.distance === "number" ? Number((route.distance / 1000).toFixed(1)) : undefined,
    estimatedDurationMinutes: trafficAdjustedMinutes
  };
}

async function fetchFromOpenRouteService(points: LatLngPoint[]) {
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

async function fetchRoadGeometry(points: LatLngPoint[]) {
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

const shortPlaceName = (value: string) => {
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.slice(0, 3).join(", ");
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
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

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
        setMessage("Road path preview is ready. Review it, then click Save route path.");
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

  const addSearchResultAsPoint = (result: SearchResult) => {
    const lat = Number(result.lat);
    const lng = Number(result.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setMessage("This search result has no usable map location.");
      return;
    }

    const point: LatLngPoint = [lat, lng];

    setEditPoints((previous) => {
      const next = [...previous, point];
      setSelectedPointIndex(next.length - 1);
      return next;
    });

    const map = mapRef.current;
    if (map) {
      map.setView(point, Math.max(map.getZoom?.() || 13, 14));
    }

    setMessage(`${shortPlaceName(result.display_name)} added as a route point.`);
    setSearchResults([]);
    setSearchQuery("");
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

    const handleClick = (event: any) => {
      if (!isEditing) return;

      const { lat, lng } = event.latlng;

      setEditPoints((previous) => {
        const next = [...previous, [lat, lng]] as LatLngPoint[];
        setSelectedPointIndex(next.length - 1);
        return next;
      });
    };

    map.on("click", handleClick);

    return () => {
      map.off("click", handleClick);
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
          lineCap: "round",
          lineJoin: "round"
        }).addTo(editGroup);
      }

      editPoints.forEach((point, index) => {
        const isSelected = index === selectedPointIndex;
        const label =
          index === 0 ? "Start" : index === editPoints.length - 1 ? "End" : `${index + 1}`;

        const marker = L.marker(point, {
          draggable: true,
          icon: L.divIcon({
            className: `edit-marker ${isSelected ? "selected" : ""}`,
            html: `<div style="display:grid;place-items:center;min-width:28px;height:28px;padding:0 7px;background:${
              isSelected ? "#ffeb3b" : "#fff"
            };border:2px solid #dc3d35;border-radius:999px;color:#111;font-size:10px;font-weight:900;box-shadow:0 6px 14px rgba(0,0,0,.24);">${label}</div>`,
            iconSize: [38, 32],
            iconAnchor: [19, 16]
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
    selectedPointIndex
  ]);

  const toggleEditMode = () => {
    if (isEditing) {
      setIsEditing(false);
      setEditPoints([]);
      setSelectedPointIndex(null);
      setSearchResults([]);
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
    setSelectedPointIndex(null);
    setIsEditing(true);
    setMessage("Manual edit mode: click the map or search a place to add route points.");
  };

  const removeSelectedPoint = () => {
    if (selectedPointIndex === null) return;

    setEditPoints((previous) => previous.filter((_, index) => index !== selectedPointIndex));
    setSelectedPointIndex(null);
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

    const distanceKm = calculateLineDistanceKm(editPoints, mapRef.current);
    const editSignature = getPointSignature(editPoints);
    const previewMetrics =
      computedMetricBaseSignatures[targetRouteId] === editSignature
        ? computedMetrics[targetRouteId]
        : undefined;
    const estimatedDurationMinutes =
      previewMetrics?.estimatedDurationMinutes ||
      estimateTrafficDurationMinutes(distanceKm);

    setIsSaving(true);
    setMessage("Saving route path...");

    try {
      await onSaveWaypoints(targetRouteId, editPoints, distanceKm, estimatedDurationMinutes);

      setComputedRoads((current) => ({
        ...current,
        [targetRouteId]: editPoints
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
      setMessage("Route path saved. Live Fleet Map will use this route.");
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

      {isEditing ? (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            zIndex: 900,
            width: "min(420px, calc(100% - 24px))",
            background: "color-mix(in srgb, var(--surface-strong) 94%, transparent)",
            border: "1px solid var(--line)",
            borderRadius: 14,
            boxShadow: "0 18px 36px rgba(0,0,0,.28)",
            padding: 10
          }}
        >
          <form onSubmit={searchPlaces} style={{ display: "flex", gap: 8 }}>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search stop/place, e.g. SM City Fairview"
              style={{
                flex: 1,
                minWidth: 0,
                border: "1px solid var(--line)",
                borderRadius: 10,
                padding: "9px 10px",
                background: "var(--surface)",
                color: "var(--text)"
              }}
            />

            <button
              type="submit"
              className="soft-button"
              disabled={isSearching}
              style={{ padding: "8px 10px", fontSize: 12 }}
            >
              <Search size={14} />
              {isSearching ? "Searching..." : "Search"}
            </button>
          </form>

          {searchResults.length ? (
            <div
              style={{
                marginTop: 8,
                display: "grid",
                gap: 6,
                maxHeight: 220,
                overflowY: "auto"
              }}
            >
              {searchResults.map((result) => (
                <button
                  key={result.place_id}
                  type="button"
                  onClick={() => addSearchResultAsPoint(result)}
                  style={{
                    textAlign: "left",
                    border: "1px solid var(--line)",
                    borderRadius: 10,
                    padding: "8px 10px",
                    background: "var(--surface)",
                    color: "var(--text)",
                    cursor: "pointer"
                  }}
                >
                  <strong style={{ display: "block", fontSize: 12 }}>
                    <Plus size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                    Add as route point
                  </strong>
                  <span style={{ display: "block", color: "var(--muted)", fontSize: 12 }}>
                    {shortPlaceName(result.display_name)}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          <p style={{ margin: "8px 2px 0", color: "var(--muted)", fontSize: 12 }}>
            Search is optional. You can still click the map or drag points manually.
          </p>
        </div>
      ) : null}

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
          {" - "}
          {message}
        </span>

        <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
          {isEditing ? (
            <>
              <span style={{ color: "var(--muted)", fontSize: 12 }}>
                {editPoints.length} points
              </span>

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
                <Trash2 size={14} />
                Delete point
              </button>

              <button
                type="button"
                className="soft-button"
                onClick={() => {
                  setEditPoints([]);
                  setSelectedPointIndex(null);
                  setSearchResults([]);
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
                disabled={isCalculating || isSaving || editPoints.length < 2}
                style={{ padding: "6px 12px", fontSize: "12px" }}
              >
                <LocateFixed size={14} />
                {isCalculating ? "Calculating..." : "Recalculate road path"}
              </button>

              <button
                type="button"
                className="soft-button primary-action"
                onClick={saveEditedPath}
                disabled={isSaving}
                style={{
                  padding: "6px 12px",
                  fontSize: "12px",
                  opacity: isSaving ? 0.65 : 1,
                  background: "#13a46b",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px"
                }}
              >
                {isSaving ? "Saving..." : "Save route path"}
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
                  <LocateFixed size={14} />
                  {isCalculating ? "Calculating..." : "Recalculate road path"}
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
