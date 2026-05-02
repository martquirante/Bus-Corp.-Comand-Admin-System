import { Router } from "express";
import { reportsController } from "../controllers/reports.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const reportsRoutes = Router();

reportsRoutes.get("/revenue", requireAuth, asyncHandler(reportsController.getRevenue));
