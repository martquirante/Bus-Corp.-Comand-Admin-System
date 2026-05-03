import { Router } from "express";
import { analyticsController } from "../controllers/analytics.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const analyticsRoutes = Router();

analyticsRoutes.get("/summary", requireAuth, asyncHandler(analyticsController.getSummary));
