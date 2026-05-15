import { Router } from "express";
import { remittancesController } from "../controllers/remittances.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const remittancesRoutes = Router();

remittancesRoutes.use(requireAuth);
remittancesRoutes.get("/", asyncHandler(remittancesController.list));
remittancesRoutes.post("/", asyncHandler(remittancesController.create));
remittancesRoutes.patch("/:id", asyncHandler(remittancesController.patch));
remittancesRoutes.patch("/:id/receive", asyncHandler(remittancesController.receive));
remittancesRoutes.patch("/:id/reject", asyncHandler(remittancesController.reject));
