import { routeService } from "./route.service.js";
import { supabaseService } from "./supabase.service.js";

export const routeSyncService = {
  async syncRouteToSupabase(id: string) {
    const route = await routeService.getRouteById(id);
    if (!route) {
      return {
        synced: false,
        routeId: id,
        reason: "Route was not found in AdminRoutes or Supabase."
      };
    }

    return supabaseService.syncRoute(route);
  },

  async syncFirebaseRoutesToSupabase() {
    const routes = await routeService.getAdminRoutes();
    const results = [];

    for (const route of routes) {
      results.push(await supabaseService.syncRoute(route));
    }

    return {
      synced: results.filter((item) => item.synced).length,
      attempted: results.length,
      results
    };
  }
};
