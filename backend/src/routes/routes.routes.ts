import { Router } from "express";
import { routesController } from "../controllers/routes.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const routesRoutes = Router();

routesRoutes.get("/", requireAuth, asyncHandler(routesController.getRoutes));
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
