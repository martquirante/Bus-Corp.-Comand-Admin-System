import type { RouteConfig, RouteStatus } from "@pos-bus/shared";
import { firebasePaths, routePathByDirection } from "@pos-bus/shared";
import { firebaseService } from "./firebase.service.js";
import { realtimeDbService } from "./realtimeDb.service.js";
import { supabaseService } from "./supabase.service.js";

type RouteDirection = RouteConfig["direction"];
type RawRoute = Record<string, any>;
type RawRoutes = Record<string, RawRoute>;

type ExtendedWaypoint = NonNullable<RouteConfig["waypoints"]>[number] & {
  fare?: number;
  source?: string;
  legacyKey?: string;
  lineId?: string;
  direction?: RouteDirection;
  origin?: string;
  destination?: string;
  latitude?: number;
  longitude?: number;
};

type ExtendedRouteConfig = RouteConfig & {
  lineId?: string;
  routeGroup?: string;
  googleMapReferenceUrl?: string;
  trafficDurationMinutes?: number;
  encodedPolyline?: string;
  routeGeometrySource?: string;
  assignedBusId?: string;
  assignedTripScheduleId?: string;
  createdBy?: string;
  updatedBy?: string;
  visible?: boolean;
  stops?: ExtendedWaypoint[];
  waypoints?: ExtendedWaypoint[];
};

type RoutePatch = Partial<Omit<ExtendedRouteConfig, "id">>;

const FVR_PITX_REF = "https://maps.app.goo.gl/afMZornDfTm4Rpzh9";
const FVR_ST_CRUZ_REF = "https://maps.app.goo.gl/aAXkcU3hhThpB9RG7";

const mainRouteIds = new Set([
  "fvr-to-pitx-via-gma",
  "pitx-to-fvr-via-gma",
  "fvr-to-st-cruz",
  "st-cruz-to-fvr"
]);

const defaultRoutes = [
  {
    id: "fvr-to-st-cruz",
    lineId: "fvr-stcruz",
    routeGroup: "FVR_ST_CRUZ",
    routeName: "FVR to ST. CRUZ",
    origin: "FVR Terminal",
    destination: "ST. CRUZ",
    direction: "forward",
    isViceVersa: true,
    reverseRouteId: "st-cruz-to-fvr",
    status: "active",
    mapReferenceUrl: FVR_ST_CRUZ_REF,
    googleMapReferenceUrl: FVR_ST_CRUZ_REF,
    price: 0,
    baseFare: 0,
    farePerKm: 0,
    stops: [],
    waypoints: [],
    source: "default"
  },
  {
    id: "st-cruz-to-fvr",
    lineId: "fvr-stcruz",
    routeGroup: "FVR_ST_CRUZ",
    routeName: "ST. CRUZ to FVR",
    origin: "ST. CRUZ",
    destination: "FVR Terminal",
    direction: "reverse",
    isViceVersa: true,
    reverseRouteId: "fvr-to-st-cruz",
    status: "active",
    mapReferenceUrl: FVR_ST_CRUZ_REF,
    googleMapReferenceUrl: FVR_ST_CRUZ_REF,
    price: 0,
    baseFare: 0,
    farePerKm: 0,
    stops: [],
    waypoints: [],
    source: "default"
  },
  {
    id: "fvr-to-pitx-via-gma",
    lineId: "fvr-pitx",
    routeGroup: "FVR_PITX",
    routeName: "FVR to PITX via GMA",
    origin: "FVR Terminal",
    destination: "PITX",
    direction: "forward",
    isViceVersa: true,
    reverseRouteId: "pitx-to-fvr-via-gma",
    status: "active",
    mapReferenceUrl: FVR_PITX_REF,
    googleMapReferenceUrl: FVR_PITX_REF,
    price: 0,
    baseFare: 0,
    farePerKm: 0,
    stops: [],
    waypoints: [],
    source: "default"
  },
  {
    id: "pitx-to-fvr-via-gma",
    lineId: "fvr-pitx",
    routeGroup: "FVR_PITX",
    routeName: "PITX to FVR via GMA",
    origin: "PITX",
    destination: "FVR Terminal",
    direction: "reverse",
    isViceVersa: true,
    reverseRouteId: "fvr-to-pitx-via-gma",
    status: "active",
    mapReferenceUrl: FVR_PITX_REF,
    googleMapReferenceUrl: FVR_PITX_REF,
    price: 0,
    baseFare: 0,
    farePerKm: 0,
    stops: [],
    waypoints: [],
    source: "default"
  }
] satisfies ExtendedRouteConfig[];

const asExtendedRoute = (route?: RouteConfig | null): ExtendedRouteConfig | null =>
  route ? (route as ExtendedRouteConfig) : null;

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundFare = (value: unknown) => Math.round(toNumber(value));

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/pitix/g, "pitx")
    .replace(/st\.?\s*cruz/g, "st-cruz")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

const normalizeLabel = (value: unknown) =>
  String(value || "")
    .replace(/PITIX/gi, "PITX")
    .replace(/St\.? ?Cruz/gi, "ST. CRUZ")
    .replace(/Sta\.? ?Cruz/gi, "ST. CRUZ")
    .replace(/Santa Cruz/gi, "ST. CRUZ")
    .replace(/FVR Terminal/gi, "FVR Terminal")
    .trim();

const normalizeText = (value: unknown) =>
  String(value || "")
    .toLowerCase()
    .replace(/pitix/g, "pitx")
    .replace(/st\.?\s*cruz/g, "st cruz")
    .replace(/sta\.?\s*cruz/g, "st cruz")
    .replace(/santa\s+cruz/g, "st cruz")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const pathFor = (direction: RouteDirection) => routePathByDirection[direction];

const inferLineId = (route: Partial<ExtendedRouteConfig> | RawRoute): string => {
  const explicit = normalizeText(route.lineId || route.routeGroup);
  const explicitCompact = explicit.replace(/\s+/g, "");

  if (
    explicitCompact === "fvrpitx" ||
    explicitCompact === "fvrpitxfvr" ||
    explicitCompact === "pitx" ||
    explicit.includes("pitx") ||
    explicit.includes("gma") ||
    explicit.includes("kamuning")
  ) {
    return "fvr-pitx";
  }

  if (
    explicitCompact === "fvrstcruz" ||
    explicitCompact === "fvrstcruzfvr" ||
    explicitCompact === "fvrmuzonstcruz" ||
    explicitCompact === "fvrmuzonstcruzfvr" ||
    explicitCompact === "stcruz" ||
    explicitCompact === "muzon" ||
    explicit.includes("st cruz") ||
    explicit.includes("muzon")
  ) {
    return "fvr-stcruz";
  }

  const text = normalizeText(
    [
      route.id,
      route.routeName,
      route.origin,
      route.destination,
      route.legacyKey,
      route.legacyPath,
      route.mapReferenceUrl,
      route.googleMapReferenceUrl
    ].join(" ")
  );

  if (text.includes("pitx") || text.includes("gma") || text.includes("kamuning")) {
    return "fvr-pitx";
  }

  if (
    text.includes("st cruz") ||
    text.includes("muzon") ||
    text.includes("sampol") ||
    text.includes("area e") ||
    text.includes("motorpol") ||
    text.includes("proper") ||
    text.includes("new city hall") ||
    text.includes("kaypian") ||
    text.includes("san jose") ||
    text.includes("sapang palay") ||
    text.includes("sjdm") ||
    text.includes("san jose del monte")
  ) {
    return "fvr-stcruz";
  }

  return "";
};

const routeGroupForLineId = (lineId?: string) => {
  if (lineId === "fvr-pitx") return "FVR_PITX";
  if (lineId === "fvr-stcruz") return "FVR_ST_CRUZ";
  return "";
};

const referenceForLineId = (lineId?: string) => {
  if (lineId === "fvr-pitx") return FVR_PITX_REF;
  if (lineId === "fvr-stcruz") return FVR_ST_CRUZ_REF;
  return "";
};

const toWaypointArray = (value: unknown): ExtendedWaypoint[] => {
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
        name: normalizeLabel(item.name || item.stopName || item.label || item.title),
        lat: lat === undefined || lat === null ? undefined : toNumber(lat),
        lng: lng === undefined || lng === null ? undefined : toNumber(lng),
        sequence: item.sequence ?? item.order ?? item.point_order ?? item.stop_order ?? index + 1,
        type: item.type,
        fare: item.fare === undefined ? undefined : toNumber(item.fare),
        source: item.source,
        legacyKey: item.legacyKey,
        lineId: item.lineId,
        direction: item.direction,
        origin: item.origin ? normalizeLabel(item.origin) : undefined,
        destination: item.destination ? normalizeLabel(item.destination) : undefined
      } as ExtendedWaypoint;
    })
    .sort((a, b) => toNumber(a.sequence) - toNumber(b.sequence));
};

const normalizeLegacyRoutes = (raw: RawRoutes | null, direction: RouteDirection): RouteConfig[] =>
  Object.entries(raw || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, route]) => {
      const lineId = inferLineId({ ...route, legacyKey: key });
      const mapReferenceUrl =
        route.mapReferenceUrl ||
        route.googleMapReferenceUrl ||
        referenceForLineId(lineId);

      return {
        id: `legacy-${direction}-${key}`,
        direction,
        lineId,
        routeGroup: route.routeGroup || routeGroupForLineId(lineId),
        routeName:
          normalizeLabel(route.routeName) ||
          `${normalizeLabel(route.origin)} to ${normalizeLabel(route.destination)}`,
        origin: normalizeLabel(route.origin || "Unknown Origin"),
        destination: normalizeLabel(route.destination || "Unknown Destination"),
        price: roundFare(route.price ?? route.baseFare),
        distance: route.distance ? toNumber(route.distance) : undefined,
        distanceKm: route.distanceKm
          ? toNumber(route.distanceKm)
          : route.distance
            ? toNumber(route.distance)
            : undefined,
        estimatedDurationMinutes: route.estimatedDurationMinutes
          ? toNumber(route.estimatedDurationMinutes)
          : undefined,
        trafficDurationMinutes: route.trafficDurationMinutes
          ? toNumber(route.trafficDurationMinutes)
          : undefined,
        baseFare: route.baseFare ? roundFare(route.baseFare) : roundFare(route.price),
        farePerKm: route.farePerKm ? toNumber(route.farePerKm) : undefined,
        status: route.status || "active",
        isViceVersa: Boolean(route.isViceVersa),
        reverseRouteId: route.reverseRouteId,
        mapReferenceUrl,
        googleMapReferenceUrl: route.googleMapReferenceUrl || mapReferenceUrl,
        encodedPolyline: route.encodedPolyline,
        routeGeometrySource: route.routeGeometrySource,
        stops: toWaypointArray(route.stops),
        waypoints: toWaypointArray(route.waypoints),
        source: "legacy",
        legacyPath:
          direction === "forward" ? firebasePaths.routesForward : firebasePaths.routesReverse,
        legacyKey: key,
        createdAt: route.createdAt,
        updatedAt: route.updatedAt,
        createdBy: route.createdBy,
        updatedBy: route.updatedBy
      } as ExtendedRouteConfig;
    });

const normalizeAdminRoutes = (raw: RawRoutes | null): RouteConfig[] =>
  Object.entries(raw || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, route]) => {
      const id = String(route.routeId || key);
      const lineId = inferLineId({ ...route, id });
      const mapReferenceUrl =
        route.mapReferenceUrl ||
        route.googleMapReferenceUrl ||
        referenceForLineId(lineId);

      return {
        id,
        direction: route.direction || "forward",
        lineId,
        routeGroup: route.routeGroup || routeGroupForLineId(lineId),
        routeName:
          normalizeLabel(route.routeName) ||
          `${normalizeLabel(route.origin)} to ${normalizeLabel(route.destination)}`,
        origin: normalizeLabel(route.origin || "Unknown Origin"),
        destination: normalizeLabel(route.destination || "Unknown Destination"),
        price: roundFare(route.price ?? route.baseFare),
        distance: route.distance ? toNumber(route.distance) : undefined,
        distanceKm: route.distanceKm
          ? toNumber(route.distanceKm)
          : route.distance
            ? toNumber(route.distance)
            : undefined,
        estimatedDurationMinutes: route.estimatedDurationMinutes
          ? toNumber(route.estimatedDurationMinutes)
          : undefined,
        trafficDurationMinutes: route.trafficDurationMinutes
          ? toNumber(route.trafficDurationMinutes)
          : undefined,
        baseFare: route.baseFare ? roundFare(route.baseFare) : roundFare(route.price),
        farePerKm: route.farePerKm ? toNumber(route.farePerKm) : undefined,
        status: route.status || "active",
        isViceVersa: Boolean(route.isViceVersa),
        reverseRouteId: route.reverseRouteId,
        mapReferenceUrl,
        googleMapReferenceUrl: route.googleMapReferenceUrl || mapReferenceUrl,
        encodedPolyline: route.encodedPolyline,
        routeGeometrySource: route.routeGeometrySource,
        assignedBusId: route.assignedBusId,
        assignedTripScheduleId: route.assignedTripScheduleId,
        stops: toWaypointArray(route.stops),
        waypoints: toWaypointArray(route.waypoints),
        source: "admin",
        createdAt: route.createdAt,
        updatedAt: route.updatedAt,
        createdBy: route.createdBy,
        updatedBy: route.updatedBy
      } as ExtendedRouteConfig;
    });

const sortProductionRoutes = (routes: RouteConfig[]) => {
  const order = [
    "fvr-to-pitx-via-gma",
    "pitx-to-fvr-via-gma",
    "fvr-to-st-cruz",
    "st-cruz-to-fvr"
  ];

  return routes.sort((a, b) => {
    const indexA = order.indexOf(a.id);
    const indexB = order.indexOf(b.id);

    if (indexA !== -1 || indexB !== -1) {
      return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
    }

    const name = (a.routeName || a.origin).localeCompare(b.routeName || b.origin);
    return name || a.direction.localeCompare(b.direction);
  });
};

const mergeProductionRoutes = (
  adminRoutes: RouteConfig[],
  supabaseRoutes: RouteConfig[]
): RouteConfig[] => {
  const byId = new Map<string, ExtendedRouteConfig>();

  [...defaultRoutes, ...supabaseRoutes, ...adminRoutes].forEach((baseRoute) => {
    const route = baseRoute as ExtendedRouteConfig;

    if (!mainRouteIds.has(route.id)) return;

    const existing = byId.get(route.id);

    byId.set(route.id, {
      ...existing,
      ...route,
      lineId: route.lineId || existing?.lineId || inferLineId(route),
      routeGroup: route.routeGroup || existing?.routeGroup || routeGroupForLineId(route.lineId),
      mapReferenceUrl:
        route.mapReferenceUrl ||
        route.googleMapReferenceUrl ||
        existing?.mapReferenceUrl ||
        referenceForLineId(route.lineId),
      googleMapReferenceUrl:
        route.googleMapReferenceUrl ||
        route.mapReferenceUrl ||
        existing?.googleMapReferenceUrl ||
        referenceForLineId(route.lineId),
      waypoints: route.waypoints?.length ? route.waypoints : existing?.waypoints || [],
      stops: route.stops?.length ? route.stops : existing?.stops || []
    } as ExtendedRouteConfig);
  });

  return sortProductionRoutes(
    [...byId.values()].filter(
      (route) => (route.status || "active") === "active" && route.visible !== false
    )
  );
};

const routePayload = (
  route: RoutePatch & Pick<RouteConfig, "origin" | "destination">,
  id: string,
  actor: string,
  current?: RouteConfig | null
) => {
  const currentExtra = asExtendedRoute(current);
  const now = new Date().toISOString();
  const direction = route.direction || currentExtra?.direction || "forward";
  const lineId =
    route.lineId || currentExtra?.lineId || inferLineId({ ...currentExtra, ...route, id });

  const reference =
    route.googleMapReferenceUrl ||
    route.mapReferenceUrl ||
    currentExtra?.googleMapReferenceUrl ||
    currentExtra?.mapReferenceUrl ||
    referenceForLineId(lineId);

  return {
    routeId: id,
    lineId,
    routeGroup: route.routeGroup || currentExtra?.routeGroup || routeGroupForLineId(lineId),
    routeName: route.routeName || currentExtra?.routeName || `${route.origin} to ${route.destination}`,
    origin: normalizeLabel(route.origin),
    destination: normalizeLabel(route.destination),
    direction,
    isViceVersa: route.isViceVersa ?? currentExtra?.isViceVersa ?? false,
    reverseRouteId: route.reverseRouteId ?? currentExtra?.reverseRouteId,
    status: route.status || currentExtra?.status || "active",
    mapReferenceUrl: reference,
    googleMapReferenceUrl: reference,
    distanceKm: route.distanceKm ?? route.distance ?? currentExtra?.distanceKm ?? currentExtra?.distance,
    distance: route.distance ?? route.distanceKm ?? currentExtra?.distance,
    estimatedDurationMinutes:
      route.estimatedDurationMinutes ?? currentExtra?.estimatedDurationMinutes,
    trafficDurationMinutes: route.trafficDurationMinutes ?? currentExtra?.trafficDurationMinutes,
    encodedPolyline: route.encodedPolyline ?? currentExtra?.encodedPolyline,
    routeGeometrySource: route.routeGeometrySource ?? currentExtra?.routeGeometrySource,
    baseFare: roundFare(route.baseFare ?? route.price ?? currentExtra?.baseFare ?? currentExtra?.price ?? 0),
    farePerKm: route.farePerKm ?? currentExtra?.farePerKm ?? 0,
    price: roundFare(route.price ?? route.baseFare ?? currentExtra?.price ?? currentExtra?.baseFare ?? 0),
    stops: route.stops ?? currentExtra?.stops ?? [],
    waypoints: route.waypoints ?? currentExtra?.waypoints ?? [],
    assignedBusId: route.assignedBusId ?? currentExtra?.assignedBusId ?? "",
    assignedTripScheduleId:
      route.assignedTripScheduleId ?? currentExtra?.assignedTripScheduleId ?? "",
    createdAt: currentExtra?.createdAt || now,
    updatedAt: now,
    createdBy: currentExtra?.createdBy || actor,
    updatedBy: actor
  };
};

const legacyPayload = (
  direction: RouteDirection,
  route: RoutePatch,
  actor: string,
  current: RawRoute = {}
) => {
  const now = new Date().toISOString();
  const origin = normalizeLabel(route.origin || current.origin || "Unknown Origin");
  const destination = normalizeLabel(route.destination || current.destination || "Unknown Destination");
  const lineId = route.lineId || current.lineId || inferLineId({ ...current, ...route, direction });

  const reference =
    route.googleMapReferenceUrl ||
    route.mapReferenceUrl ||
    current.googleMapReferenceUrl ||
    current.mapReferenceUrl ||
    referenceForLineId(lineId);

  return {
    ...current,
    ...route,
    lineId,
    routeGroup: route.routeGroup || current.routeGroup || routeGroupForLineId(lineId),
    routeName: route.routeName || current.routeName || `${origin} to ${destination}`,
    origin,
    destination,
    direction,
    price: roundFare(route.price ?? current.price ?? route.baseFare ?? current.baseFare ?? 0),
    baseFare: roundFare(route.baseFare ?? current.baseFare ?? route.price ?? current.price ?? 0),
    distanceKm: route.distanceKm ?? current.distanceKm,
    distance: route.distance ?? route.distanceKm ?? current.distance,
    estimatedDurationMinutes: route.estimatedDurationMinutes ?? current.estimatedDurationMinutes,
    trafficDurationMinutes: route.trafficDurationMinutes ?? current.trafficDurationMinutes,
    mapReferenceUrl: reference,
    googleMapReferenceUrl: reference,
    status: route.status || current.status || "active",
    stops: route.stops ?? current.stops ?? [],
    waypoints: route.waypoints ?? current.waypoints ?? [],
    updatedAt: now,
    updatedBy: actor,
    createdAt: current.createdAt || now,
    createdBy: current.createdBy || actor
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

  async getRoutes(
    direction?: RouteDirection,
    options: { includeLegacy?: boolean } = {}
  ): Promise<RouteConfig[]> {
    const [adminRoutes, supabaseRoutes] = await Promise.all([
      this.getAdminRoutes(),
      this.getSupabaseRoutes()
    ]);

    const productionRoutes = mergeProductionRoutes(adminRoutes, supabaseRoutes);

    const merged = options.includeLegacy
      ? [
          ...productionRoutes,
          ...(await this.getLegacyRoutes("forward")),
          ...(await this.getLegacyRoutes("reverse"))
        ]
      : productionRoutes;

    return direction ? merged.filter((route) => route.direction === direction) : merged;
  },

  async getRouteById(id: string): Promise<RouteConfig | null> {
    const adminRaw = await realtimeDbService.getPath<RawRoute>(`${firebasePaths.adminRoutes}/${id}`);

    if (adminRaw) {
      return normalizeAdminRoutes({ [id]: adminRaw })[0] || null;
    }

    const supabaseRoute = await supabaseService.getRoute(id);

    if (supabaseRoute) {
      return supabaseRoute;
    }

    const routes = await this.getRoutes();
    return routes.find((route) => route.id === id) || null;
  },

  async getRouteWaypoints(id: string) {
    const route = await this.getRouteById(id);

    if (route?.waypoints?.length) {
      return route.waypoints;
    }

    return supabaseService.listRouteWaypoints(id);
  },

  async getRouteStops(id: string) {
    const route = await this.getRouteById(id);

    if (route?.stops?.length) {
      return route.stops;
    }

    return supabaseService.listRouteStops(id);
  },

  async createRoute(
    route: RoutePatch & Pick<RouteConfig, "origin" | "destination">,
    actor = "system"
  ): Promise<RouteConfig> {
    const existingAdmin = await this.getAdminRoutes();
    const baseId =
      slugify(route.routeName || `${route.origin}-${route.destination}`) || `route-${Date.now()}`;
    const id = existingAdmin.some((item) => item.id === baseId)
      ? `${baseId}-${Date.now()}`
      : baseId;
    const payload = routePayload(route, id, actor);

    await realtimeDbService.setPath(`${firebasePaths.adminRoutes}/${id}`, payload);

    await firebaseService.auditAction("route.admin.create", actor, {
      id,
      lineId: payload.lineId,
      origin: route.origin,
      destination: route.destination
    });

    return { ...payload, id, source: "admin" } as ExtendedRouteConfig;
  },

  async updateRoute(id: string, patch: RoutePatch, actor = "system"): Promise<RouteConfig> {
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

    await firebaseService.auditAction("route.admin.update", actor, {
      id,
      lineId: payload.lineId,
      patch
    });

    return { ...payload, id, source: "admin" } as ExtendedRouteConfig;
  },

  async updateRouteStatus(id: string, status: RouteStatus, actor = "system"): Promise<RouteConfig> {
    return this.updateRoute(id, { status }, actor);
  },

  async createLegacyRoute(
    direction: RouteDirection,
    route: RoutePatch,
    actor = "system"
  ): Promise<RouteConfig> {
    const legacyPath = pathFor(direction);
    const origin = normalizeLabel(route.origin || "Unknown Origin");
    const destination = normalizeLabel(route.destination || "Unknown Destination");
    const keyBase = slugify(`${origin}-${destination}`) || `fare-stop-${Date.now()}`;
    const key = `${keyBase}-${Date.now()}`;
    const payload = legacyPayload(direction, route, actor);

    await realtimeDbService.setPath(`${legacyPath}/${key}`, payload);

    await firebaseService.auditAction("route.legacy.create", actor, {
      direction,
      key,
      lineId: payload.lineId,
      origin,
      destination
    });

    return normalizeLegacyRoutes({ [key]: payload }, direction)[0];
  },

  async updateLegacyRoute(
    direction: RouteDirection,
    key: string,
    patch: RoutePatch,
    actor = "system"
  ): Promise<RouteConfig> {
    const legacyPath = pathFor(direction);
    const current = (await realtimeDbService.getPath<RawRoute>(`${legacyPath}/${key}`)) || {};
    const payload = legacyPayload(direction, patch, actor, current);

    await realtimeDbService.updatePath(`${legacyPath}/${key}`, payload);

    await firebaseService.auditAction("route.legacy.update", actor, {
      direction,
      key,
      lineId: payload.lineId,
      origin: payload.origin,
      destination: payload.destination
    });

    return normalizeLegacyRoutes({ [key]: payload }, direction)[0];
  },

  async deleteLegacyRoute(direction: RouteDirection, key: string, actor = "system") {
    const legacyPath = pathFor(direction);
    const current = await realtimeDbService.getPath<RawRoute>(`${legacyPath}/${key}`);

    await realtimeDbService.deletePath(`${legacyPath}/${key}`);

    await firebaseService.auditAction("route.legacy.delete", actor, {
      direction,
      key,
      lineId: current?.lineId,
      origin: current?.origin,
      destination: current?.destination
    });

    return {
      deleted: true as const,
      direction,
      key
    };
  },

  async updateRoutePath(
    id: string,
    patch: {
      waypoints?: ExtendedRouteConfig["waypoints"];
      lineId?: string;
      routeGroup?: string;
      distanceKm?: number;
      estimatedDurationMinutes?: number;
      trafficDurationMinutes?: number;
      encodedPolyline?: string;
      routeGeometrySource?: string;
      mapReferenceUrl?: string;
      googleMapReferenceUrl?: string;
    },
    actor = "system"
  ): Promise<RouteConfig> {
    const current = asExtendedRoute(await this.getRouteById(id));
    const lineId = patch.lineId ?? current?.lineId;
    const routeGroup = patch.routeGroup ?? current?.routeGroup ?? routeGroupForLineId(lineId);

    const reference =
      patch.googleMapReferenceUrl ||
      patch.mapReferenceUrl ||
      current?.googleMapReferenceUrl ||
      current?.mapReferenceUrl ||
      referenceForLineId(lineId);

    const updatedRoute = await this.updateRoute(
      id,
      {
        lineId,
        routeGroup,
        waypoints: patch.waypoints ?? current?.waypoints ?? [],
        distanceKm: patch.distanceKm ?? current?.distanceKm,
        distance: patch.distanceKm ?? current?.distance,
        estimatedDurationMinutes:
          patch.estimatedDurationMinutes ?? current?.estimatedDurationMinutes,
        trafficDurationMinutes:
          patch.trafficDurationMinutes ?? current?.trafficDurationMinutes,
        encodedPolyline: patch.encodedPolyline ?? current?.encodedPolyline,
        routeGeometrySource: patch.routeGeometrySource ?? current?.routeGeometrySource ?? "manual",
        mapReferenceUrl: reference,
        googleMapReferenceUrl: reference
      },
      actor
    );

    try {
      await supabaseService.syncRoute(updatedRoute);
    } catch (error) {
      console.warn("[routes] Supabase route path sync skipped.", error);
    }

    return updatedRoute;
  },

  async updateRouteReference(
    id: string,
    googleMapReferenceUrl: string,
    actor = "system"
  ): Promise<RouteConfig> {
    return this.updateRoute(
      id,
      {
        mapReferenceUrl: googleMapReferenceUrl,
        googleMapReferenceUrl
      },
      actor
    );
  },

  async addStop(id: string, stop: ExtendedWaypoint, actor = "system") {
    const current = asExtendedRoute(await this.getRouteById(id));
    const stops = [...(current?.stops || [])];
    const stopId = stop.id || `stop-${Date.now()}`;

    stops.push({
      ...stop,
      id: stopId,
      sequence: stop.sequence ?? stops.length + 1
    });

    return this.updateRoute(id, { stops }, actor);
  },

  async patchStop(id: string, stopId: string, patch: Partial<ExtendedWaypoint>, actor = "system") {
    const current = asExtendedRoute(await this.getRouteById(id));

    const stops = (current?.stops || []).map((stop) =>
      stop.id === stopId ? { ...stop, ...patch } : stop
    );

    return this.updateRoute(id, { stops }, actor);
  },

  async deleteStop(id: string, stopId: string, actor = "system") {
    const current = asExtendedRoute(await this.getRouteById(id));
    const stops = (current?.stops || []).filter((stop) => stop.id !== stopId);

    return this.updateRoute(id, { stops }, actor);
  },

  async patchLine(id: string, waypoints: ExtendedRouteConfig["waypoints"], actor = "system") {
    return this.updateRoute(
      id,
      {
        waypoints,
        routeGeometrySource: "manual"
      },
      actor
    );
  }
};
