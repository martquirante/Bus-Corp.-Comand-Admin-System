import { Router } from "express";
import { dashboardController } from "../controllers/dashboard.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const dashboardRoutes = Router();

dashboardRoutes.get("/", requireAuth, asyncHandler(dashboardController.getDashboard));
dashboardRoutes.get("/stats", requireAuth, asyncHandler(dashboardController.getStats));
dashboardRoutes.get("/summary", requireAuth, asyncHandler(dashboardController.getSummary));
