import { Router } from "express";
import { routesController } from "../controllers/routes.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const routesRoutes = Router();

routesRoutes.get("/", requireAuth, asyncHandler(routesController.getRoutes));
routesRoutes.get("/legacy/forward", requireAuth, asyncHandler(routesController.getLegacyForward));
routesRoutes.get("/legacy/reverse", requireAuth, asyncHandler(routesController.getLegacyReverse));
routesRoutes.get("/:id/waypoints", requireAuth, asyncHandler(routesController.getRouteWaypoints));
routesRoutes.get("/:id/stops", requireAuth, asyncHandler(routesController.getRouteStops));
routesRoutes.get("/:id", requireAuth, asyncHandler(routesController.getRoute));
routesRoutes.post(
  "/",
  requireAuth,
  requireRole("SuperAdmin", "Admin"),
  asyncHandler(routesController.createRoute)
);
routesRoutes.patch(
  "/:id",
  requireAuth,
  requireRole("SuperAdmin", "Admin"),
  asyncHandler(routesController.updateRoute)
);
routesRoutes.patch(
  "/:id/status",
  requireAuth,
  requireRole("SuperAdmin", "Admin"),
  asyncHandler(routesController.updateRouteStatus)
);
routesRoutes.post(
  "/:id/stops",
  requireAuth,
  requireRole("SuperAdmin", "Admin"),
  asyncHandler(routesController.addStop)
);
routesRoutes.patch(
  "/:id/stops/:stopId",
  requireAuth,
  requireRole("SuperAdmin", "Admin"),
  asyncHandler(routesController.patchStop)
);
routesRoutes.delete(
  "/:id/stops/:stopId",
  requireAuth,
  requireRole("SuperAdmin", "Admin"),
  asyncHandler(routesController.deleteStop)
);
routesRoutes.patch(
  "/:id/line",
  requireAuth,
  requireRole("SuperAdmin", "Admin"),
  asyncHandler(routesController.patchLine)
);
routesRoutes.post(
  "/:id/sync-to-supabase",
  requireAuth,
  requireRole("SuperAdmin", "Admin"),
  asyncHandler(routesController.syncToSupabase)
);
