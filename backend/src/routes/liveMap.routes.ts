import { Router } from "express";
import { liveMapController } from "../controllers/liveMap.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const liveMapRoutes = Router();

liveMapRoutes.use(requireAuth);
liveMapRoutes.get("/", asyncHandler(liveMapController.overview));
liveMapRoutes.get("/buses", asyncHandler(liveMapController.buses));
liveMapRoutes.get("/terminals", asyncHandler(liveMapController.terminals));
liveMapRoutes.get("/routes", asyncHandler(liveMapController.routes));
liveMapRoutes.post("/route-suggestions", asyncHandler(liveMapController.suggestRoute));
liveMapRoutes.patch("/route-suggestions/:id/approve", asyncHandler(liveMapController.approveSuggestion));
liveMapRoutes.patch("/route-suggestions/:id/reject", asyncHandler(liveMapController.rejectSuggestion));
