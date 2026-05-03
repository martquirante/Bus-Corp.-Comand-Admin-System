import type { RouteConfig } from "@pos-bus/shared";
import { api } from "./api";

export const routesService = {
  listProductionRoutes() {
    return api.routes();
  },

  getRoute(id: string) {
    return api.getRoute(id);
  },

  getWaypoints(id: string) {
    return api.getRouteWaypoints(id);
  },

  getStops(id: string) {
    return api.getRouteStops(id);
  },

  updateRoute(id: string, payload: Partial<RouteConfig>) {
    return api.updateRoute(id, payload);
  },

  syncToSupabase(id: string) {
    return api.syncRouteToSupabase(id);
  },

  getLegacyFareMatrix() {
    return Promise.all([api.getLegacyRoutesForward(), api.getLegacyRoutesReverse()]);
  }
};
