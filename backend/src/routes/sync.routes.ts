import { Router } from "express";
import { syncController } from "../controllers/sync.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const syncRoutes = Router();

syncRoutes.use(requireAuth, requireRole("SuperAdmin", "Admin"));
syncRoutes.get("/status", asyncHandler(syncController.getStatus));
syncRoutes.post("/firebase-to-supabase", asyncHandler(syncController.syncFirebaseToSupabase));
syncRoutes.post("/realtime-to-sql", asyncHandler(syncController.syncRealtimeToSql));
syncRoutes.post("/run-once", asyncHandler(syncController.syncRealtimeToSql));
syncRoutes.post("/routes", asyncHandler(syncController.syncRealtimeToSql));
syncRoutes.post("/expenses", asyncHandler(syncController.syncRealtimeToSql));
syncRoutes.post("/transactions", asyncHandler(syncController.syncTransactions));
syncRoutes.post("/critical-alerts", asyncHandler(syncController.syncRealtimeToSql));
