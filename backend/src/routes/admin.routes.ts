import { Router } from "express";
import { adminController } from "../controllers/admin.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const adminRoutes = Router();

adminRoutes.use(requireAuth, requireRole("SuperAdmin", "Admin"));
adminRoutes.get("/accounts", asyncHandler(adminController.getAccounts));
adminRoutes.post("/accounts", asyncHandler(adminController.createAccount));
adminRoutes.patch("/accounts/:id", asyncHandler(adminController.patchAccount));
