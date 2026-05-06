import { Router } from "express";
import { routesController } from "../controllers/routes.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const routesRoutes = Router();

/**
 * IMPORTANT ROUTE ORDER:
 *
 * Keep specific routes above "/:id" routes.
 * Express will treat "/legacy/forward" or "/:id/path" as an id if the generic
 * "/:id" route is placed too early.
 */

// ─── Route list / main reads ────────────────────────────────────────────────

routesRoutes.get("/", requireAuth, asyncHandler(routesController.getRoutes));

routesRoutes.get(
  "/legacy/forward",
  requireAuth,
  asyncHandler(routesController.getLegacyForward)
);

routesRoutes.get(
  "/legacy/reverse",
  requireAuth,
  asyncHandler(routesController.getLegacyReverse)
);

// ─── Fare Stop Matrix: Routes_Forward / Routes_Reverse ─────────────────────
//
// These are conductor ticket destination/drop-off fares.
// Do NOT save these into AdminRoutes.
// Forward = Firebase Routes_Forward
// Reverse = Firebase Routes_Reverse

routesRoutes.post(
  "/legacy/:direction",
  requireAuth,
  requireRole("SuperAdmin", "Admin"),
  asyncHandler(routesController.createLegacyRoute)
);

routesRoutes.patch(
  "/legacy/:direction/:key",
  requireAuth,
  requireRole("SuperAdmin", "Admin"),
  asyncHandler(routesController.updateLegacyRoute)
);

routesRoutes.delete(
  "/legacy/:direction/:key",
  requireAuth,
  requireRole("SuperAdmin", "Admin"),
  asyncHandler(routesController.deleteLegacyRoute)
);

// ─── AdminRoutes path / map geometry ────────────────────────────────────────
//
// These endpoints update the actual route path used by Route Config and
// Live Fleet Map. They save to Firebase AdminRoutes.

routesRoutes.patch(
  "/:id/path",
  requireAuth,
  requireRole("SuperAdmin", "Admin"),
  asyncHandler(routesController.updateRoutePath)
);

routesRoutes.patch(
  "/:id/reference",
  requireAuth,
  requireRole("SuperAdmin", "Admin"),
  asyncHandler(routesController.updateRouteReference)
);

routesRoutes.post(
  "/:id/recalculate-path",
  requireAuth,
  requireRole("SuperAdmin", "Admin"),
  asyncHandler(routesController.recalculateRoutePath)
);

// ─── AdminRoutes details ────────────────────────────────────────────────────

routesRoutes.get(
  "/:id/waypoints",
  requireAuth,
  asyncHandler(routesController.getRouteWaypoints)
);

routesRoutes.get(
  "/:id/stops",
  requireAuth,
  asyncHandler(routesController.getRouteStops)
);

routesRoutes.get(
  "/:id",
  requireAuth,
  asyncHandler(routesController.getRoute)
);

// ─── AdminRoutes create/update ──────────────────────────────────────────────

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

// ─── AdminRoutes stops ──────────────────────────────────────────────────────

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

// ─── Legacy line patch support ──────────────────────────────────────────────

routesRoutes.patch(
  "/:id/line",
  requireAuth,
  requireRole("SuperAdmin", "Admin"),
  asyncHandler(routesController.patchLine)
);

// ─── Supabase sync ──────────────────────────────────────────────────────────

routesRoutes.post(
  "/:id/sync-to-supabase",
  requireAuth,
  requireRole("SuperAdmin", "Admin"),
  asyncHandler(routesController.syncToSupabase)
);