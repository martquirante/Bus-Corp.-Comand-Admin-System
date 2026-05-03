import { Router } from "express";
import { busFleetController } from "../controllers/adminResources.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const busesRoutes = Router();

busesRoutes.use(requireAuth);
busesRoutes.get("/", asyncHandler(busFleetController.list));
busesRoutes.post("/", asyncHandler(busFleetController.create));
busesRoutes.patch("/:id", asyncHandler(busFleetController.patch));
busesRoutes.patch("/:id/status", asyncHandler(busFleetController.patch));
busesRoutes.patch("/:id/assignment", asyncHandler(busFleetController.patch));
