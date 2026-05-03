import { Router } from "express";
import { criticalAlertsController } from "../controllers/criticalAlerts.controller.js";
import { realtimeController } from "../controllers/realtime.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { allowSseSession } from "../middleware/sseAuth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const criticalAlertsRoutes = Router();

criticalAlertsRoutes.get("/stream", allowSseSession, asyncHandler(realtimeController.streamCriticalAlerts));

criticalAlertsRoutes.use(requireAuth);

criticalAlertsRoutes.get("/", asyncHandler(criticalAlertsController.getAlerts));
criticalAlertsRoutes.get("/active", asyncHandler(criticalAlertsController.getActiveAlerts));
criticalAlertsRoutes.patch("/:id/acknowledge", asyncHandler(criticalAlertsController.acknowledge));
criticalAlertsRoutes.patch("/:id/resolve", asyncHandler(criticalAlertsController.resolve));
criticalAlertsRoutes.patch("/:id/dismiss", asyncHandler(criticalAlertsController.dismiss));
