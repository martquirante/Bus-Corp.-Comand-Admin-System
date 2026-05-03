import { Router } from "express";
import { expensesController } from "../controllers/expenses.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const expensesRoutes = Router();

expensesRoutes.use(requireAuth);
expensesRoutes.get("/", asyncHandler(expensesController.list));
expensesRoutes.post("/", asyncHandler(expensesController.create));
expensesRoutes.patch("/:id", asyncHandler(expensesController.patch));
