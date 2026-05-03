import { Router } from "express";
import { employeeController } from "../controllers/adminResources.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const employeesRoutes = Router();

employeesRoutes.use(requireAuth);
employeesRoutes.get("/", asyncHandler(employeeController.list));
employeesRoutes.post("/", asyncHandler(employeeController.create));
employeesRoutes.patch("/:id", asyncHandler(employeeController.patch));
employeesRoutes.patch("/:id/status", asyncHandler(employeeController.patch));
employeesRoutes.patch("/:id/assignment", asyncHandler(employeeController.patch));
