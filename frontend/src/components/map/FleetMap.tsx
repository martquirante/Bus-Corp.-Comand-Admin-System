"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FleetBus, RouteConfig } from "@pos-bus/shared";
import {
  LocateFixed,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Navigation,
  Route as RouteIcon,
  Satellite,
  Search
} from "lucide-react";
import { createSatelliteHybridTileLayer } from "@/utils/mapTiles";
import { getMainRouteLineId, normalizeMainRouteLineId } from "@/utils/routeLines";
import { MAIN_TERMINALS, TERMINAL_ICON_ASSET } from "@/utils/terminals";

type LeafletApi = any;
type LeafletMap = any;
type LeafletLayer = any;
type LeafletMarker = any;

declare global {
  interface Window {
    L?: LeafletApi;
    __posBusLeafletLoad?: Promise<LeafletApi>;
  }
}

const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const DEFAULT_CENTER: [number, number] = [14.8078, 121.0111];
const STOPPED_BUS_ASSET = "/assets/bus/blue-aircon/bus-blue-aircon-front-left.png";
const MOVING_BUS_ASSET = "/assets/bus/blue-aircon/map-only-blue-bus.png";
const ADMIN_MAP_ICON_ASSET = "/assets/icons/admin-map-icon.png";

const ensureLeaflet = () => {
  if (typeof window === "undefined") return Promise.reject(new Error("Map unavailable during server render."));
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
    script.onload = () => (window.L ? resolve(window.L) : reject(new Error("Leaflet failed to initialize.")));
    script.onerror = () => reject(new Error("Unable to load Leaflet map library."));
    document.head.appendChild(script);
  });

  return window.__posBusLeafletLoad;
};

const busAssetForStatus = (bus: FleetBus) => {
  if (!bus.online || bus.status === "offline") return STOPPED_BUS_ASSET;
  if (bus.status === "idle" || bus.speed <= 0) return STOPPED_BUS_ASSET;
  if (bus.status === "moving" || bus.status === "fast" || bus.status.includes("turning")) {
    return MOVING_BUS_ASSET;
  }
  return STOPPED_BUS_ASSET;
};

const markerClassForBus = (bus: FleetBus) => {
  if (bus.emergency) return "leaflet-bus-marker sos";
  if (!bus.online) return "leaflet-bus-marker offline";
  if (bus.status === "fast") return "leaflet-bus-marker fast";
  return "leaflet-bus-marker";
};

const markerHtml = (bus: FleetBus) => {
  const rotation = typeof bus.heading === "number" ? bus.heading : 0;
  return `
    <div class="${markerClassForBus(bus)}">
      ${bus.emergency ? '<span class="leaflet-sos-ring"></span>' : ""}
      <img src="${busAssetForStatus(bus)}" alt="" style="transform: rotate(${rotation}deg)" />
      ${!bus.online ? '<span class="leaflet-offline-badge">Offline</span>' : ""}
      <strong>${bus.busNumber}</strong>
    </div>
  `;
};

const popupHtml = (bus: FleetBus) => `
  <div class="leaflet-command-popup">
    <strong>BUS ${bus.busNumber}</strong>
    <span>${bus.online ? "Online" : "Offline"}${bus.emergency ? " / SOS ACTIVE" : ""}</span>
    <p>${bus.route || "Unassigned route"}</p>
    <dl>
      <div><dt>Driver</dt><dd>${bus.driver || "N/A"}</dd></div>
      <div><dt>Conductor</dt><dd>${bus.conductor || "N/A"}</dd></div>
      <div><dt>Speed</dt><dd>${bus.speed || 0} km/h</dd></div>
      <div><dt>Passengers</dt><dd>${bus.passengers || 0}</dd></div>
    </dl>
  </div>
`;

const terminalPopupHtml = (terminal: (typeof MAIN_TERMINALS)[number]) => `
  <div class="leaflet-command-popup">
    <strong>${terminal.name}</strong>
    <span>${terminal.plusCode}</span>
    <p>${terminal.address}</p>
  </div>
`;

const hasAssignedRoute = (bus: FleetBus) => {
  const route = String(bus.route || "").trim().toLowerCase();
  if (!route) return false;
  return !["n/a", "na", "none", "unknown", "unassigned", "unassigned route", "not set"].includes(route);
};

const hasValidGps = (bus: FleetBus) => bus.lat !== null && bus.lng !== null;

type FleetRouteLineId = "fvr-pitx" | "fvr-stcruz";
type RouteExtraFields = RouteConfig & {
  lineId?: string;
  routeGroup?: string;
};

const asFleetRouteLineId = (value?: string | number | null): FleetRouteLineId | null => {
  const normalized = normalizeMainRouteLineId(value);
  return normalized === "fvr-pitx" || normalized === "fvr-stcruz" ? normalized : null;
};

const getRouteLineIdForMap = (route: RouteConfig): FleetRouteLineId | null => {
  const extra = route as RouteExtraFields;
  const explicit = asFleetRouteLineId(extra.lineId || extra.routeGroup);
  if (explicit) return explicit;

  const inferred = getMainRouteLineId(route);
  return inferred === "fvr-pitx" || inferred === "fvr-stcruz" ? inferred : null;
};

export function FleetMap({
  buses,
  routes = [],
  focusBus
}: {
  buses: FleetBus[];
  routes?: RouteConfig[];
  focusBus?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const shellRef = useRef<HTMLElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<LeafletApi | null>(null);
  const streetLayerRef = useRef<LeafletLayer | null>(null);
  const satelliteLayerRef = useRef<LeafletLayer | null>(null);
  const routeLayerRef = useRef<LeafletLayer | null>(null);
  const markerRefs = useRef<globalThis.Map<string, LeafletMarker>>(new globalThis.Map());
  const searchMarkerRef = useRef<LeafletMarker | null>(null);
  const adminLocationMarkerRef = useRef<LeafletMarker | null>(null);
  const requestedAdminLocationRef = useRef(false);
  const followedBusIdRef = useRef<string | null>(null);
  const hasAutoFitFleetRef = useRef(false);
  const hasAutoFitRouteRef = useRef(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [busQuery, setBusQuery] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [adminLocationStatus, setAdminLocationStatus] = useState<
    "idle" | "locating" | "ready" | "denied" | "unsupported"
  >("idle");
  const [followedBusId, setFollowedBusId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"street" | "satellite">("street");

  const mapBuses = useMemo(() => buses.filter((bus) => hasAssignedRoute(bus) && hasValidGps(bus)), [buses]);
  const hasGps = mapBuses.length > 0;
  const routesWithWaypoints = useMemo(
    () => {
      return routes
        .map((route) => ({
          ...route,
          points: (route.waypoints || [])
            .filter((point) => typeof point.lat === "number" && typeof point.lng === "number")
            .map((point) => [point.lat as number, point.lng as number] as [number, number])
        }))
        .filter((route) => route.points.length > 1)
        .filter((route) => (route.status || "active") === "active")
        .filter((route) => Boolean(getRouteLineIdForMap(route)));
    },
    [routes]
  );

  const setAdminLocationMarker = useCallback((point: [number, number], accuracy?: number, shouldFly = true) => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    const accuracyText = accuracy ? `<span>Accuracy ${Math.round(accuracy)}m</span>` : "";
    const popup = `
      <div class="leaflet-command-popup">
        <strong>Admin device location</strong>
        ${accuracyText}
        <p>Location access is active for map orientation.</p>
      </div>
    `;
    const icon = L.divIcon({
      className: "admin-location-icon-shell",
      html: `
        <div class="admin-location-marker">
          <img src="${ADMIN_MAP_ICON_ASSET}" alt="" />
          <strong>Admin</strong>
        </div>
      `,
      iconSize: [72, 80],
      iconAnchor: [36, 68],
      popupAnchor: [0, -58]
    });

    if (adminLocationMarkerRef.current) {
      adminLocationMarkerRef.current.setLatLng(point);
      adminLocationMarkerRef.current.setIcon(icon);
      adminLocationMarkerRef.current.setPopupContent(popup);
    } else {
      adminLocationMarkerRef.current = L.marker(point, { icon })
        .addTo(map)
        .bindPopup(popup);
    }

    if (shouldFly) {
      followedBusIdRef.current = null;
      setFollowedBusId(null);
      map.flyTo(point, 16, { animate: true, duration: 0.8 });
      adminLocationMarkerRef.current.openPopup();
    }
  }, []);

  const requestAdminLocation = useCallback((shouldFly = true) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setAdminLocationStatus("unsupported");
      setMapError("Device location is not supported in this browser.");
      return;
    }
    
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      setAdminLocationStatus("unsupported");
      setMapError("Location requires HTTPS or localhost. Network IPs (like 192.168.x.x) over HTTP block location access.");
      return;
    }

    setAdminLocationStatus("locating");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point: [number, number] = [
          position.coords.latitude,
          position.coords.longitude
        ];

        setAdminLocationStatus("ready");
        setAdminLocationMarker(point, position.coords.accuracy, shouldFly);
      },
      (error) => {
        setAdminLocationStatus(error.code === error.PERMISSION_DENIED ? "denied" : "idle");
        
        const isNetworkIp = typeof window !== "undefined" && window.isSecureContext === false;
        
        setMapError(
          error.code === error.PERMISSION_DENIED
            ? isNetworkIp 
                ? "Location permission blocked by browser. Network IP access requires HTTPS."
                : "Location permission was denied. Use the Admin location button to try again."
            : "Could not read device location right now."
        );
      },
      {
        enableHighAccuracy: true,
        maximumAge: 15000,
        timeout: 12000
      }
    );
  }, [setAdminLocationMarker]);

  useEffect(() => {
    let cancelled = false;
    let manualMoveCleanup: (() => void) | null = null;

    ensureLeaflet()
      .then((L) => {
        if (cancelled || !containerRef.current || mapRef.current) return;

        leafletRef.current = L;
        const map = L.map(containerRef.current, {
          zoomControl: false,
          preferCanvas: true
        }).setView(DEFAULT_CENTER, 13);

        L.control.zoom({ position: "bottomright" }).addTo(map);
        streetLayerRef.current = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "(c) OpenStreetMap",
          maxZoom: 19
        }).addTo(map);
        satelliteLayerRef.current = createSatelliteHybridTileLayer(L);

        mapRef.current = map;
        setIsMapReady(true);

        const stopFollowingOnManualMove = () => {
          followedBusIdRef.current = null;
          setFollowedBusId(null);
        };

        containerRef.current.addEventListener("mousedown", stopFollowingOnManualMove);
        containerRef.current.addEventListener("touchstart", stopFollowingOnManualMove);
        containerRef.current.addEventListener("wheel", stopFollowingOnManualMove);
        manualMoveCleanup = () => {
          containerRef.current?.removeEventListener("mousedown", stopFollowingOnManualMove);
          containerRef.current?.removeEventListener("touchstart", stopFollowingOnManualMove);
          containerRef.current?.removeEventListener("wheel", stopFollowingOnManualMove);
        };
      })
      .catch((error) => setMapError(error instanceof Error ? error.message : "Map failed to load."));

    return () => {
      cancelled = true;
      manualMoveCleanup?.();
    };
  }, []);

  useEffect(() => {
    followedBusIdRef.current = followedBusId;
  }, [followedBusId]);

  useEffect(() => {
    if (!isMapReady || requestedAdminLocationRef.current) return;

    requestedAdminLocationRef.current = true;
    requestAdminLocation(false);
  }, [isMapReady, requestAdminLocation]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === shellRef.current);
      window.setTimeout(() => mapRef.current?.invalidateSize({ animate: true }), 120);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const timer = window.setTimeout(() => map.invalidateSize({ animate: true }), 120);
    return () => window.clearTimeout(timer);
  }, [isFullscreen]);

  const toggleFleetFullscreen = async () => {
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
      setIsFullscreen((current) => !current);
    } finally {
      window.setTimeout(() => mapRef.current?.invalidateSize({ animate: true }), 160);
    }
  };

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    const liveIds = new Set(mapBuses.map((bus) => bus.id));
    markerRefs.current.forEach((marker, id) => {
      if (!liveIds.has(id)) {
        map.removeLayer(marker);
        markerRefs.current.delete(id);
      }
    });

    mapBuses.forEach((bus) => {
      const position: [number, number] = [bus.lat as number, bus.lng as number];
      const icon = L.divIcon({
        className: "leaflet-bus-icon-shell",
        html: markerHtml(bus),
        iconSize: [58, 58],
        iconAnchor: [29, 29],
        popupAnchor: [0, -26]
      });
      const existing = markerRefs.current.get(bus.id);

      if (existing) {
        existing.setLatLng(position);
        existing.setIcon(icon);
        existing.setPopupContent(popupHtml(bus));
        existing.off("click");
        existing.on("click", () => {
          followedBusIdRef.current = bus.id;
          setFollowedBusId(bus.id);
          hasAutoFitFleetRef.current = true;
          map.flyTo(position, 17, { animate: true, duration: 0.8 });
          existing.openPopup();
        });
      } else {
        const marker = L.marker(position, { icon }).addTo(map).bindPopup(popupHtml(bus));
        marker.on("click", () => {
          followedBusIdRef.current = bus.id;
          setFollowedBusId(bus.id);
          hasAutoFitFleetRef.current = true;
          map.flyTo(position, 17, { animate: true, duration: 0.8 });
          marker.openPopup();
        });
        markerRefs.current.set(bus.id, marker);
      }
    });

    const followedMarker = followedBusIdRef.current ? markerRefs.current.get(followedBusIdRef.current) : null;
    if (followedMarker) {
      map.flyTo(followedMarker.getLatLng(), Math.max(map.getZoom(), 16), { animate: true, duration: 0.7 });
      return;
    }

    if (!hasAutoFitFleetRef.current && hasGps && mapBuses.length) {
      const points = mapBuses.map((bus) => [bus.lat as number, bus.lng as number]);
      if (points.length) {
        map.fitBounds(points, { padding: [60, 60], maxZoom: 14 });
        hasAutoFitFleetRef.current = true;
      }
    }
  }, [mapBuses, hasGps]);

  useEffect(() => {
    if (!focusBus || followedBusIdRef.current) return;

    const needle = focusBus.toLowerCase();
    const bus = mapBuses.find((item) =>
      [item.id, item.busNumber, item.driver, item.conductor]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
    if (!bus) return;

    const marker = markerRefs.current.get(bus.id);
    if (marker && mapRef.current) {
      followedBusIdRef.current = bus.id;
      setFollowedBusId(bus.id);
      hasAutoFitFleetRef.current = true;
      mapRef.current.flyTo(marker.getLatLng(), 17, { animate: true, duration: 0.8 });
      marker.openPopup();
    }
  }, [mapBuses, focusBus]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }

    const group = L.layerGroup().addTo(map);
    routeLayerRef.current = group;

    const routeBounds: [number, number][] = [];

    routesWithWaypoints.forEach((route) => {
      L.polyline(route.points, {
        color: "#0f7ad3",
        weight: 6,
        opacity: 0.78,
        lineCap: "round"
      })
        .addTo(group)
        .bindPopup(
          `<strong>${route.routeName || `${route.origin} to ${route.destination}`}</strong><br/>${route.points.length} AdminRoutes waypoints`
        );

      route.points.forEach((point) => routeBounds.push(point));
    });

    MAIN_TERMINALS.forEach((terminal) => {
      L.marker(terminal.position, {
        icon: L.divIcon({
          className: "leaflet-terminal-icon-shell",
          html: `
            <div class="leaflet-terminal-marker terminal-${terminal.id}">
              <img src="${TERMINAL_ICON_ASSET}" alt="" />
              <strong>${terminal.label}</strong>
            </div>
          `,
          iconSize: [82, 78],
          iconAnchor: [41, 52],
          popupAnchor: [0, -42]
        })
      })
        .addTo(group)
        .bindPopup(terminalPopupHtml(terminal));

      routeBounds.push(terminal.position);
    });

    if (!hasAutoFitRouteRef.current && !mapBuses.length && routeBounds.length) {
      map.fitBounds(routeBounds, { padding: [60, 60], maxZoom: 12 });
      hasAutoFitRouteRef.current = true;
    }

  }, [mapBuses.length, routesWithWaypoints]);

  const toggleView = (mode: "street" | "satellite") => {
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

  const centerFleet = () => {
    const map = mapRef.current;
    if (!map) return;

    followedBusIdRef.current = null;
    setFollowedBusId(null);
    hasAutoFitFleetRef.current = true;
    hasAutoFitRouteRef.current = true;
    const points = mapBuses.map((bus) => [bus.lat as number, bus.lng as number]);

    if (points.length) map.fitBounds(points, { padding: [60, 60], maxZoom: 14 });
    else map.setView(DEFAULT_CENTER, 13);
  };

  const findBus = () => {
    const needle = busQuery.trim().toLowerCase();
    if (!needle) return;

    const bus = mapBuses.find((item) => item.busNumber.toLowerCase().includes(needle) || item.id.toLowerCase().includes(needle));
    if (!bus) return;

    const marker = markerRefs.current.get(bus.id);
    if (marker && mapRef.current) {
      followedBusIdRef.current = bus.id;
      setFollowedBusId(bus.id);
      hasAutoFitFleetRef.current = true;
      mapRef.current.flyTo(marker.getLatLng(), 16);
      marker.openPopup();
    }
  };

  const searchLocation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchQuery.trim();
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!query || !L || !map) return;

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=ph&limit=1`
    );
    const data = (await response.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    const match = data[0];
    if (!match) return;

    const point: [number, number] = [Number(match.lat), Number(match.lon)];
    map.flyTo(point, 15);

    if (searchMarkerRef.current) map.removeLayer(searchMarkerRef.current);
    searchMarkerRef.current = L.marker(point).addTo(map).bindPopup(match.display_name).openPopup();
  };

  return (
    <section ref={shellRef} className={`fleet-map real-fleet-map ${isFullscreen ? "is-fullscreen" : ""}`}>
      <div ref={containerRef} className="leaflet-map-canvas" />

      <div className="legacy-map-header">
        <div className="legacy-map-title">
          <span className="admin-map-header-icon" aria-hidden="true" />
          <div>
            <strong>Live Fleet Map</strong>
            <span>
              {adminLocationStatus === "ready"
                ? "Admin device location active"
                : "Realtime bus tracking and route monitoring"}
            </span>
          </div>
        </div>
        <div className="legacy-map-actions">
          <button
            type="button"
            className={adminLocationStatus === "ready" ? "active" : ""}
            onClick={() => requestAdminLocation(true)}
          >
            <span className="admin-map-button-icon" aria-hidden="true" />
            {adminLocationStatus === "locating" ? "Locating..." : "Admin location"}
          </button>
          <button type="button" className={viewMode === "satellite" ? "active" : ""} onClick={() => toggleView("satellite")}>
            <Satellite size={16} /> Satellite
          </button>
          <button type="button" className={viewMode === "street" ? "active" : ""} onClick={() => toggleView("street")}>
            <MapIcon size={16} /> Street
          </button>
          <button type="button" onClick={centerFleet}>
            <LocateFixed size={16} /> Center
          </button>
          {followedBusId ? (
            <button type="button" className="active follow" onClick={() => {
              followedBusIdRef.current = null;
              setFollowedBusId(null);
            }}>
            <Navigation size={16} /> Following {mapBuses.find((bus) => bus.id === followedBusId)?.busNumber || "bus"}
            </button>
          ) : null}
          <button type="button" onClick={toggleFleetFullscreen}>
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          </button>
        </div>
      </div>

      <div className="legacy-map-search">
        <form onSubmit={searchLocation}>
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search location in PH"
            aria-label="Search location"
          />
          <button type="submit" aria-label="Search location">
            <Search size={18} />
          </button>
        </form>
        <form onSubmit={(event) => {
          event.preventDefault();
          findBus();
        }}>
          <input
            value={busQuery}
            onChange={(event) => setBusQuery(event.target.value)}
            placeholder="Search bus number"
            aria-label="Search bus"
          />
          <button type="submit" aria-label="Find bus">
            <RouteIcon size={18} />
          </button>
        </form>
      </div>

      {!hasGps ? (
        <div className="map-fallback-banner">
          <strong>No routed live GPS data yet</strong>
          <span>Only buses with an assigned route and real POS device coordinates appear on the map.</span>
        </div>
      ) : null}

      {!routesWithWaypoints.length ? (
        <div className="map-fallback-banner route-line-warning">
          <strong>No route waypoint line yet</strong>
          <span>Live Map draws route lines only from AdminRoutes or Supabase route_waypoints.</span>
        </div>
      ) : null}

      <div className="map-route-strip">
        {routesWithWaypoints.slice(0, 4).map((route) => (
          <span key={route.id}>{route.routeName || `${route.origin} to ${route.destination}`}</span>
        ))}
        {!routesWithWaypoints.length ? <span>No matching saved route path yet</span> : null}
      </div>

      {mapError ? <div className="map-error-banner">{mapError}</div> : null}

      <div className="map-legend">
        <span>
          <i className="legend-main-route" /> Main route
        </span>
        <span>
          <i className="legend-terminal" /> Terminal
        </span>
        <span>
          <i className="legend-online" /> Online bus
        </span>
        <span>
          <i className="legend-idle" /> Offline bus
        </span>
        <span>
          <i className="legend-sos" /> SOS
        </span>
      </div>
    </section>
  );
}
