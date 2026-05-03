import { Router } from "express";
import { realtimeController } from "../controllers/realtime.controller.js";
import { allowSseSession } from "../middleware/sseAuth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const realtimeRoutes = Router();

realtimeRoutes.get("/dashboard/stream", allowSseSession, asyncHandler(realtimeController.streamDashboard));
realtimeRoutes.get("/critical-alerts/stream", allowSseSession, asyncHandler(realtimeController.streamCriticalAlerts));
