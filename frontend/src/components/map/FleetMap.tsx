"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FleetBus, RouteConfig } from "@pos-bus/shared";
import {
  LocateFixed,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Navigation,
  Route as RouteIcon,
  Satellite,
  Search,
  TrafficCone
} from "lucide-react";

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

const TERMINALS = [
  {
    id: "fvr-hq",
    name: "FVR Terminal HQ",
    address: "V25X+F5P, Balasing - San Jose Rd, Norzagaray, Bulacan",
    position: [14.8078, 121.0111] as [number, number],
    kind: "hq"
  },
  {
    id: "gma",
    name: "GMA Kamuning Terminal",
    address: "J2QR+FP Quezon City, Metro Manila",
    position: [14.6387, 121.0418] as [number, number],
    kind: "gma"
  },
  {
    id: "st-cruz",
    name: "ST.CRUZ Terminal",
    address: "JX3J+XP Manila, Metro Manila",
    position: [14.6049, 120.9818] as [number, number],
    kind: "stcruz"
  },
  {
    id: "muzon",
    name: "Muzon Terminal",
    address: "San Jose del Monte-Marilao Road, SJDM, Bulacan",
    position: [14.8137, 121.0377] as [number, number],
    kind: "muzon"
  },
  {
    id: "pitx",
    name: "PITX Terminal",
    address: "PITX, Paranaque Integrated Terminal Exchange",
    position: [14.5094, 120.9916] as [number, number],
    kind: "pitx"
  }
] as const;

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

const terminalPopupHtml = (terminal: (typeof TERMINALS)[number]) => `
  <div class="leaflet-command-popup">
    <strong>${terminal.name}</strong>
    <span>Terminal / bus stop reference</span>
    <p>${terminal.address}</p>
  </div>
`;

const hasAssignedRoute = (bus: FleetBus) => {
  const route = String(bus.route || "").trim().toLowerCase();
  if (!route) return false;
  return !["n/a", "na", "none", "unknown", "unassigned", "unassigned route", "not set"].includes(route);
};

const hasValidGps = (bus: FleetBus) => bus.lat !== null && bus.lng !== null;

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
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<LeafletApi | null>(null);
  const streetLayerRef = useRef<LeafletLayer | null>(null);
  const satelliteLayerRef = useRef<LeafletLayer | null>(null);
  const trafficLayerRef = useRef<LeafletLayer | null>(null);
  const routeLayerRef = useRef<LeafletLayer | null>(null);
  const markerRefs = useRef<globalThis.Map<string, LeafletMarker>>(new globalThis.Map());
  const searchMarkerRef = useRef<LeafletMarker | null>(null);
  const followedBusIdRef = useRef<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [busQuery, setBusQuery] = useState("");
  const [isTrafficOn, setIsTrafficOn] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [followedBusId, setFollowedBusId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"street" | "satellite">("street");

  const mapBuses = useMemo(() => buses.filter((bus) => hasAssignedRoute(bus) && hasValidGps(bus)), [buses]);
  const hasGps = mapBuses.length > 0;
  const routesWithWaypoints = useMemo(
    () =>
      routes
        .map((route) => ({
          ...route,
          points: (route.waypoints || [])
            .filter((point) => typeof point.lat === "number" && typeof point.lng === "number")
            .map((point) => [point.lat as number, point.lng as number] as [number, number])
        }))
        .filter((route) => route.points.length > 1),
    [routes]
  );

  useEffect(() => {
    let cancelled = false;

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

        L.marker(DEFAULT_CENTER, {
          icon: L.divIcon({
            className: "leaflet-hq-marker",
            html: "<span>HQ</span>",
            iconSize: [44, 44],
            iconAnchor: [22, 22]
          })
        })
          .addTo(map)
          .bindPopup("<strong>COMMAND CENTER (HQ)</strong><br/>Operational Headquarters<br/>Fleet Management Base");

        mapRef.current = map;
      })
      .catch((error) => setMapError(error instanceof Error ? error.message : "Map failed to load."));

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    followedBusIdRef.current = followedBusId;
  }, [followedBusId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const timer = window.setTimeout(() => map.invalidateSize({ animate: true }), 120);
    return () => window.clearTimeout(timer);
  }, [isFullscreen]);

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
          map.flyTo(position, 17, { animate: true, duration: 0.8 });
          existing.openPopup();
        });
      } else {
        const marker = L.marker(position, { icon }).addTo(map).bindPopup(popupHtml(bus));
        marker.on("click", () => {
          followedBusIdRef.current = bus.id;
          setFollowedBusId(bus.id);
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

    if (hasGps && mapBuses.length) {
      const points = mapBuses.map((bus) => [bus.lat as number, bus.lng as number]);
      if (points.length) map.fitBounds(points, { padding: [60, 60], maxZoom: 14 });
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

    routesWithWaypoints.forEach((route) => {
      const isPitx = route.id.toLowerCase().includes("pitx");
      L.polyline(route.points, {
        color: isPitx ? "#13a46b" : "#0f7ad3",
        weight: 6,
        opacity: 0.78,
        lineCap: "round",
        dashArray: route.direction === "reverse" ? "10 12" : undefined
      })
        .addTo(group)
        .bindPopup(
          `<strong>${route.routeName || `${route.origin} to ${route.destination}`}</strong><br/>${route.points.length} AdminRoutes waypoints`
        );
    });

    TERMINALS.forEach((terminal) => {
      L.marker(terminal.position, {
        icon: L.divIcon({
          className: "leaflet-terminal-icon-shell",
          html: `
            <div class="leaflet-terminal-marker terminal-${terminal.kind}">
              <img src="/assets/Terminal/3D_terminal.png" alt="" />
              <strong>${terminal.name.replace(" Terminal", "")}</strong>
            </div>
          `,
          iconSize: [82, 78],
          iconAnchor: [41, 52],
          popupAnchor: [0, -42]
        })
      })
        .addTo(group)
        .bindPopup(terminalPopupHtml(terminal));
    });

  }, [routesWithWaypoints]);

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
    <section className={`fleet-map real-fleet-map ${isFullscreen ? "is-fullscreen" : ""}`}>
      <div ref={containerRef} className="leaflet-map-canvas" />

      <div className="legacy-map-header">
        <div>
          <strong>Operations Map</strong>
          <span>Realtime bus tracking from Firebase RTDB</span>
        </div>
        <div className="legacy-map-actions">
          <button type="button" className={viewMode === "satellite" ? "active" : ""} onClick={() => toggleView("satellite")}>
            <Satellite size={16} /> Satellite
          </button>
          <button type="button" className={viewMode === "street" ? "active" : ""} onClick={() => toggleView("street")}>
            <MapIcon size={16} /> Street
          </button>
          <button type="button" className={isTrafficOn ? "active traffic" : "traffic"} onClick={toggleTraffic}>
            <TrafficCone size={16} /> Traffic
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
          <button type="button" onClick={() => setIsFullscreen((current) => !current)}>
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            {isFullscreen ? "Back to page" : "Fullscreen"}
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
        {routes.slice(0, 4).map((route) => (
          <span key={route.id}>{route.routeName || `${route.origin} to ${route.destination}`}</span>
        ))}
        {!routes.length ? <span>AdminRoutes not loaded yet</span> : null}
      </div>

      {mapError ? <div className="map-error-banner">{mapError}</div> : null}

      <div className="map-legend">
        <span>
          <i className="legend-online" /> Active
        </span>
        <span>
          <i className="legend-idle" /> Offline
        </span>
        <span>
          <i className="legend-sos" /> SOS
        </span>
      </div>
    </section>
  );
}
