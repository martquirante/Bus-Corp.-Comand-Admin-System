import { Router } from "express";
import { employeeViolationsController } from "../controllers/employeeViolations.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const employeeViolationsRoutes = Router();

employeeViolationsRoutes.use(requireAuth);
employeeViolationsRoutes.get("/", asyncHandler(employeeViolationsController.list));
employeeViolationsRoutes.post("/", asyncHandler(employeeViolationsController.create));
employeeViolationsRoutes.patch("/:id/status", asyncHandler(employeeViolationsController.patchStatus));
employeeViolationsRoutes.patch("/:id", asyncHandler(employeeViolationsController.patch));
