import { Router } from "express";
import { fleetController } from "../controllers/fleet.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const fleetRoutes = Router();

fleetRoutes.get("/live", requireAuth, asyncHandler(fleetController.getLiveFleet));
