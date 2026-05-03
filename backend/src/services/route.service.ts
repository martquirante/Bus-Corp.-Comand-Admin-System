import type { RouteConfig, RouteStatus } from "@pos-bus/shared";
import { firebasePaths, routePathByDirection } from "@pos-bus/shared";
import { firebaseService } from "./firebase.service.js";
import { realtimeDbService } from "./realtimeDb.service.js";
import { supabaseService } from "./supabase.service.js";

type RouteDirection = RouteConfig["direction"];
type RawRoute = Record<string, any>;
type RawRoutes = Record<string, RawRoute>;

const mainRouteIds = new Set([
  "fvr-to-pitx-via-gma",
  "pitx-to-fvr-via-gma",
  "fvr-to-st-cruz",
  "st-cruz-to-fvr"
]);

const defaultRoutes: RouteConfig[] = [
  {
    id: "fvr-to-st-cruz",
    routeName: "FVR to ST. CRUZ",
    origin: "FVR Terminal",
    destination: "ST. CRUZ",
    direction: "forward",
    isViceVersa: true,
    reverseRouteId: "st-cruz-to-fvr",
    status: "active",
    mapReferenceUrl: "https://maps.app.goo.gl/aAXkcU3hhThpB9RG7",
    price: 0,
    baseFare: 0,
    farePerKm: 0,
    stops: [],
    waypoints: [],
    source: "default"
  },
  {
    id: "st-cruz-to-fvr",
    routeName: "ST. CRUZ to FVR",
    origin: "ST. CRUZ",
    destination: "FVR Terminal",
    direction: "reverse",
    isViceVersa: true,
    reverseRouteId: "fvr-to-st-cruz",
    status: "active",
    mapReferenceUrl: "https://maps.app.goo.gl/aAXkcU3hhThpB9RG7",
    price: 0,
    baseFare: 0,
    farePerKm: 0,
    stops: [],
    waypoints: [],
    source: "default"
  },
  {
    id: "fvr-to-pitx-via-gma",
    routeName: "FVR to PITX via GMA",
    origin: "FVR Terminal",
    destination: "PITX",
    direction: "forward",
    isViceVersa: true,
    reverseRouteId: "pitx-to-fvr-via-gma",
    status: "active",
    mapReferenceUrl: "https://maps.app.goo.gl/afMZornDfTm4Rpzh9",
    price: 0,
    baseFare: 0,
    farePerKm: 0,
    stops: [],
    waypoints: [],
    source: "default"
  },
  {
    id: "pitx-to-fvr-via-gma",
    routeName: "PITX to FVR via GMA",
    origin: "PITX",
    destination: "FVR Terminal",
    direction: "reverse",
    isViceVersa: true,
    reverseRouteId: "fvr-to-pitx-via-gma",
    status: "active",
    mapReferenceUrl: "https://maps.app.goo.gl/afMZornDfTm4Rpzh9",
    price: 0,
    baseFare: 0,
    farePerKm: 0,
    stops: [],
    waypoints: [],
    source: "default"
  }
];

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const routeIdentity = (route: Pick<RouteConfig, "origin" | "destination" | "direction">) =>
  `${route.direction}:${route.origin.trim().toLowerCase()}->${route.destination.trim().toLowerCase()}`;

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

const pathFor = (direction: RouteDirection) => routePathByDirection[direction];

const toWaypointArray = (value: unknown) => {
  const entries = Array.isArray(value)
    ? value.map((item, index) => [String(item?.id || index), item] as const)
    : Object.entries((value && typeof value === "object" ? value : {}) as RawRoutes);

  return entries
    .map(([key, point], index) => {
      const item = point && typeof point === "object" ? (point as RawRoute) : {};
      const lat = item.lat ?? item.latitude;
      const lng = item.lng ?? item.longitude;
      return {
        id: String(item.id || key),
        name: item.name || item.stopName || item.label || item.title,
        lat: lat === undefined || lat === null ? undefined : toNumber(lat),
        lng: lng === undefined || lng === null ? undefined : toNumber(lng),
        sequence: item.sequence ?? item.order ?? item.point_order ?? item.stop_order ?? index + 1
      };
    })
    .sort((a, b) => toNumber(a.sequence) - toNumber(b.sequence));
};

const normalizeLegacyRoutes = (raw: RawRoutes | null, direction: RouteDirection): RouteConfig[] =>
  Object.entries(raw || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, route]) => ({
      id: `legacy-${direction}-${key}`,
      direction,
      routeName: route.routeName || `${route.origin || "Unknown"} to ${route.destination || "Unknown"}`,
      origin: String(route.origin || "Unknown Origin"),
      destination: String(route.destination || "Unknown Destination"),
      price: toNumber(route.price ?? route.baseFare),
      distance: route.distance ? toNumber(route.distance) : undefined,
      distanceKm: route.distanceKm ? toNumber(route.distanceKm) : route.distance ? toNumber(route.distance) : undefined,
      baseFare: route.baseFare ? toNumber(route.baseFare) : toNumber(route.price),
      farePerKm: route.farePerKm ? toNumber(route.farePerKm) : undefined,
      status: route.status || "active",
      isViceVersa: Boolean(route.isViceVersa),
      reverseRouteId: route.reverseRouteId,
      mapReferenceUrl: route.mapReferenceUrl,
      stops: Array.isArray(route.stops) ? route.stops : [],
      waypoints: Array.isArray(route.waypoints) ? route.waypoints : [],
      source: "legacy",
      legacyPath: direction === "forward" ? firebasePaths.routesForward : firebasePaths.routesReverse,
      legacyKey: key,
      createdAt: route.createdAt,
      updatedAt: route.updatedAt,
      createdBy: route.createdBy
    }));

const normalizeAdminRoutes = (raw: RawRoutes | null): RouteConfig[] =>
  Object.entries(raw || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, route]) => ({
      id: String(route.routeId || key),
      direction: route.direction || "forward",
      routeName: route.routeName || `${route.origin || "Unknown"} to ${route.destination || "Unknown"}`,
      origin: String(route.origin || "Unknown Origin"),
      destination: String(route.destination || "Unknown Destination"),
      price: toNumber(route.price ?? route.baseFare),
      distance: route.distance ? toNumber(route.distance) : undefined,
      distanceKm: route.distanceKm ? toNumber(route.distanceKm) : route.distance ? toNumber(route.distance) : undefined,
      estimatedDurationMinutes: route.estimatedDurationMinutes
        ? toNumber(route.estimatedDurationMinutes)
        : undefined,
      baseFare: route.baseFare ? toNumber(route.baseFare) : toNumber(route.price),
      farePerKm: route.farePerKm ? toNumber(route.farePerKm) : undefined,
      status: route.status || "active",
      isViceVersa: Boolean(route.isViceVersa),
      reverseRouteId: route.reverseRouteId,
      mapReferenceUrl: route.mapReferenceUrl,
      assignedBusId: route.assignedBusId,
      assignedTripScheduleId: route.assignedTripScheduleId,
      stops: toWaypointArray(route.stops),
      waypoints: toWaypointArray(route.waypoints),
      source: "admin",
      createdAt: route.createdAt,
      updatedAt: route.updatedAt,
      createdBy: route.createdBy
    }));

const sortProductionRoutes = (routes: RouteConfig[]) => {
  const order = ["fvr-to-pitx-via-gma", "pitx-to-fvr-via-gma", "fvr-to-st-cruz", "st-cruz-to-fvr"];
  return routes.sort((a, b) => {
    const indexA = order.indexOf(a.id);
    const indexB = order.indexOf(b.id);
    if (indexA !== -1 || indexB !== -1) return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
    const name = (a.routeName || a.origin).localeCompare(b.routeName || b.origin);
    return name || a.direction.localeCompare(b.direction);
  });
};

const mergeProductionRoutes = (adminRoutes: RouteConfig[], supabaseRoutes: RouteConfig[]) => {
  const byId = new Map<string, RouteConfig>();

  [...defaultRoutes, ...supabaseRoutes, ...adminRoutes].forEach((route) => {
    if (!mainRouteIds.has(route.id)) return;
    const existing = byId.get(route.id);
    byId.set(route.id, {
      ...existing,
      ...route,
      waypoints: route.waypoints?.length ? route.waypoints : existing?.waypoints || [],
      stops: route.stops?.length ? route.stops : existing?.stops || []
    });
  });

  return sortProductionRoutes([...byId.values()]);
};

const routePayload = (
  route: Partial<RouteConfig> & Pick<RouteConfig, "origin" | "destination">,
  id: string,
  actor: string,
  current?: RouteConfig | null
) => {
  const now = new Date().toISOString();
  const direction = route.direction || current?.direction || "forward";
  const price = toNumber(route.price ?? route.baseFare ?? current?.price);

  return {
    routeId: id,
    routeName: route.routeName || current?.routeName || `${route.origin} to ${route.destination}`,
    origin: route.origin,
    destination: route.destination,
    direction,
    isViceVersa: route.isViceVersa ?? current?.isViceVersa ?? false,
    reverseRouteId: route.reverseRouteId ?? current?.reverseRouteId,
    status: route.status || current?.status || "active",
    mapReferenceUrl: route.mapReferenceUrl ?? current?.mapReferenceUrl ?? "",
    distanceKm: route.distanceKm ?? route.distance ?? current?.distanceKm ?? current?.distance,
    distance: route.distance ?? route.distanceKm ?? current?.distance,
    estimatedDurationMinutes: route.estimatedDurationMinutes ?? current?.estimatedDurationMinutes,
    baseFare: route.baseFare ?? route.price ?? current?.baseFare ?? current?.price ?? 0,
    farePerKm: route.farePerKm ?? current?.farePerKm ?? 0,
    price,
    stops: route.stops ?? current?.stops ?? [],
    waypoints: route.waypoints ?? current?.waypoints ?? [],
    assignedBusId: route.assignedBusId ?? current?.assignedBusId ?? "",
    assignedTripScheduleId: route.assignedTripScheduleId ?? current?.assignedTripScheduleId ?? "",
    createdAt: current?.createdAt || now,
    updatedAt: now,
    createdBy: current?.createdBy || actor,
    updatedBy: actor
  };
};

export const routeService = {
  async getLegacyRoutes(direction: RouteDirection): Promise<RouteConfig[]> {
    const raw = await realtimeDbService.getPath<RawRoutes>(pathFor(direction));
    return normalizeLegacyRoutes(raw, direction);
  },

  async getAdminRoutes(): Promise<RouteConfig[]> {
    const raw = await realtimeDbService.getPath<RawRoutes>(firebasePaths.adminRoutes);
    return normalizeAdminRoutes(raw);
  },

  async getSupabaseRoutes(): Promise<RouteConfig[]> {
    try {
      return await supabaseService.listRoutes();
    } catch (error) {
      console.warn("[routes] Supabase route read skipped.", error);
      return [];
    }
  },

  async getRoutes(direction?: RouteDirection, options: { includeLegacy?: boolean } = {}): Promise<RouteConfig[]> {
    const [adminRoutes, supabaseRoutes] = await Promise.all([this.getAdminRoutes(), this.getSupabaseRoutes()]);
    const productionRoutes = mergeProductionRoutes(adminRoutes, supabaseRoutes);

    const merged = options.includeLegacy
      ? [...productionRoutes, ...(await this.getLegacyRoutes("forward")), ...(await this.getLegacyRoutes("reverse"))]
      : productionRoutes;

    return direction ? merged.filter((route) => route.direction === direction) : merged;
  },

  async getRouteById(id: string): Promise<RouteConfig | null> {
    const adminRaw = await realtimeDbService.getPath<RawRoute>(`${firebasePaths.adminRoutes}/${id}`);
    if (adminRaw) return normalizeAdminRoutes({ [id]: adminRaw })[0] || null;

    const supabaseRoute = await supabaseService.getRoute(id);
    if (supabaseRoute) return supabaseRoute;

    const routes = await this.getRoutes();
    return routes.find((route) => route.id === id) || null;
  },

  async getRouteWaypoints(id: string) {
    const route = await this.getRouteById(id);
    if (route?.waypoints?.length) return route.waypoints;

    return supabaseService.listRouteWaypoints(id);
  },

  async getRouteStops(id: string) {
    const route = await this.getRouteById(id);
    if (route?.stops?.length) return route.stops;

    return supabaseService.listRouteStops(id);
  },

  async createRoute(
    route: Partial<RouteConfig> & Pick<RouteConfig, "origin" | "destination">,
    actor = "system"
  ): Promise<RouteConfig> {
    const existingAdmin = await this.getAdminRoutes();
    const baseId = slugify(route.routeName || `${route.origin}-${route.destination}`) || `route-${Date.now()}`;
    const id = existingAdmin.some((item) => item.id === baseId) ? `${baseId}-${Date.now()}` : baseId;
    const payload = routePayload(route, id, actor);

    await realtimeDbService.setPath(`${firebasePaths.adminRoutes}/${id}`, payload);
    await firebaseService.auditAction("route.admin.create", actor, { id, origin: route.origin, destination: route.destination });

    return { ...payload, id, source: "admin" };
  },

  async updateRoute(
    id: string,
    patch: Partial<Omit<RouteConfig, "id">>,
    actor = "system"
  ): Promise<RouteConfig> {
    const current = await this.getRouteById(id);
    const payload = routePayload(
      {
        origin: patch.origin || current?.origin || "Unknown Origin",
        destination: patch.destination || current?.destination || "Unknown Destination",
        ...patch
      },
      id,
      actor,
      current
    );

    await realtimeDbService.setPath(`${firebasePaths.adminRoutes}/${id}`, payload);
    await firebaseService.auditAction("route.admin.update", actor, { id, patch });

    return { ...payload, id, source: "admin" };
  },

  async updateRouteStatus(id: string, status: RouteStatus, actor = "system"): Promise<RouteConfig> {
    return this.updateRoute(id, { status }, actor);
  },

  async addStop(id: string, stop: NonNullable<RouteConfig["stops"]>[number], actor = "system") {
    const current = await this.getRouteById(id);
    const stops = [...(current?.stops || [])];
    const stopId = stop.id || `stop-${Date.now()}`;
    stops.push({ ...stop, id: stopId, sequence: stop.sequence ?? stops.length + 1 });
    return this.updateRoute(id, { stops }, actor);
  },

  async patchStop(id: string, stopId: string, patch: Partial<NonNullable<RouteConfig["stops"]>[number]>, actor = "system") {
    const current = await this.getRouteById(id);
    const stops = (current?.stops || []).map((stop) => (stop.id === stopId ? { ...stop, ...patch } : stop));
    return this.updateRoute(id, { stops }, actor);
  },

  async deleteStop(id: string, stopId: string, actor = "system") {
    const current = await this.getRouteById(id);
    const stops = (current?.stops || []).filter((stop) => stop.id !== stopId);
    return this.updateRoute(id, { stops }, actor);
  },

  async patchLine(id: string, waypoints: RouteConfig["waypoints"], actor = "system") {
    return this.updateRoute(id, { waypoints }, actor);
  }
};
