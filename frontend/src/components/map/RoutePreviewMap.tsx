"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RouteConfig } from "@pos-bus/shared";
import { Maximize2, Minimize2, Map, Satellite, TrafficCone } from "lucide-react";
import { getRouteDisplayName } from "@/utils/routeLines";

type LeafletApi = any;
type LeafletMap = any;
type LeafletLayer = any;

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
    script.onload = () => (window.L ? resolve(window.L) : reject(new Error("Map library did not start.")));
    script.onerror = () => reject(new Error("The map service is unavailable right now. Try again later."));
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
    .map((point) => [point.lat as number, point.lng as number] as [number, number]);

  if (waypointPoints.length > 1) return waypointPoints;

  return (route.stops || [])
    .filter(hasCoordinate)
    .map((point) => [point.lat as number, point.lng as number] as [number, number]);
};

async function fetchFromOsrm(points: [number, number][]) {
  const coords = points.map(([lat, lng]) => `${lng},${lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;

  const response = await fetch(url);
  if (!response.ok) throw new Error("OSRM route preview could not be generated.");

  const json = await response.json();
  const route = json?.routes?.[0];
  const coordinates = route?.geometry?.coordinates;
  if (!Array.isArray(coordinates)) throw new Error("OSRM route preview did not return route geometry.");

  const baseMinutes = typeof route.duration === "number" ? Math.round(route.duration / 60) : undefined;
  const trafficAdjustedMinutes = baseMinutes ? Math.round(baseMinutes * 1.35) : undefined;

  return {
    points: coordinates.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]),
    distanceKm: typeof route.distance === "number" ? Number((route.distance / 1000).toFixed(1)) : undefined,
    estimatedDurationMinutes: trafficAdjustedMinutes
  };
}

async function fetchFromOpenRouteService(points: [number, number][]) {
  if (!OPENROUTESERVICE_KEY) throw new Error("OpenRouteService API key is not configured.");

  const coords = points.map(([lat, lng]) => `${lng},${lat}`).join("|");
  const url = `https://api.openrouteservice.org/v2/directions/driving-car/geojson`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: OPENROUTESERVICE_KEY
    },
    body: JSON.stringify({ coordinates: points.map(([lat, lng]) => [lng, lat]) })
  });

  if (!response.ok) throw new Error("OpenRouteService route preview could not be generated.");

  const json = await response.json();
  const route = json?.features?.[0]?.properties?.segments?.[0];
  const coordinates = json?.features?.[0]?.geometry?.coordinates;
  if (!Array.isArray(coordinates)) throw new Error("OpenRouteService route preview did not return route geometry.");

  const baseMinutes = route?.duration ? Math.round(route.duration / 60) : undefined;
  const trafficAdjustedMinutes = baseMinutes ? Math.round(baseMinutes * 1.35) : undefined;

  return {
    points: coordinates.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]),
    distanceKm: route?.distance ? Number((route.distance / 1000).toFixed(1)) : undefined,
    estimatedDurationMinutes: trafficAdjustedMinutes
  };
}

async function fetchRoadGeometry(points: [number, number][]) {
  if (points.length < 2) return { points, distanceKm: undefined, estimatedDurationMinutes: undefined };

  try {
    return await fetchFromOsrm(points);
  } catch (error) {
    if (OPENROUTESERVICE_KEY) {
      try {
        return await fetchFromOpenRouteService(points);
      } catch {
        throw new Error("Road preview is unavailable right now. Showing saved route preview.");
      }
    }
    throw new Error("Road preview is unavailable right now. Showing saved route preview.");
  }
}

export function RoutePreviewMap({
  routes,
  selectedRouteId,
  onRouteMetrics,
  onSaveWaypoints
}: {
  routes: RouteConfig[];
  selectedRouteId?: string | null;
  onRouteMetrics?: (routeId: string, metrics: { distanceKm?: number; estimatedDurationMinutes?: number }) => void;
  onSaveWaypoints?: (routeId: string, points: [number, number][], distanceKm?: number, estimatedDurationMinutes?: number) => void;
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

  const recalculatePath = async () => {
    if (!visibleRoutes.length) return;
    const targetRouteId = selectedRouteId || visibleRoutes[0].route.id;
    const entry = visibleRoutes.find(r => r.route.id === targetRouteId) || visibleRoutes[0];
    
    // Use editPoints if in editing mode, otherwise fallback to saved points
    const pointsToCalculate = isEditing && editPoints.length > 1 ? editPoints : entry.points;
    if (pointsToCalculate.length < 2) {
      setMessage("Need at least 2 points to calculate road path.");
      return;
    }

    setIsCalculating(true);
    setMessage("Calculating road path...");
    
    try {
      const result = await fetchRoadGeometry(pointsToCalculate);
      if (isEditing) {
        setEditPoints(result.points);
        setMessage("Road path recalculated. Review and click Save when ready.");
      } else {
        setComputedRoads(current => ({ ...current, [entry.route.id]: result.points }));
        if (result.distanceKm || result.estimatedDurationMinutes) {
          onRouteMetrics?.(entry.route.id, {
            distanceKm: result.distanceKm,
            estimatedDurationMinutes: result.estimatedDurationMinutes
          });
        }
        setMessage("Road path recalculated. Review and save if needed.");
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to calculate road path. Your saved route was not changed.");
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
          attribution: "Traffic Data (c) Google",
          maxZoom: 20
        });

        mapRef.current = map;

        window.setTimeout(() => map.invalidateSize({ animate: true }), 120);

        map.on('click', (e: any) => {
          if (!isEditing) return;
          const { lat, lng } = e.latlng;
          setEditPoints(prev => [...prev, [lat, lng]]);
        });
      })
      .catch(() => setMessage("The map service is unavailable right now. Try again later."));

    return () => {
      cancelled = true;
    };
  }, [isEditing]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    
    // Update map click handler to respect the latest isEditing state
    map.off('click');
    map.on('click', (e: any) => {
      if (!isEditing) return;
      const { lat, lng } = e.latlng;
      setEditPoints(prev => {
        const newPoints = [...prev, [lat, lng]] as [number, number][];
        setSelectedPointIndex(newPoints.length - 1);
        return newPoints;
      });
    });
  }, [isEditing]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const timer = window.setTimeout(() => map.invalidateSize({ animate: true }), 120);
    return () => window.clearTimeout(timer);
  }, [isFullscreen]);

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
  };

  const toggleTraffic = () => {
    const map = mapRef.current;
    const traffic = trafficLayerRef.current;
    if (!map || !traffic) return;

    if (isTrafficOn) {
      map.removeLayer(traffic);
      setIsTrafficOn(false);
    } else {
      traffic.addTo(map);
      setIsTrafficOn(true);
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

    const group = L.layerGroup().addTo(map);
    layerRef.current = group;

    if (isEditing) {
      const editGroup = L.layerGroup().addTo(map);
      editLayerRef.current = editGroup;

      if (editPoints.length > 0) {
        L.polyline(editPoints, { color: '#f00', weight: 4 }).addTo(editGroup);
      }

      editPoints.forEach((pt, idx) => {
        const isSelected = idx === selectedPointIndex;
        const marker = L.marker(pt, {
          draggable: true,
          icon: L.divIcon({
            className: `edit-marker ${isSelected ? 'selected' : ''}`,
            html: `<div style="width: 12px; height: 12px; background: ${isSelected ? '#ffeb3b' : '#fff'}; border: 2px solid #f00; border-radius: 50%;"></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8]
          })
        }).addTo(editGroup);

        marker.on('click', (e: any) => {
          L.DomEvent.stopPropagation(e);
          setSelectedPointIndex(idx);
        });

        marker.on('dragend', (e: any) => {
          const newPos = e.target.getLatLng();
          setEditPoints(prev => {
            const newPoints = [...prev];
            newPoints[idx] = [newPos.lat, newPos.lng];
            return newPoints;
          });
        });
      });
      return; // Skip drawing normal routes when editing
    }

    if (!visibleRoutes.length) {
      if (!isEditing) setMessage("No route line yet. Add or sync waypoints to preview this route.");
      map.setView(DEFAULT_CENTER, 12);
      map.invalidateSize({ animate: true });
      return;
    }

    if (!isCalculating && !isEditing) {
      setMessage("Showing saved waypoints.");
    }

    const allBounds: [number, number][] = [];

    for (const entry of visibleRoutes) {
      if (cancelled) break;

      const isSelected = selectedRouteId ? entry.route.id === selectedRouteId : true;
      const routeColor = entry.route.id.toLowerCase().includes("pitx") ? "#13a46b" : "#0f7ad3";

      const roadPoints = computedRoads[entry.route.id] || entry.points;
      if (roadPoints.length === 0) continue;

      L.polyline(roadPoints, {
        color: routeColor,
        weight: isSelected ? 8 : 3,
        opacity: isSelected ? 1.0 : 0.2,
        lineCap: "round",
        dashArray: entry.route.direction === "reverse" ? "10 12" : undefined
      })
        .addTo(group)
        .bindPopup(`<strong>${getRouteDisplayName(entry.route)}</strong><br/>${roadPoints.length} preview points`);

      roadPoints.forEach((point) => allBounds.push(point));

      const first = roadPoints[0];
      const last = roadPoints[roadPoints.length - 1];

      if (first) {
        L.marker(first, {
          icon: L.divIcon({
            className: "route-terminal-marker origin",
            html: `<span>Start: ${entry.route.origin || 'Origin'}</span>`,
            iconSize: [140, 28],
            iconAnchor: [70, 14]
          })
        }).addTo(group);
      }

      if (last && roadPoints.length > 1) {
        L.marker(last, {
          icon: L.divIcon({
            className: "route-terminal-marker finish",
            html: `<span>End: ${entry.route.destination || 'Destination'}</span>`,
            iconSize: [140, 28],
            iconAnchor: [70, 14]
          })
        }).addTo(group);
      }
    }

    if (!cancelled) {
      if (allBounds.length) {
        map.fitBounds(allBounds, { padding: [42, 42], maxZoom: 14 });
      }
      window.setTimeout(() => map.invalidateSize({ animate: true }), 250);
    }

    return () => {
      cancelled = true;
    };
  }, [visibleRoutes, selectedRouteId, computedRoads, isEditing, editPoints, selectedPointIndex]);

  const toggleEditMode = () => {
    if (isEditing) {
      setIsEditing(false);
      setEditPoints([]);
      setSelectedPointIndex(null);
    } else {
      let initialPoints: [number, number][] = [];
      const targetRouteId = selectedRouteId || (visibleRoutes.length === 1 ? visibleRoutes[0].route.id : null);
      if (targetRouteId) {
        const entry = visibleRoutes.find(r => r.route.id === targetRouteId);
        if (entry) {
          initialPoints = computedRoads[entry.route.id] || entry.points;
        }
      }
      setEditPoints(initialPoints);
      setIsEditing(true);
      setMessage("Click on the map to add waypoints. Drag to move them.");
    }
  };

  const removeSelectedPoint = () => {
    if (selectedPointIndex !== null) {
      setEditPoints(prev => prev.filter((_, idx) => idx !== selectedPointIndex));
      setSelectedPointIndex(null);
    }
  };

  const saveEditedPath = () => {
    if (!onSaveWaypoints) {
      setMessage("Saving is not supported in this view.");
      return;
    }
    const targetRouteId = selectedRouteId || (visibleRoutes.length === 1 ? visibleRoutes[0].route.id : null);
    if (!targetRouteId) {
      setMessage("No route selected to save.");
      return;
    }
    
    let distKm: number | undefined = undefined;
    if (mapRef.current && editPoints.length > 1) {
      let totalMeters = 0;
      for (let i = 0; i < editPoints.length - 1; i++) {
        totalMeters += mapRef.current.distance(editPoints[i], editPoints[i+1]);
      }
      distKm = Number((totalMeters / 1000).toFixed(1));
    }

    onSaveWaypoints(targetRouteId, editPoints, distKm);
    setIsEditing(false);
  };

  return (
    <div className={`route-preview-map-shell ${isFullscreen ? "is-fullscreen" : ""}`} style={{ position: "relative", display: "flex", flexDirection: "column", height: isFullscreen ? "100vh" : "100%" }}>
      <div ref={containerRef} className="route-preview-map-canvas" style={{ flex: 1, cursor: isEditing ? 'crosshair' : 'grab' }} />
      <div className="route-preview-controls" style={{ padding: "12px", display: "flex", gap: "8px", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", background: "rgba(0,0,0,0.05)" }}>
        <span style={{ fontSize: "13px", color: "#666" }}>{message}</span>
        
        <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
          {isEditing ? (
            <>
              <button 
                type="button" 
                className="soft-button" 
                onClick={removeSelectedPoint}
                disabled={selectedPointIndex === null}
                style={{ padding: "6px 10px", fontSize: "12px", opacity: selectedPointIndex === null ? 0.5 : 1 }}
              >
                Remove Point
              </button>
              <button 
                type="button" 
                className="soft-button" 
                onClick={() => { setEditPoints([]); setSelectedPointIndex(null); }}
                style={{ padding: "6px 10px", fontSize: "12px" }}
              >
                Clear Route
              </button>
              <button 
                type="button" 
                className="soft-button" 
                style={{ padding: "6px 12px", fontSize: "12px" }}
                onClick={recalculatePath}
                disabled={isCalculating || editPoints.length < 2}
              >
                {isCalculating ? "Calculating..." : "Recalculate road path"}
              </button>
              <button 
                type="button" 
                className="soft-button primary-action" 
                onClick={saveEditedPath}
                style={{ padding: "6px 12px", fontSize: "12px", background: "#13a46b", color: "#fff", border: "none", borderRadius: "4px" }}
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
              {visibleRoutes.length > 0 && onSaveWaypoints && (
                <button 
                  type="button" 
                  className="soft-button" 
                  onClick={toggleEditMode}
                  style={{ padding: "6px 12px", fontSize: "12px" }}
                >
                  Manual edit route
                </button>
              )}
              {visibleRoutes.length > 0 && (
                <button 
                  type="button" 
                  className="soft-button" 
                  style={{ padding: "6px 12px", fontSize: "12px" }}
                  onClick={recalculatePath}
                  disabled={isCalculating}
                >
                  {isCalculating ? "Calculating..." : "Recalculate path"}
                </button>
              )}
            </>
          )}

          <div style={{ width: "1px", height: "20px", background: "#ccc", margin: "0 4px" }} />

          <button 
            type="button" 
            className={`soft-button ${viewMode === "street" ? "active" : ""}`}
            style={{ padding: "6px 10px", background: viewMode === "street" ? "#ddd" : "transparent" }}
            onClick={() => toggleViewMode("street")}
            title="Street view"
          >
            <Map size={14} />
          </button>
          <button 
            type="button" 
            className={`soft-button ${viewMode === "satellite" ? "active" : ""}`}
            style={{ padding: "6px 10px", background: viewMode === "satellite" ? "#ddd" : "transparent" }}
            onClick={() => toggleViewMode("satellite")}
            title="Satellite view"
          >
            <Satellite size={14} />
          </button>
          <button 
            type="button" 
            className={`soft-button ${isTrafficOn ? "active" : ""}`}
            style={{ padding: "6px 10px", background: isTrafficOn ? "#ddd" : "transparent" }}
            onClick={toggleTraffic}
            title={isTrafficOn ? "Traffic On" : "Traffic Off (if available)"}
          >
            <TrafficCone size={14} />
          </button>
          <button 
            type="button" 
            className="soft-button" 
            style={{ padding: "6px 10px" }}
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}