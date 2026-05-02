import type { RouteConfig } from "@pos-bus/shared";
import { firebasePaths, routePathByDirection } from "@pos-bus/shared";
import { firebaseService } from "./firebase.service.js";

type RouteDirection = RouteConfig["direction"];
type RawRoutes = Record<string, Omit<RouteConfig, "id" | "direction">>;

const normalizeRoutes = (raw: RawRoutes | null, direction: RouteDirection): RouteConfig[] =>
  Object.entries(raw || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, route]) => ({
      id,
      direction,
      origin: route.origin,
      destination: route.destination,
      price: Number(route.price || 0),
      distance: route.distance ? Number(route.distance) : undefined,
      createdAt: route.createdAt,
      updatedAt: route.updatedAt,
      createdBy: route.createdBy
    }));

const pathFor = (direction: RouteDirection) => routePathByDirection[direction];

const nextRouteKey = (routes: RouteConfig[], direction: RouteDirection) => {
  const prefix = direction === "forward" ? "route_fwd_" : "route_rev_";
  return `${prefix}${String(routes.length + 1).padStart(2, "0")}`;
};

export const routeService = {
  async getRoutes(direction?: RouteDirection): Promise<RouteConfig[]> {
    if (direction) {
      const raw = await firebaseService.getPath<RawRoutes>(pathFor(direction));
      return normalizeRoutes(raw, direction);
    }

    const [forward, reverse] = await Promise.all([
      firebaseService.getPath<RawRoutes>(firebasePaths.routesForward),
      firebaseService.getPath<RawRoutes>(firebasePaths.routesReverse)
    ]);

    return [...normalizeRoutes(forward, "forward"), ...normalizeRoutes(reverse, "reverse")];
  },

  async createRoute(route: Omit<RouteConfig, "id">, actor = "system"): Promise<RouteConfig> {
    const existing = await this.getRoutes(route.direction);
    const id = nextRouteKey(existing, route.direction);
    const now = new Date().toISOString();
    const payload = {
      origin: route.origin,
      destination: route.destination,
      price: route.price,
      distance: route.distance,
      createdAt: now,
      updatedAt: now,
      createdBy: actor
    };

    await firebaseService.setPath(`${pathFor(route.direction)}/${id}`, payload);
    await firebaseService.auditAction("route.create", actor, { id, direction: route.direction });

    return { id, direction: route.direction, ...payload };
  },

  async updateRoute(
    id: string,
    direction: RouteDirection,
    patch: Partial<Omit<RouteConfig, "id" | "direction">>,
    actor = "system"
  ): Promise<RouteConfig> {
    const payload = {
      ...patch,
      updatedAt: new Date().toISOString()
    };

    await firebaseService.updatePath(`${pathFor(direction)}/${id}`, payload);
    await firebaseService.auditAction("route.update", actor, { id, direction, patch });

    const routes = await this.getRoutes(direction);
    return routes.find((route) => route.id === id) || ({ id, direction, ...payload } as RouteConfig);
  }
};
