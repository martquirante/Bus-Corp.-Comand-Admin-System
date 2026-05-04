import { routeService } from "./route.service.js";
import { supabaseService } from "./supabase.service.js";

const productionRouteIds = new Set([
  "fvr-to-pitx-via-gma",
  "pitx-to-fvr-via-gma",
  "fvr-to-st-cruz",
  "st-cruz-to-fvr"
]);

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
    const productionRoutes = routes.filter((route) => {
      const visibility = (route as unknown as Record<string, unknown>).visibility;
      return productionRouteIds.has(route.id) && (route.status || "active") === "active" && visibility !== "hidden" && visibility !== false;
    });
    const results = [];

    for (const route of productionRoutes) {
      results.push(await supabaseService.syncRoute(route));
    }

    return {
      synced: results.filter((item) => item.synced).length,
      attempted: productionRoutes.length,
      results
    };
  }
};
