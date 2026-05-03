import { Router } from "express";
import { legacyController } from "../controllers/legacy.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const legacyRoutes = Router();

legacyRoutes.use(requireAuth);

legacyRoutes.get("/assistance-requests", asyncHandler(legacyController.getAssistanceRequests));
legacyRoutes.get("/config", asyncHandler(legacyController.getConfig));
legacyRoutes.get("/expenses", asyncHandler(legacyController.getExpenses));
legacyRoutes.get("/pos-devices", asyncHandler(legacyController.getPosDevices));
legacyRoutes.get("/routes-forward", asyncHandler(legacyController.getRoutesForward));
legacyRoutes.get("/routes-reverse", asyncHandler(legacyController.getRoutesReverse));
legacyRoutes.get("/messages", asyncHandler(legacyController.getMessages));

legacyRoutes.patch(
  "/config",
  requireRole("SuperAdmin", "Admin"),
  asyncHandler(legacyController.patchConfig)
);
legacyRoutes.patch(
  "/assistance-requests/:id",
  requireRole("SuperAdmin", "Admin"),
  asyncHandler(legacyController.patchAssistanceRequest)
);
legacyRoutes.post(
  "/messages",
  requireRole("SuperAdmin", "Admin"),
  asyncHandler(legacyController.postMessage)
);
legacyRoutes.patch(
  "/messages/:id",
  requireRole("SuperAdmin", "Admin"),
  asyncHandler(legacyController.patchMessage)
);
