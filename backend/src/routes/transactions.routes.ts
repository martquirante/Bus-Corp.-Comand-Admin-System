import { Router } from "express";
import { transactionsController } from "../controllers/transactions.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const transactionsRoutes = Router();

transactionsRoutes.get("/", requireAuth, asyncHandler(transactionsController.getTransactions));
transactionsRoutes.get("/:id", requireAuth, asyncHandler(transactionsController.getTransactionById));
